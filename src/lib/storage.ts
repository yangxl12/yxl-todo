import { createEmptyData, decodeLocalData, isRecord } from './dataFormat'
import type { AppData, ThemeMode } from './types'

const DB_NAME = 'shiyan-local'
const STORE_NAME = 'journal'
const STATE_KEY = 'app-state'
const RECOVERY_KEY = 'recovery-previous'
const LOCK_NAME = 'shiyan:commit'
const FALLBACK_KEY = 'shiyan:state-fallback'
export const CHANGE_KEY = 'shiyan:committed'
export const THEME_KEY = 'shiyan:theme'

interface Snapshot {
  format: 1
  revision: string
  sequence: number
  data: AppData
  cleared?: true
}

interface Fallback {
  format: 1
  anchor: string
  snapshot: Snapshot
}

type Copy = Omit<Snapshot, 'format'>
export type LoadedState =
  | { status: 'empty' | 'primary' | 'fallback'; current: Copy }
  | { status: 'unreadable'; copies: Copy[] }
  | { status: 'diverged'; primary: Copy; fallback: Copy }

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      let blocked = false
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
      request.onsuccess = () => {
        const db = request.result
        if (blocked) {
          db.close()
          return
        }
        db.onversionchange = () => {
          db.close()
          databasePromise = null
        }
        resolve(db)
      }
      request.onerror = () => reject(request.error)
      request.onblocked = () => {
        blocked = true
        reject(new Error('Local database is blocked'))
      }
    }).catch((error) => {
      databasePromise = null
      throw error
    })
  }
  return databasePromise
}

function decodeSnapshot(raw: unknown, legacyRevision: string): Copy {
  if (!isRecord(raw) || !('format' in raw)) {
    return { revision: legacyRevision, sequence: 0, data: decodeLocalData(raw) }
  }
  if (raw.format !== 1 || typeof raw.revision !== 'string' ||
      typeof raw.sequence !== 'number' || !Number.isSafeInteger(raw.sequence) || raw.sequence < 1) {
    throw new Error('Unsupported snapshot version')
  }
  return {
    revision: raw.revision, sequence: raw.sequence, data: decodeLocalData(raw.data),
    ...(raw.cleared === true ? { cleared: true } : {}),
  }
}

type Primary = { copy: Copy; empty: boolean }
function readPrimary(raw: unknown): Primary {
  return raw === undefined
    ? { copy: { revision: 'empty', sequence: 0, data: createEmptyData() }, empty: true }
    : { copy: decodeSnapshot(raw, 'legacy-primary'), empty: false }
}

type Secondary = { copy: Copy; anchor: string | null }
function readFallback(): Secondary | null {
  const raw = localStorage.getItem(FALLBACK_KEY)
  if (raw === null) return null
  const parsed: unknown = JSON.parse(raw)
  if (isRecord(parsed) && 'snapshot' in parsed) {
    if (parsed.format !== 1 || typeof parsed.anchor !== 'string') {
      throw new Error('Unsupported fallback version')
    }
    return { copy: decodeSnapshot(parsed.snapshot, 'legacy-fallback'), anchor: parsed.anchor }
  }
  return { copy: decodeSnapshot(parsed, 'legacy-fallback'), anchor: null }
}

function select(primary: Primary | null, fallback: Secondary | null): LoadedState {
  if (!primary) return fallback
    ? { status: 'fallback', current: fallback.copy }
    : { status: 'unreadable', copies: [] }

  if (!fallback || primary.copy.revision === fallback.copy.revision ||
      (fallback.anchor !== null && primary.copy.sequence > fallback.copy.sequence)) {
    return { status: primary.empty ? 'empty' : 'primary', current: primary.copy }
  }
  if (fallback.anchor === primary.copy.revision || (fallback.anchor === null && primary.empty)) {
    return { status: 'fallback', current: fallback.copy }
  }
  return { status: 'diverged', primary: primary.copy, fallback: fallback.copy }
}

