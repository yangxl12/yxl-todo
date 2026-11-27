import { parseDateKey } from './date'
import { DEEPSEEK_MODELS, DEFAULT_MODEL } from './models'
import type { AppData, Goal, Idea, Preferences, Task, TrashEntry } from './types'
import { newId } from './utils'
import { measureTrashEntry } from './trash'

export function defaultPreferences(): Preferences {
  return { apiKey: '', model: DEFAULT_MODEL, theme: 'system', ideaSort: 'recent', goalSort: 'due' }
}

export function createEmptyData(): AppData {
  return { version: 1, ideas: [], goals: [], favorites: [], trash: [], prefs: defaultPreferences() }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

type Raw = Record<string, unknown>
type Collection = 'ideas' | 'goals' | 'tasks' | 'favorites' | 'trash' | 'preferences'
type Repair = 'dropped' | 'repaired'
export type BackupChanges = Partial<Record<Collection, Partial<Record<Repair, number>>>>
const isText = (value: unknown): value is string => typeof value === 'string'
const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8.64e15
const isDomain = (value: unknown) => ['work', 'study', 'health', 'life', 'create'].includes(String(value))
const isPriority = (value: unknown) => ['high', 'normal', 'low'].includes(String(value))

// Stored snapshots must decode without destructive repair. A backup preview may
// report repairs, and the user can confirm them before replacing any data.
function decode(value: unknown, changes?: BackupChanges): AppData {
  if (!isRecord(value) || !Array.isArray(value.ideas) || !Array.isArray(value.goals)) {
    throw new Error('这份数据缺少念头或目标列表。')
  }
  if (value.version !== undefined && value.version !== 1) {
    throw new Error('不支持这个数据版本。')
  }
  const legacy = value.version === undefined
  const isDueDate = (value: unknown) => value === null || (isText(value) &&
    (changes ? parseDateKey(value) !== null : /^\d{4}-\d{2}-\d{2}$/.test(value)))

  const report = (group: Collection, change: Repair) => {
    if (!changes) throw new Error('本地数据有无法读取的记录。')
    const counts = (changes[group] ??= {})
    counts[change] = (counts[change] ?? 0) + 1
  }

  function fields<T>(raw: Raw, group: Collection, defaults: Raw, valid: Record<string, (v: unknown) => boolean>): T {
    let repaired = false
    const result = { ...raw }
    for (const [field, check] of Object.entries(valid)) {
      if (check(raw[field])) continue
      if (!legacy || raw[field] !== undefined) repaired = true
      result[field] = defaults[field]
    }
    if (repaired) report(group, 'repaired')
    return result as T
  }

  function records<T extends { id: string }>(
    raw: unknown,
    group: Collection,
    read: (record: Raw) => T | null,
  ): T[] {
    if (!Array.isArray(raw)) {
      // The first v1 release did not persist a trash collection.
      if (raw !== undefined || (!legacy && group !== 'trash')) report(group, 'repaired')
      return []
    }
    const result: T[] = []
    // Reserve existing ids before assigning replacements to malformed records.
    const reserved = new Set(raw.filter(isRecord).map((item) => item.id))
    const seen = new Set<string>()
    for (const item of raw) {
      const record = isRecord(item) ? read(item) : null
      if (!record) {
        report(group, 'dropped')
        continue
      }
      if (!isText(record.id) || !record.id.trim() || seen.has(record.id)) {
        report(group, 'repaired')
        let id = newId()
        while (reserved.has(id) || seen.has(id)) id = newId()
        record.id = id
      }
      seen.add(record.id)
      result.push(record)
    }
    return result
  }

  const timestamps = { createdAt: isTime, updatedAt: isTime }
  const dateDefaults = (raw: Raw) => ({ createdAt: 0, updatedAt: isTime(raw.createdAt) ? raw.createdAt : 0 })

  const readIdea = (raw: Raw): Idea | null => {
    if (!isText(raw.text) || !raw.text.trim()) return null
    return fields<Idea>(raw, 'ideas', {
      ...dateDefaults(raw), tags: [], pinned: false, pinnedAt: raw.pinned ? dateDefaults(raw).updatedAt : null,
    }, { ...timestamps, tags: (v) => Array.isArray(v) && v.every(isText),
      pinned: (v) => typeof v === 'boolean', pinnedAt: (v) => v === null || isTime(v),
    })
  }

  const readTask = (raw: Raw): Task | null => {
    if (!isText(raw.title) || !raw.title.trim()) return null
    return fields<Task>(raw, 'tasks', {
      ...dateDefaults(raw), done: false, completedAt: raw.done ? dateDefaults(raw).updatedAt : null,
      dueDate: null, priority: 'normal',
    }, { ...timestamps, done: (v) => typeof v === 'boolean',
      completedAt: (v) => v === null || isTime(v), dueDate: isDueDate, priority: isPriority,
    })
  }

  const readGoal = (raw: Raw): Goal | null => {
    if (!isText(raw.title) || !raw.title.trim()) return null
    return fields<Goal>({ ...raw, tasks: records(raw.tasks, 'tasks', readTask) }, 'goals', {
      ...dateDefaults(raw), why: '', domain: 'life', dueDate: null,
    }, { ...timestamps, why: isText, domain: isDomain, dueDate: isDueDate })
  }

  const readTrash = (raw: Raw): TrashEntry | null => {
    let payload: Partial<TrashEntry>
    if (raw.kind === 'idea' && isRecord(raw.idea)) {
      const idea = readIdea(raw.idea)
      if (!idea || !isText(idea.id) || !idea.id.trim()) return null
      payload = { idea }
    } else if (raw.kind === 'goal' && isRecord(raw.goal)) {
      const goal = readGoal(raw.goal)
      if (!goal || !isText(goal.id) || !goal.id.trim()) return null
      payload = { goal }
    } else if (raw.kind === 'task' && isRecord(raw.task) && isRecord(raw.task.task)) {
      const task = readTask(raw.task.task)
      if (!task || !isText(task.id) || !task.id.trim() || !isText(raw.task.goalId) || !raw.task.goalId) return null
      payload = { task: fields({ ...raw.task, task }, 'trash', { goalTitle: '' }, { goalTitle: isText }) }
    } else {
      return null
    }
    const entry = fields<TrashEntry>({ ...raw, ...payload }, 'trash',
      { deletedAt: 0, size: 0 }, { deletedAt: isTime, size: (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 })
    if (entry.size === 0 && changes) entry.size = measureTrashEntry(entry)
    return entry
  }

  const favorites = new Set<string>()
  if (Array.isArray(value.favorites)) {
    for (const item of value.favorites) {
      if (!isText(item) || favorites.has(item)) report('favorites', 'dropped')
      else favorites.add(item)
    }
  } else if (!legacy || value.favorites !== undefined) report('favorites', 'repaired')

  const defaults = defaultPreferences()
  const prefs = fields<Preferences>(isRecord(value.prefs) ? value.prefs : {}, 'preferences', { ...defaults }, {
    apiKey: isText,
    model: (v) => DEEPSEEK_MODELS.some((model) => model.value === v),
    theme: (v) => v === 'system' || v === 'light' || v === 'dark',
    ideaSort: (v) => v === 'recent' || v === 'oldest',
    goalSort: (v) => v === 'due' || v === 'newest' || v === 'progress',
  })

  return {
    version: 1,
    ideas: records(value.ideas, 'ideas', readIdea),
    goals: records(value.goals, 'goals', readGoal),
    favorites: [...favorites],
    trash: records(value.trash, 'trash', readTrash),
    prefs,
  }
}

export function decodeLocalData(value: unknown): AppData {
  return decode(value)
}

export function decodeBackupData(value: unknown): { data: AppData; changes: BackupChanges } {
  const changes: BackupChanges = {}
  return { data: decode(value, changes), changes }
}
