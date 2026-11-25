import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { ChoiceSheet } from '../../components/ChoiceSheet'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { DOMAINS, GOAL_SORTS } from '../../lib/domains'
import { useApp } from '../../lib/store'
import { newId } from '../../lib/storage'
import type { DomainKey, Goal, GoalSort, Task } from '../../lib/types'
import { getDueTone } from '../../lib/date'
import { GoalCard } from './GoalCard'
import { GoalEditorSheet } from './GoalEditorSheet'
import { TaskEditorSheet } from './TaskEditorSheet'
import {
  getTodayEntries,
  goalStats,
  goalTaskCounts,
  latestCompletion,
  type GoalStats,
} from './taskUtils'
import { cx } from '../../lib/utils'

type GoalEditorState = { mode: 'create' } | { mode: 'edit'; goalId: string } | null
type TaskEditorState = { goalId: string; taskId: string } | null
type DeleteTarget =
  | { kind: 'goal'; goal: Goal }
  | { kind: 'task'; goalId: string; task: Task }
  | null

// Same rhythm as the thoughts list: render a first screenful, let the rest
// arrive on request instead of mounting every goal card up front.
const PAGE_SIZE = 30
// The today strip is a focus list, not an archive; a long tail of overdue
// items stays one tap away instead of being mounted every time.
const TODAY_LIMIT = 20

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

