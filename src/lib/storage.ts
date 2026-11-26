import type {
  AppData,
  ComposerDraft,
  DeepSeekModel,
  DomainKey,
  Goal,
  GoalSort,
  Idea,
  IdeaSort,
  Preferences,
  Priority,
  Task,
  ThemeMode,
  TrashEntry,
} from './types'
import { toDateKey } from './date'
import { textBytes, trimTrash } from './trash'
import { newId } from './utils'

const DB_NAME = 'shiyan-local'
const DB_VERSION = 1
const STORE_NAME = 'journal'
const STATE_KEY = 'app-state'
const FALLBACK_KEY = 'shiyan:state-fallback'
const DRAFT_KEY = 'shiyan:composer-draft'
export const THEME_KEY = 'shiyan:theme'

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }
  if (!databasePromise) {
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Cannot open local database'))
      request.onblocked = () => reject(new Error('Local database is blocked'))
    }).catch((error) => {
      databasePromise = null
      throw error
    })
    databasePromise = pending
    return pending
  }
  return databasePromise
}

async function readDatabase(): Promise<unknown | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(STATE_KEY)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error ?? new Error('Cannot read local database'))
  })
}

async function writeDatabase(data: AppData): Promise<void> {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(data, STATE_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Cannot write local database'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Local write aborted'))
  })
}

export function defaultPreferences(): Preferences {
  return {
    apiKey: '',
    model: 'deepseek-flash',
    theme: 'system',
    ideaSort: 'recent',
    goalSort: 'due',
  }
}

export function createEmptyData(): AppData {
  return {
    version: 1,
    ideas: [],
    goals: [],
    favorites: [],
    trash: [],
    prefs: defaultPreferences(),
  }
}

export function rememberTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* Theme still applies for the current session. */
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const numberValue = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const nullableTimestamp = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const dateKeyValue = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value)
  return match ? value : null
}

export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of value) {
    if (typeof tag !== 'string') continue
    const cleaned = tag.replace(/\s+/g, ' ').trim().slice(0, 24)
    const lower = cleaned.toLocaleLowerCase('zh-CN')
    if (!cleaned || seen.has(lower)) continue
    seen.add(lower)
    result.push(cleaned)
    if (result.length >= 12) break
  }
  return result
}

const DOMAINS: DomainKey[] = ['work', 'study', 'health', 'life', 'create']
const PRIORITIES: Priority[] = ['high', 'normal', 'low']
const MODELS: DeepSeekModel[] = ['deepseek-flash', 'deepseek-v4-pro']
const THEMES: ThemeMode[] = ['system', 'light', 'dark']
const IDEA_SORTS: IdeaSort[] = ['recent', 'oldest']
const GOAL_SORTS: GoalSort[] = ['newest', 'due', 'progress']

function normalizePrefs(value: unknown, apiKeyOverride?: string): Preferences {
  const raw = isRecord(value) ? value : {}
  const apiKey =
    typeof apiKeyOverride === 'string'
      ? apiKeyOverride.slice(0, 512)
      : stringValue(raw.apiKey).trim().slice(0, 512)

  return {
    apiKey,
    model: MODELS.includes(raw.model as DeepSeekModel)
      ? (raw.model as DeepSeekModel)
      : 'deepseek-flash',
    theme: THEMES.includes(raw.theme as ThemeMode) ? (raw.theme as ThemeMode) : 'system',
    ideaSort: IDEA_SORTS.includes(raw.ideaSort as IdeaSort) ? (raw.ideaSort as IdeaSort) : 'recent',
    goalSort: GOAL_SORTS.includes(raw.goalSort as GoalSort) ? (raw.goalSort as GoalSort) : 'due',
  }
}

