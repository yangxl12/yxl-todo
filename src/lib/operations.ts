import type { AppAction, AppData, Goal, TrashEntry, TrashTarget } from './types'
import { measureTrashEntry, TRASH_LIMIT_BYTES, trimTrash } from './trash'

function replaceAt<T>(items: T[], index: number, next: T): T[] {
  const result = items.slice()
  result[index] = next
  return result
}

function patchFields<T extends object>(value: T, patch: Partial<NoInfer<T>>): T {
  return Object.entries(patch).every(([key, next]) => {
    const previous = value[key as keyof T]
    return Object.is(previous, next) || (Array.isArray(previous) && Array.isArray(next) &&
      previous.length === next.length && previous.every((item, index) => item === next[index]))
  }) ? value : { ...value, ...patch }
}

function editGoal(state: AppData, id: string, now: number, edit: (goal: Goal) => Goal): AppData {
  const index = state.goals.findIndex((goal) => goal.id === id)
  if (index === -1) return state
  const current = state.goals[index]
  const next = edit(current)
  if (next === current) return state
  return { ...state, goals: replaceAt(state.goals, index, { ...next, updatedAt: now }) }
}

type DataResult<T extends { status: string }> = { data: AppData } & T

export type DeleteResult =
  | { status: 'deleted'; entryId: string; evicted: number }
  | { status: 'too-large' | 'missing' | 'busy' | 'failed' }

export function moveToTrash(
  state: AppData, target: TrashTarget, entryId: string, now: number,
): DataResult<DeleteResult> {
  let payload: Partial<TrashEntry>
  let remove: () => AppData
  if (target.kind === 'idea') {
    const idea = state.ideas.find((item) => item.id === target.id)
    if (!idea) return { data: state, status: 'missing' }
    payload = { idea }
    remove = () => ({ ...state, ideas: state.ideas.filter((item) => item !== idea) })
  } else if (target.kind === 'goal') {
    const goal = state.goals.find((item) => item.id === target.id)
    if (!goal) return { data: state, status: 'missing' }
    payload = { goal }
    remove = () => ({ ...state, goals: state.goals.filter((item) => item !== goal) })
  } else {
    const goal = state.goals.find((item) => item.id === target.goalId)
    const task = goal?.tasks.find((item) => item.id === target.id)
    if (!goal || !task) return { data: state, status: 'missing' }
    payload = { task: { goalId: goal.id, goalTitle: goal.title, task } }
    remove = () => editGoal(state, goal.id, now, (item) => ({
      ...item, tasks: item.tasks.filter((step) => step !== task),
    }))
  }
  const entry: TrashEntry = { id: entryId, kind: target.kind, deletedAt: now, size: 0, ...payload }
  entry.size = measureTrashEntry(entry)
  if (entry.size > TRASH_LIMIT_BYTES) return { data: state, status: 'too-large' }
  const trash = trimTrash([entry, ...state.trash])
  return {
    data: { ...remove(), trash }, status: 'deleted', entryId, evicted: state.trash.length + 1 - trash.length,
  }
}

export type RestoreStatus = 'restored' | 'missing' | 'parent-missing' | 'duplicate' | 'busy' | 'failed'

