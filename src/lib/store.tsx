import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppAction, AppData, Preferences } from './types'
import { createEmptyData, loadState, saveState } from './storage'
import { trimTrash } from './trash'

interface AppContextValue {
  data: AppData
  dispatch: React.Dispatch<AppAction>
  ready: boolean
  saveFailed: boolean
  flushSave: () => void
  dismissSaveWarning: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

function touchGoal(goals: AppData['goals'], goalId: string): AppData['goals'] {
  return goals.map((goal) =>
    goal.id === goalId ? { ...goal, updatedAt: Date.now() } : goal,
  )
}

function reducer(state: AppData, action: AppAction): AppData {
  switch (action.type) {
    case 'hydrate':
      return action.data
    case 'data/replace':
    case 'data/reset':
      return action.data
    case 'prefs/update': {
      const patch = action.patch as Partial<Preferences>
      return { ...state, prefs: { ...state.prefs, ...patch } }
    }
    case 'idea/add':
      return { ...state, ideas: [action.idea, ...state.ideas] }
    case 'idea/update': {
      const now = Date.now()
      return {
        ...state,
        ideas: state.ideas.map((idea) =>
          idea.id === action.id ? { ...idea, ...action.patch, updatedAt: now } : idea,
        ),
      }
    }
    case 'idea/togglePin': {
      const target = state.ideas.find((idea) => idea.id === action.id)
      const willPin = !target?.pinned
      return {
        ...state,
        ideas: state.ideas.map((idea) =>
          idea.id === action.id
            ? {
                ...idea,
                pinned: willPin,
                pinnedAt: willPin ? action.now : null,
                updatedAt: action.now,
              }
            : idea,
        ),
      }
    }
    case 'idea/delete':
      return { ...state, ideas: state.ideas.filter((idea) => idea.id !== action.id) }
    case 'idea/restore':
      return {
        ...state,
        ideas: state.ideas.some((idea) => idea.id === action.idea.id)
          ? state.ideas
          : [action.idea, ...state.ideas],
      }
    case 'goal/add':
      return { ...state, goals: [action.goal, ...state.goals] }
    case 'goal/update': {
      const now = Date.now()
      return {
        ...state,
        goals: state.goals.map((goal) =>
          goal.id === action.id ? { ...goal, ...action.patch, updatedAt: now } : goal,
        ),
      }
    }
    case 'goal/delete':
      return { ...state, goals: state.goals.filter((goal) => goal.id !== action.id) }
    case 'goal/restore':
      return {
        ...state,
        goals: state.goals.some((goal) => goal.id === action.goal.id)
          ? state.goals
          : [action.goal, ...state.goals],
      }
    case 'task/add':
      return {
        ...state,
        goals: touchGoal(state.goals, action.goalId).map((goal) =>
          goal.id === action.goalId ? { ...goal, tasks: [...goal.tasks, action.task] } : goal,
        ),
      }
    case 'task/update':
      return {
        ...state,
        goals: touchGoal(state.goals, action.goalId).map((goal) =>
          goal.id === action.goalId
            ? {
                ...goal,
                tasks: goal.tasks.map((task) =>
                  task.id === action.taskId
                    ? { ...task, ...action.patch, updatedAt: Date.now() }
                    : task,
                ),
              }
            : goal,
        ),
      }
    case 'task/toggle':
      return {
        ...state,
        goals: touchGoal(state.goals, action.goalId).map((goal) =>
          goal.id === action.goalId
            ? {
                ...goal,
                tasks: goal.tasks.map((task) => {
                  if (task.id !== action.taskId) return task
                  const done = !task.done
                  return {
                    ...task,
                    done,
                    completedAt: done ? action.now : null,
                    updatedAt: action.now,
                  }
                }),
              }
            : goal,
        ),
      }
    case 'task/delete':
      return {
        ...state,
        goals: touchGoal(state.goals, action.goalId).map((goal) =>
          goal.id === action.goalId
            ? { ...goal, tasks: goal.tasks.filter((task) => task.id !== action.taskId) }
            : goal,
        ),
      }
    case 'task/restore':
      return {
        ...state,
        goals: touchGoal(state.goals, action.goalId).map((goal) =>
          goal.id === action.goalId && !goal.tasks.some((task) => task.id === action.task.id)
            ? { ...goal, tasks: [...goal.tasks, action.task] }
            : goal,
        ),
      }
    case 'favorite/toggle':
      return {
        ...state,
        favorites: state.favorites.includes(action.id)
          ? state.favorites.filter((id) => id !== action.id)
          : [...state.favorites, action.id],
      }
    case 'trash/add':
      return { ...state, trash: trimTrash([action.entry, ...state.trash]) }
    case 'trash/purge':
      return { ...state, trash: state.trash.filter((entry) => entry.id !== action.entryId) }
    case 'trash/clear':
      return { ...state, trash: [] }
    case 'trash/restore': {
      const entry = state.trash.find((item) => item.id === action.entryId)
      if (!entry) return state
      const rest = state.trash.filter((item) => item.id !== action.entryId)

      if (entry.kind === 'idea' && entry.idea) {
        const idea = entry.idea
        if (state.ideas.some((item) => item.id === idea.id)) return { ...state, trash: rest }
        return { ...state, ideas: [idea, ...state.ideas], trash: rest }
      }

      if (entry.kind === 'goal' && entry.goal) {
        const goal = entry.goal
        if (state.goals.some((item) => item.id === goal.id)) return { ...state, trash: rest }
        return { ...state, goals: [goal, ...state.goals], trash: rest }
      }

      if (entry.kind === 'task' && entry.task) {
        const { goalId, task } = entry.task
        const goal = state.goals.find((item) => item.id === goalId)
        // The goal it belonged to is gone; leave the step in the trash rather
        // than inventing a new home for it.
        if (!goal || goal.tasks.some((item) => item.id === task.id)) {
          return goal ? { ...state, trash: rest } : state
        }
        return {
          ...state,
          goals: state.goals.map((item) =>
            item.id === goalId
              ? { ...item, tasks: [...item.tasks, task], updatedAt: Date.now() }
              : item,
          ),
          trash: rest,
        }
      }

      return state
    }
    default:
      return state
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, createEmptyData)
  const [ready, setReady] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const latestData = useRef(data)
  const writeQueue = useRef<Promise<void>>(Promise.resolve())
  const saveTimer = useRef<number | null>(null)

  latestData.current = data

  useEffect(() => {
    let alive = true
    loadState()
      .then((saved) => {
        if (!alive) return
        if (saved) dispatch({ type: 'hydrate', data: saved })
        setReady(true)
      })
      .catch(() => {
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const enqueueSave = useCallback((snapshot: AppData) => {
    writeQueue.current = writeQueue.current
      .catch(() => undefined)
      .then(() => saveState(snapshot))
      .then(
        () => setSaveFailed(false),
        () => setSaveFailed(true),
      )
  }, [])

  const flushSave = useCallback(() => {
    if (!ready) return
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    enqueueSave(latestData.current)
  }, [enqueueSave, ready])

  useEffect(() => {
    if (!ready) return
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null
      enqueueSave(data)
    }, 300)

    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
    }
  }, [data, ready, enqueueSave])

  useEffect(() => {
    if (!ready) return
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushSave()
    }
    const onPageHide = () => flushSave()
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flushSave, ready])

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      dispatch,
      ready,
      saveFailed,
      flushSave,
      dismissSaveWarning: () => setSaveFailed(false),
    }),
    [data, ready, saveFailed, flushSave],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