function normalizeTask(value: unknown, now: number, usedIds: Set<string>): Task | null {
  if (!isRecord(value)) return null
  const title = stringValue(value.title).trim().slice(0, 300)
  if (!title) return null
  let id = stringValue(value.id).slice(0, 80)
  if (!id || usedIds.has(id)) {
    id = newId()
  }
  usedIds.add(id)
  const createdAt = numberValue(value.createdAt, now)
  const done = Boolean(value.done)
  return {
    id,
    title,
    done,
    createdAt,
    updatedAt: numberValue(value.updatedAt, createdAt),
    completedAt: done ? nullableTimestamp(value.completedAt) ?? createdAt : null,
    dueDate: dateKeyValue(value.dueDate),
    priority: PRIORITIES.includes(value.priority as Priority)
      ? (value.priority as Priority)
      : 'normal',
  }
}

function normalizeGoal(value: unknown, now: number, usedIds: Set<string>): Goal | null {
  if (!isRecord(value)) return null
  const title = stringValue(value.title).trim().slice(0, 120)
  if (!title) return null
  let id = stringValue(value.id).slice(0, 80)
  if (!id || usedIds.has(id)) {
    id = newId()
  }
  usedIds.add(id)
  const createdAt = numberValue(value.createdAt, now)
  const tasks: Task[] = []
  const usedTaskIds = new Set<string>()
  if (Array.isArray(value.tasks)) {
    for (const entry of value.tasks.slice(0, 500)) {
      const task = normalizeTask(entry, now, usedTaskIds)
      if (task) tasks.push(task)
    }
  }
  return {
    id,
    title,
    why: stringValue(value.why).trim().slice(0, 1000),
    domain: DOMAINS.includes(value.domain as DomainKey) ? (value.domain as DomainKey) : 'life',
    dueDate: dateKeyValue(value.dueDate),
    createdAt,
    updatedAt: numberValue(value.updatedAt, createdAt),
    tasks,
  }
}

function normalizeIdea(value: unknown, now: number, usedIds: Set<string>): Idea | null {
  if (!isRecord(value)) return null
  const text = stringValue(value.text).replace(/\r\n/g, '\n').slice(0, 50000)
  if (!text.trim()) return null
  let id = stringValue(value.id).slice(0, 80)
  if (!id || usedIds.has(id)) {
    id = newId()
  }
  usedIds.add(id)
  const createdAt = numberValue(value.createdAt, now)
  const pinned = Boolean(value.pinned)
  return {
    id,
    text,
    tags: normalizeTags(value.tags),
    pinned,
    pinnedAt: pinned ? nullableTimestamp(value.pinnedAt) ?? createdAt : null,
    createdAt,
    updatedAt: numberValue(value.updatedAt, createdAt),
  }
}

function normalizeTrash(value: unknown, now: number): TrashEntry[] {
  if (!Array.isArray(value)) return []
  const usedIdeaIds = new Set<string>()
  const usedGoalIds = new Set<string>()
  const entries: TrashEntry[] = []

  for (const raw of value.slice(0, 400)) {
    if (!isRecord(raw)) continue
    const deletedAt = numberValue(raw.deletedAt, now)
    const id = stringValue(raw.id).slice(0, 80) || newId()
    const entry: TrashEntry = { id, kind: 'idea', deletedAt, size: 0 }

    if (raw.kind === 'idea') {
      const idea = normalizeIdea(raw.idea, now, usedIdeaIds)
      if (!idea) continue
      entry.kind = 'idea'
      entry.idea = idea
    } else if (raw.kind === 'goal') {
      const goal = normalizeGoal(raw.goal, now, usedGoalIds)
      if (!goal) continue
      entry.kind = 'goal'
      entry.goal = goal
    } else if (raw.kind === 'task' && isRecord(raw.task)) {
      const goalId = stringValue(raw.task.goalId).slice(0, 80)
      const task = normalizeTask(raw.task.task, now, new Set())
      if (!goalId || !task) continue
      entry.kind = 'task'
      entry.task = {
        goalId,
        goalTitle: stringValue(raw.task.goalTitle).slice(0, 120),
        task,
      }
    } else {
      continue
    }

    entry.size = textBytes(JSON.stringify(entry))
    entries.push(entry)
  }

  return trimTrash(entries)
}