export function restoreFromTrash(state: AppData, entryId: string, now: number): {
  data: AppData
  status: RestoreStatus
} {
  const entry = state.trash.find((item) => item.id === entryId)
  if (!entry) return { data: state, status: 'missing' }
  const trash = state.trash.filter((item) => item !== entry)
  if (entry.kind === 'idea' && entry.idea) {
    const idea = entry.idea
    if (state.ideas.some((item) => item.id === idea.id)) return { data: state, status: 'duplicate' }
    return { data: { ...state, ideas: [idea, ...state.ideas], trash }, status: 'restored' }
  }
  if (entry.kind === 'goal' && entry.goal) {
    const goal = entry.goal
    if (state.goals.some((item) => item.id === goal.id)) return { data: state, status: 'duplicate' }
    return { data: { ...state, goals: [goal, ...state.goals], trash }, status: 'restored' }
  }
  if (entry.kind === 'task' && entry.task) {
    const { goalId, task } = entry.task
    const goal = state.goals.find((item) => item.id === goalId)
    if (!goal) return { data: state, status: 'parent-missing' }
    if (goal.tasks.some((item) => item.id === task.id)) return { data: state, status: 'duplicate' }
    const next = editGoal(state, goalId, now, (item) => ({ ...item, tasks: [...item.tasks, task] }))
    return { data: { ...next, trash }, status: 'restored' }
  }
  return { data: state, status: 'missing' }
}

export function reduceData(state: AppData, action: AppAction, now: number): AppData {
  switch (action.type) {
    case 'prefs/update': {
      const prefs = patchFields(state.prefs, action.patch)
      return prefs === state.prefs ? state : { ...state, prefs }
    }
    case 'idea/add':
      return state.ideas.some((idea) => idea.id === action.idea.id) ? state
        : { ...state, ideas: [action.idea, ...state.ideas] }
    case 'idea/update':
    case 'idea/togglePin': {
      const index = state.ideas.findIndex((idea) => idea.id === action.id)
      if (index === -1) return state
      const idea = state.ideas[index]
      const next = action.type === 'idea/update'
        ? patchFields(idea, action.patch)
        : { ...idea, pinned: !idea.pinned, pinnedAt: idea.pinned ? null : now }
      return next === idea ? state : { ...state, ideas: replaceAt(state.ideas, index, { ...next, updatedAt: now }) }
    }
    case 'idea/undoAdd': {
      const original = action.idea
      const idea = state.ideas.find((item) => item.id === original.id)
      if (!idea || idea.updatedAt !== original.updatedAt || patchFields(idea, original) !== idea) return state
      return { ...state, ideas: state.ideas.filter((item) => item !== idea) }
    }
    case 'goal/add':
      return state.goals.some((goal) => goal.id === action.goal.id) ? state
        : { ...state, goals: [action.goal, ...state.goals] }
    case 'goal/update':
      return editGoal(state, action.id, now, (goal) => patchFields(goal, action.patch))
    case 'task/add':
      return editGoal(state, action.goalId, now, (goal) => goal.tasks.some((task) => task.id === action.task.id)
        ? goal : { ...goal, tasks: [...goal.tasks, action.task] })
    case 'task/update':
    case 'task/toggle':
    case 'task/undoComplete':
      return editGoal(state, action.goalId, now, (goal) => {
        const index = goal.tasks.findIndex((task) => task.id === action.taskId)
        if (index === -1) return goal
        const task = goal.tasks[index]
        if (action.type === 'task/undoComplete' && (!task.done || task.completionId !== action.completionId)) return goal
        const next = action.type === 'task/update' ? patchFields(task, action.patch) : {
          ...task,
          done: !task.done,
          completedAt: task.done ? null : now,
          completionId: task.done ? null : action.completionId,
        }
        return next === task ? goal : { ...goal, tasks: replaceAt(goal.tasks, index, { ...next, updatedAt: now }) }
      })
    case 'favorite/toggle':
      return {
        ...state,
        favorites: state.favorites.includes(action.id)
          ? state.favorites.filter((id) => id !== action.id)
          : [...state.favorites, action.id],
      }
    case 'trash/delete':
      return moveToTrash(state, action.target, action.entryId, now).data
    case 'trash/purge':
      return state.trash.some((entry) => entry.id === action.entryId)
        ? { ...state, trash: state.trash.filter((entry) => entry.id !== action.entryId) } : state
    case 'trash/clear':
      return state.trash.length ? { ...state, trash: [] } : state
    case 'trash/restore':
      return restoreFromTrash(state, action.entryId, now).data
    default:
      return state
  }
}
