import type { Goal, Idea, Task, TrashEntry, TrashKind } from './types'
import { newId } from './utils'

/** Deleted things are only kept while they fit in this much space. */
export const TRASH_LIMIT_BYTES = 5 * 1024 * 1024

/** UTF-8 byte length, so the budget matches what storage actually holds. */
export function textBytes(value: string): number {
  let bytes = 0
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 0x80) {
      bytes += 1
    } else if (code < 0x800) {
      bytes += 2
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4
      index += 1
    } else {
      bytes += 3
    }
  }
  return bytes
}

function entryBytes(entry: TrashEntry): number {
  return textBytes(JSON.stringify(entry))
}

function makeEntry(
  kind: TrashKind,
  deletedAt: number,
  payload: Omit<TrashEntry, 'id' | 'kind' | 'deletedAt' | 'size'>,
): TrashEntry {
  const entry: TrashEntry = { id: newId(), kind, deletedAt, size: 0, ...payload }
  entry.size = entryBytes(entry)
  return entry
}

export function ideaTrashEntry(idea: Idea, now = Date.now()): TrashEntry {
  return makeEntry('idea', now, { idea })
}

export function goalTrashEntry(goal: Goal, now = Date.now()): TrashEntry {
  return makeEntry('goal', now, { goal })
}

export function taskTrashEntry(goal: Goal, task: Task, now = Date.now()): TrashEntry {
  return makeEntry('task', now, { task: { goalId: goal.id, goalTitle: goal.title, task } })
}

export function trashBytes(entries: TrashEntry[]): number {
  let total = 0
  for (const entry of entries) total += entry.size
  return total
}

/** True when accepting this entry would push the oldest ones out. */
export function trashWouldOverflow(entries: TrashEntry[], incoming: TrashEntry): boolean {
  return trashBytes(entries) + incoming.size > TRASH_LIMIT_BYTES
}

/**
 * Newest entries are at the front, so once the budget runs out everything
 * older falls away instead of leaving a gap in the middle of the list.
 */
export function trimTrash(entries: TrashEntry[]): TrashEntry[] {
  let total = 0
  const kept: TrashEntry[] = []
  for (const entry of entries) {
    if (total + entry.size > TRASH_LIMIT_BYTES) break
    total += entry.size
    kept.push(entry)
  }
  return kept
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(bytes, 0)} B`
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  }
  const mb = bytes / (1024 * 1024)
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`
}

export const TRASH_KIND_LABEL: Record<TrashKind, string> = {
  idea: '念头',
  goal: '目标',
  task: '一步',
}

export function trashTitle(entry: TrashEntry): string {
  if (entry.kind === 'idea') return entry.idea?.text ?? ''
  if (entry.kind === 'goal') return entry.goal?.title ?? ''
  return entry.task?.task.title ?? ''
}

export function trashNote(entry: TrashEntry): string {
  if (entry.kind === 'task' && entry.task) {
    return `在「${entry.task.goalTitle}」之下`
  }
  if (entry.kind === 'goal' && entry.goal) {
    const total = entry.goal.tasks.length
    return total ? `连同 ${total} 个步骤一起` : '还没有步骤'
  }
  return ''
}