export function normalizeAppData(
  value: unknown,
  options?: { apiKey?: string },
): { data: AppData; changedCount: number } | null {
  if (!isRecord(value)) return null
  if (!Array.isArray(value.ideas) || !Array.isArray(value.goals)) return null

  const now = Date.now()
  const usedIdeaIds = new Set<string>()
  const ideas: Idea[] = []
  for (const entry of value.ideas.slice(0, 5000)) {
    const idea = normalizeIdea(entry, now, usedIdeaIds)
    if (idea) ideas.push(idea)
  }

  const usedGoalIds = new Set<string>()
  const goals: Goal[] = []
  for (const entry of value.goals.slice(0, 1000)) {
    const goal = normalizeGoal(entry, now, usedGoalIds)
    if (goal) goals.push(goal)
  }

  const favorites = Array.isArray(value.favorites)
    ? [...new Set(value.favorites.filter((item): item is string => typeof item === 'string'))].slice(
        0,
        500,
      )
    : []

  const data: AppData = {
    version: 1,
    ideas,
    goals,
    favorites,
    trash: normalizeTrash(value.trash, now),
    prefs: normalizePrefs(value.prefs, options?.apiKey),
  }

  const originalIdeaTotal = Array.isArray(value.ideas) ? value.ideas.length : 0
  const originalGoalTotal = Array.isArray(value.goals) ? value.goals.length : 0
  const changedCount =
    Math.max(0, originalIdeaTotal - ideas.length) + Math.max(0, originalGoalTotal - goals.length)

  return { data, changedCount }
}

export async function loadState(): Promise<AppData | null> {
  let raw: unknown = null
  try {
    raw = await readDatabase()
  } catch {
    /* Try the emergency localStorage copy below. */
  }

  if (!raw) {
    try {
      const fallback = localStorage.getItem(FALLBACK_KEY)
      if (fallback) raw = JSON.parse(fallback) as unknown
    } catch {
      raw = null
    }
  }

  if (!raw) return null
  const normalized = normalizeAppData(raw)
  return normalized?.data ?? null
}

export async function saveState(data: AppData): Promise<void> {
  try {
    await writeDatabase(data)
  } catch (error) {
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(data))
    } catch {
      throw error
    }
  }
}

export function loadDraft(): ComposerDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value)) return null
    const text = stringValue(value.text)
    if (!text.trim()) return null
    return {
      text,
      tags: normalizeTags(value.tags),
      updatedAt: numberValue(value.updatedAt, Date.now()),
    }
  } catch {
    return null
  }
}

export function saveDraft(draft: ComposerDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* A draft is a convenience; committed ideas remain saved. */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* Nothing else to do. */
  }
}

export interface BackupFile {
  app: 'shiyan'
  version: 1
  exportedAt: string
  data: AppData
}

export function createBackup(data: AppData): BackupFile {
  return {
    app: 'shiyan',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      ...data,
      prefs: {
        ...data.prefs,
        apiKey: '',
      },
    },
  }
}

export function backupFilename(): string {
  return `shiyan-${toDateKey()}.json`
}

export interface ImportedBackup {
  data: AppData
  droppedCount: number
  exportedAt: string | null
}

export function parseBackup(text: string, currentApiKey: string): ImportedBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error('这个文件不是有效的 JSON。')
  }
  if (!isRecord(parsed)) throw new Error('备份内容无法识别。')

  const wrapped = isRecord(parsed.data) ? parsed.data : parsed
  const normalized = normalizeAppData(wrapped, { apiKey: currentApiKey })
  if (!normalized) throw new Error('这份文件不像拾焰的备份，缺少念头或目标数据。')

  const exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null
  return {
    data: normalized.data,
    droppedCount: normalized.changedCount,
    exportedAt,
  }
}

export function downloadBackup(data: AppData): void {
  const backup = createBackup(data)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = backupFilename()
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export { newId } from './utils'

