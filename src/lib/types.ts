export type DomainKey = 'work' | 'study' | 'health' | 'life' | 'create'
export type Priority = 'high' | 'normal' | 'low'
export type IdeaSort = 'recent' | 'oldest'
export type GoalSort = 'newest' | 'due' | 'progress'
export type ThemeMode = 'system' | 'light' | 'dark'
export type DeepSeekModel = 'deepseek-flash' | 'deepseek-v4-pro'

export interface Idea {
  id: string
  text: string
  tags: string[]
  pinned: boolean
  pinnedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Task {
  id: string
  title: string
  done: boolean
  createdAt: number
  updatedAt: number
  completedAt: number | null
  dueDate: string | null
  priority: Priority
}

export interface Goal {
  id: string
  title: string
  why: string
  domain: DomainKey
  dueDate: string | null
  createdAt: number
  updatedAt: number
  tasks: Task[]
}

export interface Preferences {
  apiKey: string
  model: DeepSeekModel
  theme: ThemeMode
  ideaSort: IdeaSort
  goalSort: GoalSort
}

export type TrashKind = 'idea' | 'goal' | 'task'

/**
 * One deleted thing, kept whole so restoring never has to rebuild it. `size`
 * is the entry's own approximate footprint, so the list can stay under its
 * byte budget without serialising everything on every render.
 */
export interface TrashEntry {
  id: string
  kind: TrashKind
  deletedAt: number
  size: number
  idea?: Idea
  goal?: Goal
  task?: { goalId: string; goalTitle: string; task: Task }
}

export interface AppData {
  version: 1
  ideas: Idea[]
  goals: Goal[]
  favorites: string[]
  trash: TrashEntry[]
  prefs: Preferences
}

export interface ComposerDraft {
  text: string
  tags: string[]
  updatedAt: number
}

export type AppAction =
  | { type: 'hydrate'; data: AppData }
  | { type: 'idea/add'; idea: Idea }
  | { type: 'idea/update'; id: string; patch: Partial<Pick<Idea, 'text' | 'tags'>> }
  | { type: 'idea/togglePin'; id: string; now: number }
  | { type: 'idea/delete'; id: string }
  | { type: 'idea/restore'; idea: Idea }
  | { type: 'goal/add'; goal: Goal }
  | { type: 'goal/update'; id: string; patch: Partial<Pick<Goal, 'title' | 'why' | 'domain' | 'dueDate'>> }
  | { type: 'goal/delete'; id: string }
  | { type: 'goal/restore'; goal: Goal }
  | { type: 'task/add'; goalId: string; task: Task }
  | { type: 'task/update'; goalId: string; taskId: string; patch: Partial<Pick<Task, 'title' | 'dueDate' | 'priority'>> }
  | { type: 'task/toggle'; goalId: string; taskId: string; now: number }
  | { type: 'task/delete'; goalId: string; taskId: string }
  | { type: 'task/restore'; goalId: string; task: Task }
  | { type: 'prefs/update'; patch: Partial<Preferences> }
  | { type: 'favorite/toggle'; id: string }
  | { type: 'trash/add'; entry: TrashEntry }
  | { type: 'trash/restore'; entryId: string }
  | { type: 'trash/purge'; entryId: string }
  | { type: 'trash/clear' }
  | { type: 'data/replace'; data: AppData }
  | { type: 'data/reset'; data: AppData }
