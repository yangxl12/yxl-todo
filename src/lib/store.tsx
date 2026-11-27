import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createEmptyData, decodeLocalData } from './dataFormat'
import { clearDraft } from './draft'
import { getEditJournal, type EditJournal } from './editJournal'
import { moveToTrash, reduceData, restoreFromTrash, type DeleteResult, type RestoreStatus } from './operations'
import { CHANGE_KEY, commitState, loadState, notifyCommit, type LoadedState } from './storage'
import type { AppAction, AppData, Idea, TrashTarget } from './types'
import { newId } from './utils'

type SaveStatus = 'idle' | 'pending' | 'failed' | 'conflict'
type LoadedProblem = Extract<LoadedState, { status: 'unreadable' | 'diverged' }>
interface Recovery {
  key: string
  journal: EditJournal
  restorable: boolean
}

interface AppContextValue {
  data: AppData
  ready: boolean
  problem: LoadedProblem | null
  savedInFallback: boolean
  saveStatus: SaveStatus
  recovery: Recovery[]
  dispatch: (action: AppAction) => boolean
  getData: () => AppData
  deleteRecord: (target: TrashTarget) => Promise<DeleteResult>
  restoreRecord: (entryId: string) => Promise<RestoreStatus>
  flushSave: () => Promise<boolean>
  retryLoad: () => Promise<void>
  resolveCopies: (source: 'primary' | 'fallback') => Promise<boolean>
  restoreJournal: (entry: Recovery) => Promise<boolean>
  keepLatest: () => Promise<boolean>
  restoreIdeaCopies: (entry: Recovery) => Promise<boolean>
  replaceData: (next: AppData | null) => Promise<boolean>
  saveToPrimary: () => Promise<boolean>
}

const AppContext = createContext<AppContextValue | null>(null)