async function getPrimary(): Promise<Primary> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(STATE_KEY)
    request.onsuccess = () => {
      try {
        resolve(readPrimary(request.result))
      } catch (error) {
        reject(error)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function loadState(): Promise<LoadedState> {
  return underLock<LoadedState>(async () => {
    const primary = await getPrimary().catch(() => null)
    try {
      return select(primary, readFallback())
    } catch {
      return { status: 'unreadable', copies: primary && !primary.empty ? [primary.copy] : [] }
    }
  }).catch(() => ({ status: 'unreadable', copies: [] }))
}

export async function loadArchivedCopy(): Promise<AppData | null> {
  try {
    if (readFallback()?.copy.cleared) return null
    const db = await openDatabase()
    return await new Promise<AppData | null>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECOVERY_KEY)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}

function transact(expected: string, next: Snapshot, archive?: Copy): Promise<boolean> {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(STATE_KEY)
    let matched = false
    let failure: unknown
    request.onsuccess = () => {
      try {
        const raw: unknown = request.result
        const revision = isRecord(raw) && raw.format === 1 && typeof raw.revision === 'string'
          ? raw.revision : readPrimary(raw).copy.revision
        if (revision !== expected) return
        matched = true
        if (archive) {
          store.put({ ...archive.data, prefs: { ...archive.data.prefs, apiKey: '' } }, RECOVERY_KEY)
        } else if (next.cleared) {
          store.delete(RECOVERY_KEY)
        }
        store.put(next, STATE_KEY)
      } catch (error) {
        failure = error
        transaction.abort()
      }
    }
    transaction.oncomplete = () => resolve(matched)
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Local write aborted'))
  }))
}

export type SaveResult =
  | { status: 'saved'; copy: Copy; source: 'primary' | 'fallback' }
  | { status: 'conflict' | 'failed' }

export interface RecoveryChoice {
  primary: string
  fallback: string
  selected: string
}

async function underLock<T>(run: (locked: boolean) => Promise<T>): Promise<T> {
  return navigator.locks ? await navigator.locks.request(LOCK_NAME, () => run(true)) : run(false)
}

export function commitState(
  base: string,
  revision: string,
  data: AppData,
  options: { recovery?: RecoveryChoice; primaryOnly?: boolean; clearArchive?: boolean } = {},
): Promise<SaveResult> {
  const { recovery, primaryOnly, clearArchive } = options
  return underLock<SaveResult>(async (locked) => {
    const primary = await getPrimary().catch(() => null)
    let fallback: Secondary | null
    try {
      fallback = readFallback()
    } catch {
      return { status: 'failed' }
    }
    const loaded = select(primary, fallback)
    const current = 'current' in loaded ? loaded.current
      : recovery && loaded.status === 'diverged' &&
        loaded.primary.revision === recovery.primary && loaded.fallback.revision === recovery.fallback
        ? (recovery.selected === recovery.primary ? loaded.primary : loaded.fallback)
        : null
    if (current?.revision !== base) {
      return { status: loaded.status === 'unreadable' ? 'failed' : 'conflict' }
    }

    const next: Snapshot = {
      format: 1,
      revision,
      sequence: Math.max(current.sequence, primary?.copy.sequence ?? 0, fallback?.copy.sequence ?? 0) + 1,
      data,
      ...(clearArchive || (loaded.status === 'fallback' && current.cleared) ? { cleared: true } : {}),
    }
    // A browser without Web Locks can still use IndexedDB CAS. It must
    // leave emergency copies alone because it cannot coordinate the two layers.
    if (fallback && !locked) return { status: 'failed' }
    const anchor = primary?.copy.revision ?? fallback?.anchor
    const writeEmergency = () => {
      if (!locked || anchor == null) return false
      const emergency: Fallback = { format: 1, anchor, snapshot: next }
      try {
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(emergency))
        return true
      } catch {
        return false
      }
    }

    // If an emergency copy already exists, update it before touching the
    // primary. Either layer can then lose access without bringing old data back.
    const stageEmergency = Boolean(fallback && !recovery && !primaryOnly)
    const previousFallback = stageEmergency ? localStorage.getItem(FALLBACK_KEY) : null
    if (stageEmergency && !writeEmergency()) return { status: 'failed' }

    if (primary) {
      try {
        const archive = loaded.status === 'diverged'
          ? (current === loaded.primary ? loaded.fallback : loaded.primary)
          : undefined
        if (!(await transact(primary.copy.revision, next, archive))) {
          if (previousFallback !== null) localStorage.setItem(FALLBACK_KEY, previousFallback)
          return { status: 'conflict' }
        }
        if (fallback) {
          try {
            localStorage.removeItem(FALLBACK_KEY)
          } catch {
            if (!stageEmergency) writeEmergency()
          }
        }
        return { status: 'saved', copy: next, source: 'primary' }
      } catch {
        // A failed transaction leaves the primary at its old revision.
      }
    }

    if (recovery || primaryOnly) return { status: 'failed' }
    return stageEmergency || writeEmergency()
      ? { status: 'saved', copy: next, source: 'fallback' }
      : { status: 'failed' }
  }).catch(() => ({ status: 'failed' }))
}

export function notifyCommit(revision: string): void {
  try {
    localStorage.setItem(CHANGE_KEY, revision)
  } catch {
    // Tab focus also refreshes the snapshot.
  }
}

export function rememberTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // The theme still applies for the current session.
  }
}

