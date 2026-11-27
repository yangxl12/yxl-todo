import type { Goal, GoalSort, Priority, Task } from '../../lib/types'
import { parseDateKey, toDateKey } from '../../lib/date'

const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 }

export interface GoalStats {
  total: number
  done: number
  complete: boolean
  progress: number
}

/** One pass over a goal's tasks; cards and sorting both read from this. */
export function goalStats(goal: Goal): GoalStats {
  const total = goal.tasks.length
  let done = 0
  for (const task of goal.tasks) {
    if (task.done) done += 1
  }
  return {
    total,
    done,
    complete: total > 0 && done === total,
    progress: total ? done / total : 0,
  }
}

export function latestCompletion(goal: Goal): number {
  let latest = goal.createdAt
  for (const task of goal.tasks) {
    const completedAt = task.completedAt ?? 0
    if (completedAt > latest) latest = completedAt
  }
  return latest
}

/** Order steps by due date, then priority, then age — `done` is ignored so a
 *  ticked step keeps its slot instead of jumping to the bottom. */
export function orderTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    }
    if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    return a.createdAt - b.createdAt
  })
}

export function goalTaskCounts(goals: Goal[]): { total: number; done: number } {
  let total = 0
  let done = 0
  for (const goal of goals) {
    total += goal.tasks.length
    for (const task of goal.tasks) {
      if (task.done) done += 1
    }
  }
  return { total, done }
}

export interface DueTaskEntry {
  goal: Goal
  task: Task
}

export function getTodayEntries(goals: Goal[], day: Date): DueTaskEntry[] {
  const today = toDateKey(day)
  const entries: DueTaskEntry[] = []
  for (const goal of goals) {
    if (!goal.tasks.length) continue
    let open = 0
    for (const task of goal.tasks) {
      if (!task.done) open += 1
    }
    if (open === 0) continue
    for (const task of goal.tasks) {
      if (!task.done && task.dueDate && task.dueDate <= today && parseDateKey(task.dueDate)) {
        entries.push({ goal, task })
      }
    }
  }
  entries.sort((a, b) => {
    const dueCompare = (a.task.dueDate ?? '').localeCompare(b.task.dueDate ?? '')
    if (dueCompare !== 0) return dueCompare
    return PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority]
  })
  return entries
}

function sortActiveGoals(
  goals: Goal[],
  sort: GoalSort,
  stats: Map<string, GoalStats>,
): Goal[] {
  const progressOf = (goal: Goal) => stats.get(goal.id)?.progress ?? 0
  return [...goals].sort((a, b) => {
    if (sort === 'due') {
      if (a.dueDate !== b.dueDate) {
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      }
      return b.createdAt - a.createdAt
    }
    if (sort === 'progress') {
      const diff = progressOf(b) - progressOf(a)
      if (diff !== 0) return diff
      return b.createdAt - a.createdAt
    }
    return b.createdAt - a.createdAt
  })
}

export function groupGoals(goals: Goal[], sort: GoalSort) {
  const active: Goal[] = []
  const completed: Goal[] = []
  const stats = new Map<string, GoalStats>()
  const completion = new Map<string, number>()
  for (const goal of goals) {
    const entry = goalStats(goal)
    stats.set(goal.id, entry)
    if (entry.complete) {
      completed.push(goal)
      completion.set(goal.id, latestCompletion(goal))
    } else active.push(goal)
  }
  completed.sort((a, b) => (completion.get(b.id) ?? 0) - (completion.get(a.id) ?? 0))
  return { active: sortActiveGoals(active, sort, stats), completed }
}