function reconcileJournal(journal: EditJournal, revision: string): EditJournal {
  if (journal.attempt?.revision !== revision) return journal
  return { base: revision, changes: journal.changes.slice(journal.attempt.count) }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(createEmptyData)
  const [ready, setReady] = useState(false)
  const [problem, setProblem] = useState<LoadedProblem | null>(null)
  const [savedInFallback, setSavedInFallback] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [recovery, setRecovery] = useState<Recovery[]>([])
  const latest = useRef(data)
  const base = useRef<string | null>(null)
  const changes = useRef<EditJournal['changes']>([])
  const attempt = useRef<EditJournal['attempt']>(undefined)
  const timer = useRef<number | undefined>(undefined)
  const writing = useRef<Promise<boolean> | null>(null)
  const replacing = useRef(false)

  const showData = useCallback((next: AppData) => {
    latest.current = next
    setData(next)
  }, [])

  const remember = useCallback(() => {
    if (base.current === null) return false
    return getEditJournal().remember(changes.current.length
      ? { base: base.current, changes: changes.current, attempt: attempt.current }
      : null)
  }, [])

  const flushSave = useCallback((): Promise<boolean> => {
    window.clearTimeout(timer.current)
    if (writing.current) {
      return writing.current.then((saved) => saved && flushSave())
    }
    if (!changes.current.length) return Promise.resolve(true)
    if (base.current === null) return Promise.resolve(false)
    const revision = newId()
    const count = changes.current.length
    attempt.current = { revision, count }
    remember()
    setData(latest.current)
    const pending = commitState(base.current, revision, latest.current).then((result) => {
      writing.current = null
      attempt.current = undefined
      if (result.status !== 'saved') {
        setSaveStatus(result.status)
        remember()
        return false
      }
      base.current = result.copy.revision
      changes.current = changes.current.slice(count)
      remember()
      setSavedInFallback(result.source === 'fallback')
      setSaveStatus(changes.current.length ? 'pending' : 'idle')
      notifyCommit(revision)
      if (changes.current.length) timer.current = window.setTimeout(() => void flushSave(), 300)
      return true
    })
    writing.current = pending
    return pending
  }, [remember])

  const recordChange = useCallback((action: AppAction, now: number, next: AppData) => {
    const lastIndex = changes.current.length - 1
    const last = changes.current[lastIndex]?.action
    if (lastIndex >= (attempt.current?.count ?? 0) && last?.type === 'idea/update' &&
      action.type === 'idea/update' && last.id === action.id) {
      changes.current[lastIndex] = { action: { ...action, patch: { ...last.patch, ...action.patch } }, now }
    } else {
      changes.current.push({ action, now })
    }
    const journalSaved = remember()
    const editingText = action.type === 'idea/update' && typeof action.patch.text === 'string'
    if (editingText) latest.current = next
    else showData(next)
    setSaveStatus((current) => current === 'conflict' || current === 'failed' ? current : 'pending')
    window.clearTimeout(timer.current)
    if (journalSaved) timer.current = window.setTimeout(() => void flushSave(), 300)
    else void flushSave()
    return true
  }, [flushSave, remember, showData])

  const getData = useCallback(() => latest.current, [])

  const dispatch = useCallback((action: AppAction) => {
    if (base.current === null || replacing.current) return false
    const now = Date.now()
    const next = reduceData(latest.current, action, now)
    return next !== latest.current && recordChange(action, now, next)
  }, [recordChange])

  const deleteRecord = useCallback(async (target: TrashTarget): Promise<DeleteResult> => {
    if (base.current === null || replacing.current) return { status: 'busy' }
    const now = Date.now()
    const entryId = newId()
    const result = moveToTrash(latest.current, target, entryId, now)
    if (result.status !== 'deleted') return { status: result.status }
    recordChange({ type: 'trash/delete', target, entryId }, now, result.data)
    return await flushSave() ? { status: 'deleted', entryId, evicted: result.evicted } : { status: 'failed' }
  }, [flushSave, recordChange])

  const restoreRecord = useCallback(async (entryId: string): Promise<RestoreStatus> => {
    if (base.current === null || replacing.current) return 'busy'
    const now = Date.now()
    const result = restoreFromTrash(latest.current, entryId, now)
    if (result.status !== 'restored') return result.status
    recordChange({ type: 'trash/restore', entryId }, now, result.data)
    return await flushSave() ? 'restored' : 'failed'
  }, [flushSave, recordChange])

  const adopt = useCallback((loaded: LoadedState) => {
    if (!('current' in loaded)) {
      setProblem(loaded)
      setReady(false)
      base.current = null
      return
    }
    base.current = loaded.current.revision
    showData(loaded.current.data)
    setSavedInFallback(loaded.status === 'fallback')
    setProblem(null)
    setReady(true)
    setSaveStatus('idle')
  }, [showData])

  const getRecovery = useCallback(async () => {
    const revision = base.current
    const journalStore = getEditJournal()
    const found = await journalStore.abandoned()
    if (journalStore.previous && journalStore.previousKey &&
      !found.some((item) => item.key === journalStore.previousKey)) {
      found.push({ journal: journalStore.previous, key: journalStore.previousKey })
    }
    return found.map((entry) => ({
      ...entry,
      journal: revision === null ? entry.journal : reconcileJournal(entry.journal, revision),
    })).filter((entry) => entry.journal.changes.length).map((entry) => ({
      ...entry, restorable: entry.journal.base === revision,
    }))
  }, [])

  const recover = useCallback((entry: Recovery): boolean => {
    const { journal, key } = entry
    if (base.current !== journal.base || changes.current.length || replacing.current) return false
    let next: AppData
    try {
      next = decodeLocalData(journal.changes.reduce((current, change) =>
        reduceData(current, change.action, change.now), latest.current))
    } catch {
      return false
    }
    changes.current = journal.changes
    if (remember()) getEditJournal().remove(key)
    setRecovery((items) => items.filter((item) => item.key !== key))
    showData(next)
    setSaveStatus('pending')
    return true
  }, [remember, showData])

  const retryLoad = useCallback(async () => {
    if (base.current !== null) return
    const loaded = await loadState()
    if (base.current !== null) return
    adopt(loaded)
    const items = await getRecovery()
    const journalStore = getEditJournal()
    const sameTab = items.find((item) => item.key === journalStore.previousKey)
    setRecovery(items)
    if (sameTab && recover(sameTab)) void flushSave()
  }, [adopt, flushSave, getRecovery, recover])

  useEffect(() => {
    void retryLoad()
  }, [retryLoad])

  const refresh = useCallback(async () => {
    if (writing.current) {
      await writing.current
      return refresh()
    }
    if (replacing.current || base.current === null) return
    const observed = base.current
    const loaded = await loadState()
    if (writing.current || replacing.current || observed !== base.current) return
    if ('current' in loaded && loaded.current.revision !== observed) {
      if (changes.current.length) setSaveStatus('conflict')
      else {
        adopt(loaded)
        setRecovery((items) => items.map((item) => ({
          ...item, restorable: item.journal.base === loaded.current.revision,
        })))
      }
    }
  }, [adopt])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flushSave()
      else void refresh()
    }
    const onPageHide = () => void flushSave()
    const onStorage = (event: StorageEvent) => {
      if (event.key === CHANGE_KEY) void refresh()
    }
    const onFocus = () => void refresh()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
    }
  }, [flushSave, refresh])

  const keepLatest = useCallback(async () => {
    if (replacing.current || writing.current) return false
    const loaded = await loadState()
    if (!('current' in loaded) || replacing.current || writing.current || base.current === null) return false
    if (changes.current.length) {
      const journal = { base: base.current, changes: changes.current }
      const key = getEditJournal().archive(journal)
      if (!key) return false
      setRecovery((items) => [...items.map((item) => ({
        ...item, restorable: item.journal.base === loaded.current.revision,
      })), { key, journal, restorable: journal.base === loaded.current.revision }])
    }
    window.clearTimeout(timer.current)
    changes.current = []
    attempt.current = undefined
    remember()
    adopt(loaded)
    window.dispatchEvent(new Event('shiyan:data-changed'))
    return true
  }, [adopt, remember])

  const replaceData = useCallback(async (next: AppData | null) => {
    if (replacing.current || base.current === null) return false
    replacing.current = true
    try {
      if (!(await flushSave())) return false
      const replacement = next
        ? { ...next, prefs: { ...next.prefs, apiKey: latest.current.prefs.apiKey } }
        : createEmptyData()
      const revision = newId()
      const result = await commitState(base.current, revision, replacement, { clearArchive: next === null })
      if (result.status !== 'saved') {
        if (result.status === 'conflict') setSaveStatus('conflict')
        return false
      }
      adopt({ status: result.source, current: result.copy })
      clearDraft()
      if (next === null) {
        const journals = getEditJournal()
        if (journals.previousKey) journals.remove(journals.previousKey)
        for (const entry of await journals.abandoned()) journals.remove(entry.key)
        setRecovery([])
      }
      window.dispatchEvent(new Event('shiyan:data-changed'))
      notifyCommit(revision)
      return true
    } finally {
      replacing.current = false
    }
  }, [adopt, flushSave])

  const resolveCopies = useCallback(async (source: 'primary' | 'fallback') => {
    if (replacing.current || problem?.status !== 'diverged') return false
    replacing.current = true
    try {
      const selected = problem[source]
      const revision = newId()
      const result = await commitState(selected.revision, revision, selected.data, { recovery: {
        primary: problem.primary.revision,
        fallback: problem.fallback.revision,
        selected: selected.revision,
      } })
      if (result.status !== 'saved') return false
      adopt({ status: result.source, current: result.copy })
      notifyCommit(revision)
      return true
    } finally {
      replacing.current = false
    }
  }, [adopt, problem])

  const saveToPrimary = useCallback(async () => {
    if (replacing.current || base.current === null) return false
    replacing.current = true
    try {
      if (!(await flushSave())) return false
      const revision = newId()
      const result = await commitState(base.current, revision, latest.current, { primaryOnly: true })
      if (result.status !== 'saved') return false
      adopt({ status: result.source, current: result.copy })
      notifyCommit(revision)
      return true
    } finally {
      replacing.current = false
    }
  }, [adopt, flushSave])

  const restoreJournal = useCallback(async (entry: Recovery) =>
    recover(entry) && flushSave(), [recover, flushSave])

  const restoreIdeaCopies = useCallback(async (entry: Recovery) => {
    if (replacing.current || base.current === null || changes.current.length) return false
    const drafts = new Map<string, Pick<Idea, 'text' | 'tags'>>()
    for (const { action } of entry.journal.changes) {
      if (action.type === 'idea/add') drafts.set(action.idea.id, action.idea)
      if (action.type === 'idea/update') {
        const previous = drafts.get(action.id)
        const text = action.patch.text ?? previous?.text
        if (text?.trim()) drafts.set(action.id, { text, tags: action.patch.tags ?? previous?.tags ?? [] })
      }
      if (action.type === 'idea/undoAdd') drafts.delete(action.idea.id)
    }
    if (!drafts.size) return false
    const now = Date.now()
    for (const draft of drafts.values()) {
      dispatch({ type: 'idea/add', idea: {
        id: newId(), text: draft.text, tags: draft.tags, pinned: false, pinnedAt: null,
        createdAt: now, updatedAt: now,
      } })
    }
    if (!(await flushSave())) return false
    const related = new Set(['idea/add', 'idea/update', 'idea/undoAdd'])
    const remaining = entry.journal.changes.filter(({ action }) => !related.has(action.type))
    const journals = getEditJournal()
    const key = remaining.length ? journals.archive({ base: entry.journal.base, changes: remaining }) : null
    if (remaining.length && !key) return false
    journals.remove(entry.key)
    setRecovery((items) => [
      ...items.filter((item) => item.key !== entry.key),
      ...(key ? [{ key, journal: { base: entry.journal.base, changes: remaining }, restorable: false }] : []),
    ])
    return true
  }, [dispatch, flushSave])

  const value = useMemo<AppContextValue>(() => ({
    data, ready, problem, savedInFallback, saveStatus, recovery, dispatch, getData, deleteRecord, restoreRecord,
    flushSave, retryLoad, resolveCopies, restoreJournal, keepLatest, restoreIdeaCopies, replaceData, saveToPrimary,
  }), [data, ready, problem, savedInFallback, saveStatus, recovery, dispatch, getData, deleteRecord, restoreRecord,
    flushSave, retryLoad, resolveCopies, restoreJournal, keepLatest, restoreIdeaCopies, replaceData, saveToPrimary])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
