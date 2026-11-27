import { isRecord } from './dataFormat'
import type { AppAction } from './types'
import { newId } from './utils'

const SESSION_KEY = 'shiyan:journal-owner'
const PREFIX = 'shiyan:pending/'

export interface Change {
  action: AppAction
  now: number
}

export interface EditJournal {
  base: string
  changes: Change[]
  order?: number
  attempt?: { revision: string; count: number }
}

function read(raw: string | null): EditJournal | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || typeof value.base !== 'string' || !Array.isArray(value.changes) ||
      !value.changes.every((item) => isRecord(item) && typeof item.now === 'number' &&
        isRecord(item.action) && typeof item.action.type === 'string')) return null
    if (value.attempt && (!isRecord(value.attempt) || typeof value.attempt.revision !== 'string' ||
      !Number.isSafeInteger(value.attempt.count) || Number(value.attempt.count) < 1 ||
      Number(value.attempt.count) > value.changes.length)) return null
    return value as unknown as EditJournal
  } catch {
    return null
  }
}

let active: ReturnType<typeof openEditJournal> | undefined

export function getEditJournal() {
  return active ??= openEditJournal()
}

function openEditJournal() {
  const key = PREFIX + newId()
  let order = 0
  let previousKey: string | null = null
  let previous: EditJournal | null = null
  try {
    const storedKey = sessionStorage.getItem(SESSION_KEY)
    // A newly opened tab can inherit a copy of its opener's sessionStorage.
    if (storedKey?.startsWith(PREFIX) &&
      performance.getEntriesByType('navigation').some((entry) =>
        (entry as PerformanceNavigationTiming).type !== 'navigate')) {
      previousKey = storedKey
      const sessionCopy = read(sessionStorage.getItem(previousKey))
      let localCopy: EditJournal | null = null
      try {
        localCopy = read(localStorage.getItem(previousKey))
      } catch {
        // The current session may still have a copy.
      }
      previous = localCopy && (localCopy.order ?? 0) >= (sessionCopy?.order ?? 0)
        ? localCopy : sessionCopy
    }
    sessionStorage.setItem(SESSION_KEY, key)
  } catch {
    // Editing and IndexedDB still work if browser storage is restricted.
  }

  if (navigator.locks) {
    void navigator.locks.request(key, () => new Promise<void>(() => {})).catch(() => {})
  }

  function remember(journal: EditJournal | null): boolean {
    let saved = false
    const raw = journal && JSON.stringify({ ...journal, order: ++order })
    for (const layer of ['localStorage', 'sessionStorage'] as const) {
      try {
        const storage = window[layer]
        if (raw !== null) storage.setItem(key, raw)
        else storage.removeItem(key)
        saved = true
      } catch {
        // The other layer may still be available.
      }
    }
    return saved
  }

  function archive(journal: EditJournal): string | null {
    try {
      const backupKey = PREFIX + newId()
      localStorage.setItem(backupKey, JSON.stringify(journal))
      return backupKey
    } catch {
      return null
    }
  }

  function remove(savedKey: string) {
    if (savedKey === previousKey) {
      previousKey = null
      previous = null
    }
    for (const layer of ['localStorage', 'sessionStorage'] as const) {
      try {
        window[layer].removeItem(savedKey)
      } catch {
        // The saved revision is checked again if a leftover journal is found.
      }
    }
  }

  async function abandoned() {
    const journals: Array<{ key: string; journal: EditJournal }> = []
    if (!navigator.locks) return journals
    try {
      const { held = [], pending = [] } = await navigator.locks.query()
      const activeKeys = new Set([...held, ...pending].map((lock) => lock.name))
      for (let index = 0; index < localStorage.length; index += 1) {
        const savedKey = localStorage.key(index)
        if (!savedKey?.startsWith(PREFIX) || savedKey === key || activeKeys.has(savedKey)) continue
        const journal = read(localStorage.getItem(savedKey))
        if (journal?.changes.length) journals.push({ key: savedKey, journal })
      }
    } catch {
      // Ignore an unavailable recovery layer.
    }
    return journals
  }

  return {
    get previous() { return previous },
    get previousKey() { return previousKey },
    remember, archive, remove, abandoned,
  }
}
