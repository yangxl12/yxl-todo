import type { Goal, Priority, Task } from '../../lib/types'
import { toDateKey } from '../../lib/date'

const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 }

export function isGoalComplete(goal: Goal): boolean {
  return goal.tasks.length > 0 && goal.tasks.every((task) => task.done)
}

export function goalProgress(goal: Goal): number {
  if (!goal.tasks.length) return 0
  return goal.tasks.filter((task) => task.done).length / goal.tasks.length
}

export function completedTaskCount(goal: Goal): number {
  return goal.tasks.filter((task) => task.done).length
}

export function latestCompletion(goal: Goal): number {
  return Math.max(
    ...goal.tasks.map((task) => task.completedAt ?? 0),
    goal.createdAt,
  )
}

export function orderOpenTasks(tasks: Task[]): Task[] {
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

export function orderDoneTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
}

export function goalTaskCounts(goals: Goal[]): { total: number; done: number } {
  let total = 0
  let done = 0
  for (const goal of goals) {
    total += goal.tasks.length
    done += goal.tasks.filter((task) => task.done).length
  }
  return { total, done }
}

export interface DueTaskEntry {
  goal: Goal
  task: Task
}

export function getTodayEntries(goals: Goal[]): DueTaskEntry[] {
  const today = toDateKey()
  const entries: DueTaskEntry[] = []
  for (const goal of goals) {
    if (isGoalComplete(goal)) continue
    for (const task of goal.tasks) {
      if (!task.done && task.dueDate && task.dueDate <= today) {
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