export function GoalsView() {
  const { data, dispatch } = useApp()
  const { showToast } = useToast()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [completedOpen, setCompletedOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [domainFilter, setDomainFilter] = useState<DomainKey | null>(null)
  const [goalEditor, setGoalEditor] = useState<GoalEditorState>(null)
  const [goalEditorOpen, setGoalEditorOpen] = useState(false)
  const [taskEditor, setTaskEditor] = useState<TaskEditorState>(null)
  const [taskEditorOpen, setTaskEditorOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [newGoalId, setNewGoalId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [todayOpen, setTodayOpen] = useState(false)
  const didAutoExpand = useRef(false)
  // Stable callbacks below read the freshest data through this ref, so memoized
  // cards keep their identity while store updates still reach the handler.
  const dataRef = useRef(data)
  dataRef.current = data

  const goalBuckets = useMemo(() => {
    const stats = new Map<string, GoalStats>()
    const active: Goal[] = []
    const completed: Goal[] = []
    for (const goal of data.goals) {
      const entry = goalStats(goal)
      stats.set(goal.id, entry)
      if (entry.complete) completed.push(goal)
      else active.push(goal)
    }
    return { active, completed, stats }
  }, [data.goals])

  const activeGoals = goalBuckets.active
  const completedGoals = goalBuckets.completed

  const sortedActive = useMemo(
    () => sortActiveGoals(activeGoals, data.prefs.goalSort, goalBuckets.stats),
    [activeGoals, data.prefs.goalSort, goalBuckets.stats],
  )
  const sortedCompleted = useMemo(() => {
    const latest = new Map<string, number>()
    for (const goal of completedGoals) latest.set(goal.id, latestCompletion(goal))
    return [...completedGoals].sort((a, b) => (latest.get(b.id) ?? 0) - (latest.get(a.id) ?? 0))
  }, [completedGoals])

  const visibleActive = useMemo(
    () => (domainFilter ? sortedActive.filter((goal) => goal.domain === domainFilter) : sortedActive),
    [domainFilter, sortedActive],
  )
  const visibleCompleted = useMemo(
    () =>
      domainFilter ? sortedCompleted.filter((goal) => goal.domain === domainFilter) : sortedCompleted,
    [domainFilter, sortedCompleted],
  )
  const shownActive = useMemo(
    () => visibleActive.slice(0, visibleCount),
    [visibleActive, visibleCount],
  )
  const shownCompleted = useMemo(
    () => visibleCompleted.slice(0, visibleCount),
    [visibleCompleted, visibleCount],
  )

  const todayEntries = useMemo(() => getTodayEntries(data.goals), [data.goals])
  const todayCount = todayEntries.length
  const shownToday = useMemo(
    () => (todayOpen ? todayEntries : todayEntries.slice(0, TODAY_LIMIT)),
    [todayEntries, todayOpen],
  )
  const counts = useMemo(() => goalTaskCounts(data.goals), [data.goals])
  const availableDomains = useMemo(() => {
    const used = new Set(data.goals.map((goal) => goal.domain))
    return DOMAINS.filter((domain) => used.has(domain.key))
  }, [data.goals])

  const currentSort = GOAL_SORTS.find((item) => item.value === data.prefs.goalSort) ?? GOAL_SORTS[0]

  useEffect(() => {
    if (didAutoExpand.current || !sortedActive.length) return
    didAutoExpand.current = true
    setExpandedIds(new Set([sortedActive[0].id]))
  }, [sortedActive])

  useEffect(() => {
    if (!newGoalId) return
    // Make sure a newly created goal is inside the rendered window before we
    // scroll to it (its sort position can put it past the first page).
    const index = sortedActive.findIndex((goal) => goal.id === newGoalId)
    if (index >= 0) setVisibleCount((count) => (count > index ? count : index + 1))
    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById(`goal-${newGoalId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setNewGoalId(null)
    }, 140)
    return () => window.clearTimeout(scrollTimer)
  }, [newGoalId, sortedActive])

  const editGoalObject =
    goalEditor?.mode === 'edit'
      ? (data.goals.find((goal) => goal.id === goalEditor.goalId) ?? null)
      : null
  const taskGoal = taskEditor
    ? (data.goals.find((goal) => goal.id === taskEditor.goalId) ?? null)
    : null
  const taskObject = taskGoal?.tasks.find((task) => task.id === taskEditor?.taskId) ?? null

  const toggleExpanded = useCallback((goalId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return next
    })
  }, [])

  const openNewGoal = () => {
    setGoalEditor({ mode: 'create' })
    setGoalEditorOpen(true)
  }

  const chooseDomain = (next: DomainKey | null) => {
    setDomainFilter(next)
    setVisibleCount(PAGE_SIZE)
  }

  const openEditGoal = useCallback((goal: Goal) => {
    setGoalEditor({ mode: 'edit', goalId: goal.id })
    setGoalEditorOpen(true)
  }, [])

  const openTaskEditor = useCallback((goalId: string, task: Task) => {
    setTaskEditor({ goalId, taskId: task.id })
    setTaskEditorOpen(true)
  }, [])

  const toggleTask = useCallback(
    (goalId: string, taskId: string) => {
      const goal = dataRef.current.goals.find((entry) => entry.id === goalId)
      const task = goal?.tasks.find((entry) => entry.id === taskId)
      if (!goal || !task) return
      const now = Date.now()
      const completing = !task.done
      const willComplete =
        completing &&
        goal.tasks.length > 0 &&
        goal.tasks.every((entry) => (entry.id === taskId ? true : entry.done))
      dispatch({ type: 'task/toggle', goalId, taskId, now })
      if (completing) {
        showToast(willComplete ? `「${goal.title}」走完了` : '完成了一步', {
          actionLabel: '撤回',
          duration: willComplete ? 6500 : 4200,
          onAction: () => dispatch({ type: 'task/toggle', goalId, taskId, now: Date.now() }),
        })
      }
    },
    [dispatch, showToast],
  )

  const addTask = useCallback(
    (goalId: string, title: string) => {
      const now = Date.now()
      const task: Task = {
        id: newId(),
        title,
        done: false,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        dueDate: null,
        priority: 'normal',
      }
      dispatch({ type: 'task/add', goalId, task })
      setExpandedIds((current) => new Set(current).add(goalId))
    },
    [dispatch],
  )

  const saveGoal = (values: {
    title: string
    why: string
    domain: DomainKey
    dueDate: string | null
  }) => {
    if (goalEditor?.mode === 'create') {
      const now = Date.now()
      const goal: Goal = {
        id: newId(),
        title: values.title,
        why: values.why,
        domain: values.domain,
        dueDate: values.dueDate,
        createdAt: now,
        updatedAt: now,
        tasks: [],
      }
      dispatch({ type: 'goal/add', goal })
      setExpandedIds((current) => new Set(current).add(goal.id))
      setDomainFilter(null)
      setVisibleCount(PAGE_SIZE)
      setNewGoalId(goal.id)
      showToast('目标已立下，先写下第一步')
    } else if (editGoalObject) {
      dispatch({
        type: 'goal/update',
        id: editGoalObject.id,
        patch: {
          title: values.title,
          why: values.why,
          domain: values.domain,
          dueDate: values.dueDate,
        },
      })
      if (domainFilter && values.domain !== domainFilter) chooseDomain(null)
    }
    setGoalEditorOpen(false)
  }

  const requestDeleteGoal = (goal: Goal) => {
    setGoalEditorOpen(false)
    setDeleteTarget({ kind: 'goal', goal })
  }

  const requestDeleteTask = (goal: Goal, task: Task) => {
    setTaskEditorOpen(false)
    setDeleteTarget({ kind: 'task', goalId: goal.id, task })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'goal') {
      const deleted = deleteTarget.goal
      dispatch({ type: 'goal/delete', id: deleted.id })
      showToast(`「${deleted.title}」已删除`, {
        actionLabel: '撤回',
        onAction: () => dispatch({ type: 'goal/restore', goal: deleted }),
      })
    } else {
      const { goalId, task } = deleteTarget
      dispatch({ type: 'task/delete', goalId, taskId: task.id })
      showToast(`「${task.title}」已删除`, {
        actionLabel: '撤回',
        onAction: () => dispatch({ type: 'task/restore', goalId, task }),
      })
    }
    setDeleteTarget(null)
  }

  const renderGoal = (goal: Goal) => (
    <GoalCard
      key={goal.id}
      goal={goal}
      expanded={expandedIds.has(goal.id)}
      onToggleExpanded={toggleExpanded}
      onEdit={openEditGoal}
      onToggleTask={toggleTask}
      onEditTask={openTaskEditor}
      onAddTask={addTask}
    />
  )

  const emptyAfterFilter = data.goals.length > 0 && visibleActive.length === 0 && visibleCompleted.length === 0
  const allCompleted = activeGoals.length === 0 && completedGoals.length > 0

  return (
    <div className="goals-view">
      <h1 className="sr-only">目标</h1>

      {todayEntries.length ? (
        <section className="today-strip" aria-labelledby="today-strip-title">
          <div className="today-head">
            <div className="today-title-wrap">
              <span className="today-sun" aria-hidden="true" />
              <div>
                <h2 id="today-strip-title">今天落地</h2>
                <p className="today-summary">今天有 {todayCount} 件到期，先挑一件开始。</p>
              </div>
            </div>
            <p className="today-note">处理完，就把今天交还给自己。</p>
          </div>
          <ul className="today-list">
            {shownToday.map(({ goal, task }) => {
              const tone = getDueTone(task.dueDate)
              return (
                <li key={`${goal.id}-${task.id}`} className="today-task">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={false}
                    aria-label={`完成「${task.title}」`}
                    className="task-check"
                    onClick={() => toggleTask(goal.id, task.id)}
                  >
                    <Icon name="check" size={14} />
                  </button>
                  <div className="today-task-main">
                    <button
                      type="button"
                      className="today-task-title"
                      onClick={() => openTaskEditor(goal.id, task)}
                    >
                      {task.title}
                    </button>
                    <span className="today-task-meta">
                      <span className={cx('today-task-goal', `domain-${goal.domain}`)}>
                        <span className="domain-dot" />
                        {goal.title}
                      </span>
                      {tone === 'overdue' ? (
                        <span className="today-overdue">逾期</span>
                      ) : null}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          {todayEntries.length > TODAY_LIMIT ? (
            <button
              type="button"
              className="today-more"
              onClick={() => setTodayOpen((value) => !value)}
              aria-expanded={todayOpen}
            >
              {todayOpen ? '先只看最要紧的' : `再看 ${todayEntries.length - TODAY_LIMIT} 件到期`}
            </button>
          ) : null}
        </section>
      ) : null}

      <div className="goals-toolbar">
        <div className="goals-toolbar-title">
          <h2>目标清单</h2>
          {activeGoals.length ? (
            <p className="section-summary">
              {activeGoals.length} 个在走 · {counts.done} / {counts.total} 步完成
            </p>
          ) : allCompleted ? (
            <p className="section-summary">{completedGoals.length} 个目标已达成</p>
          ) : null}
        </div>
        <div className="goals-tools">
          <button
            type="button"
            className="sort-trigger"
            onClick={() => setSortOpen(true)}
            aria-label={`排序方式：${currentSort.label}`}
          >
            <Icon name="sort" size={15} />
            <span>{currentSort.label}</span>
          </button>
          <Button variant="primary" icon="plus" onClick={openNewGoal}>
            新目标
          </Button>
        </div>
      </div>

      {availableDomains.length > 1 ? (
        <div className="filter-strip" aria-label="按类别筛选目标">
          <button
            type="button"
            className={domainFilter === null ? 'filter-chip is-active' : 'filter-chip'}
            onClick={() => chooseDomain(null)}
            aria-pressed={domainFilter === null}
          >
            全部
          </button>
          {availableDomains.map((domain) => (
            <button
              type="button"
              key={domain.key}
              className={cx(
                'filter-chip',
                `domain-${domain.key}`,
                domainFilter === domain.key && 'is-active',
              )}
              onClick={() => chooseDomain(domainFilter === domain.key ? null : domain.key)}
              aria-pressed={domainFilter === domain.key}
            >
              <span className="domain-dot" />
              {domain.label}
            </button>
          ))}
        </div>
      ) : null}

      {!data.goals.length ? (
        <EmptyState
          mark="始"
          title="先给想做的事一个方向"
          body="目标不用宏大，但要能拆出下一步。立一个方向，再往里面放今天能走的一小步。"
        >
          <Button variant="secondary" icon="compass" onClick={openNewGoal}>
            立下第一个目标
          </Button>
        </EmptyState>
      ) : emptyAfterFilter ? (
        <EmptyState
          mark="空"
          title="这一类里还没有目标"
          body="换个类别看看，或者现在就立一个。"
          compact
        >
          <Button variant="secondary" onClick={() => chooseDomain(null)}>
            查看全部目标
          </Button>
        </EmptyState>
      ) : (
        <>
          {visibleActive.length ? (
            <>
              <div className="goal-list">{shownActive.map(renderGoal)}</div>
              {visibleActive.length > shownActive.length ? (
                <div className="load-more">
                  <Button
                    variant="ghost"
                    iconAfter="chevronDown"
                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  >
                    再看 {visibleActive.length - shownActive.length} 个目标
                  </Button>
                </div>
              ) : null}
            </>
          ) : allCompleted ? (
            <div className="all-done-note">
              <span className="all-done-mark" aria-hidden="true">
                成
              </span>
              <div>
                <h3>手上的目标都走完了</h3>
                <p>可以歇一会儿，也可以再立一个方向。</p>
              </div>
            </div>
          ) : null}

          {visibleCompleted.length ? (
            <section className="achieved-section">
              <button
                type="button"
                className="achieved-toggle"
                onClick={() => setCompletedOpen((value) => !value)}
                aria-expanded={completedOpen}
              >
                <span className="achieved-title">
                  <span className="achieved-seal" aria-hidden="true">
                    成
                  </span>
                  已达成
                </span>
                <span className="achieved-hint">
                  {completedOpen ? '收起来' : '看看走过的路'}
                  <Icon
                    name="chevronDown"
                    size={15}
                    className={cx('chevron', completedOpen && 'is-up')}
                  />
                </span>
              </button>
              {completedOpen ? (
                <>
                  <div className="goal-list goal-list-completed">
                    {shownCompleted.map(renderGoal)}
                  </div>
                  {visibleCompleted.length > shownCompleted.length ? (
                    <div className="load-more">
                      <Button
                        variant="ghost"
                        iconAfter="chevronDown"
                        onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                      >
                        再看 {visibleCompleted.length - shownCompleted.length} 个已达成
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      <p className="goals-footnote">
        <Icon name="bulb" size={14} />
        一件件走完，进度会自己长出来；不需要手动改百分比。
      </p>

      <GoalEditorSheet
        open={goalEditorOpen}
        mode={goalEditor?.mode ?? 'create'}
        goal={editGoalObject}
        initialDomain={domainFilter ?? 'life'}
        onClose={() => setGoalEditorOpen(false)}
        onSave={saveGoal}
        onRequestDelete={requestDeleteGoal}
      />

      <TaskEditorSheet
        open={taskEditorOpen}
        goal={taskGoal}
        task={taskObject}
        onClose={() => setTaskEditorOpen(false)}
        onSave={(values) => {
          if (!taskGoal || !taskObject) return
          dispatch({
            type: 'task/update',
            goalId: taskGoal.id,
            taskId: taskObject.id,
            patch: values,
          })
          setTaskEditorOpen(false)
        }}
        onRequestDelete={requestDeleteTask}
      />

      <ChoiceSheet<GoalSort>
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title="目标怎么排"
        subtitle="先看见更该走的那条"
        titleId="goal-sort-title"
        options={GOAL_SORTS}
        value={data.prefs.goalSort}
        onChange={(value) => dispatch({ type: 'prefs/update', patch: { goalSort: value } })}
      />

      <ConfirmSheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget?.kind === 'goal' ? '要把这个目标删掉吗？' : '要把这一步删掉吗？'}
        confirmLabel={deleteTarget?.kind === 'goal' ? '删除目标' : '删除这一步'}
        description={
          deleteTarget?.kind === 'goal' ? (
            <div className="delete-preview">
              <p>{deleteTarget.goal.title}</p>
              <small>
                它下面的 {deleteTarget.goal.tasks.length} 个步骤也会一起删除。五秒内仍可撤回。
              </small>
            </div>
          ) : (
            <div className="delete-preview">
              <p>{deleteTarget?.task.title}</p>
              <small>删除后五秒内仍可撤回。</small>
            </div>
          )
        }
      />
    </div>
  )
}
