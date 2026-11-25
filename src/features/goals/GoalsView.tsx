import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { ChoiceSheet } from '../../components/ChoiceSheet'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
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
  goalProgress,
  goalTaskCounts,
  isGoalComplete,
  latestCompletion,
} from './taskUtils'
import { cx } from '../../lib/utils'

type GoalEditorState = { mode: 'create' } | { mode: 'edit'; goalId: string } | null
type TaskEditorState = { goalId: string; taskId: string } | null
type DeleteTarget =
  | { kind: 'goal'; goal: Goal }
  | { kind: 'task'; goalId: string; task: Task }
  | null

function sortActiveGoals(goals: Goal[], sort: GoalSort): Goal[] {
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
      const diff = goalProgress(b) - goalProgress(a)
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
  const didAutoExpand = useRef(false)

  const activeGoals = useMemo(
    () => data.goals.filter((goal) => !isGoalComplete(goal)),
    [data.goals],
  )
  const completedGoals = useMemo(
    () => data.goals.filter((goal) => isGoalComplete(goal)),
    [data.goals],
  )

  const sortedActive = useMemo(
    () => sortActiveGoals(activeGoals, data.prefs.goalSort),
    [activeGoals, data.prefs.goalSort],
  )
  const sortedCompleted = useMemo(
    () =>
      [...completedGoals].sort((a, b) => latestCompletion(b) - latestCompletion(a)),
    [completedGoals],
  )

  const visibleActive = domainFilter
    ? sortedActive.filter((goal) => goal.domain === domainFilter)
    : sortedActive
  const visibleCompleted = domainFilter
    ? sortedCompleted.filter((goal) => goal.domain === domainFilter)
    : sortedCompleted

  const todayEntries = useMemo(() => getTodayEntries(data.goals), [data.goals])
  const todayCount = todayEntries.length
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
    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById(`goal-${newGoalId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setNewGoalId(null)
    }, 140)
    return () => window.clearTimeout(scrollTimer)
  }, [newGoalId])

  const editGoalObject =
    goalEditor?.mode === 'edit'
      ? (data.goals.find((goal) => goal.id === goalEditor.goalId) ?? null)
      : null
  const taskGoal = taskEditor
    ? (data.goals.find((goal) => goal.id === taskEditor.goalId) ?? null)
    : null
  const taskObject = taskGoal?.tasks.find((task) => task.id === taskEditor?.taskId) ?? null

  const toggleExpanded = (goalId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return next
    })
  }

  const openNewGoal = () => {
    setGoalEditor({ mode: 'create' })
    setGoalEditorOpen(true)
  }

  const openEditGoal = (goal: Goal) => {
    setGoalEditor({ mode: 'edit', goalId: goal.id })
    setGoalEditorOpen(true)
  }

  const openTaskEditor = (goal: Goal, task: Task) => {
    setTaskEditor({ goalId: goal.id, taskId: task.id })
    setTaskEditorOpen(true)
  }

  const toggleTask = (goal: Goal, task: Task) => {
    const now = Date.now()
    const completing = !task.done
    const willComplete =
      completing &&
      goal.tasks.length > 0 &&
      goal.tasks.every((entry) => (entry.id === task.id ? true : entry.done))
    dispatch({ type: 'task/toggle', goalId: goal.id, taskId: task.id, now })
    if (completing) {
      showToast(willComplete ? `「${goal.title}」走完了` : '完成了一步', {
        actionLabel: '撤回',
        duration: willComplete ? 6500 : 4200,
        onAction: () =>
          dispatch({ type: 'task/toggle', goalId: goal.id, taskId: task.id, now: Date.now() }),
      })
    }
  }

  const addTask = (goal: Goal, title: string) => {
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
    dispatch({ type: 'task/add', goalId: goal.id, task })
    setExpandedIds((current) => new Set(current).add(goal.id))
  }

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
      if (domainFilter && values.domain !== domainFilter) setDomainFilter(null)
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
      onToggleExpanded={() => toggleExpanded(goal.id)}
      onEdit={() => openEditGoal(goal)}
      onToggleTask={(task) => toggleTask(goal, task)}
      onEditTask={(task) => openTaskEditor(goal, task)}
      onAddTask={(title) => addTask(goal, title)}
    />
  )

  const emptyAfterFilter = data.goals.length > 0 && visibleActive.length === 0 && visibleCompleted.length === 0
  const allCompleted = activeGoals.length === 0 && completedGoals.length > 0

  return (
    <div className="goals-view">
      <PageHeader
        index="02"
        english="MOMENTUM"
        mark="行"
        title="目标"
        tagline="把想成为的样子，拆成今天能走的一步。"
        aside={
          <div className="page-stat page-stat-wide" aria-label="目标概况">
            <div className="page-stat-main">
              <strong>{String(activeGoals.length).padStart(2, '0')}</strong>
              <span>个目标在走</span>
            </div>
            <div className="page-stat-sub">
              <span>
                {counts.done} / {counts.total} 步已完成
              </span>
              <span className="stat-separator" />
              <span>{todayCount ? `${todayCount} 件今天落地` : '今天没有到期项'}</span>
            </div>
          </div>
        }
      />

      {todayEntries.length ? (
        <section className="today-strip" aria-labelledby="today-strip-title">
          <div className="today-head">
            <div className="today-title-wrap">
              <span className="today-sun" aria-hidden="true" />
              <div>
                <p className="section-eyebrow">DUE TODAY</p>
                <h2 id="today-strip-title">
                  今天落地
                  <span className="inline-count">{todayCount}</span>
                </h2>
              </div>
            </div>
            <p className="today-note">处理完，就把今天交还给自己。</p>
          </div>
          <ul className="today-list">
            {todayEntries.map(({ goal, task }) => {
              const tone = getDueTone(task.dueDate)
              return (
                <li key={`${goal.id}-${task.id}`} className="today-task">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={false}
                    aria-label={`完成「${task.title}」`}
                    className="task-check"
                    onClick={() => toggleTask(goal, task)}
                  >
                    <Icon name="check" size={14} />
                  </button>
                  <div className="today-task-main">
                    <button
                      type="button"
                      className="today-task-title"
                      onClick={() => openTaskEditor(goal, task)}
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
        </section>
      ) : null}

      <div className="goals-toolbar">
        <div className="goals-toolbar-title">
          <p className="section-eyebrow">DIRECTIONS</p>
          <h2>
            目标清单
            <span className="inline-count">{visibleActive.length + visibleCompleted.length}</span>
          </h2>
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
            onClick={() => setDomainFilter(null)}
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
              onClick={() => setDomainFilter(domainFilter === domain.key ? null : domain.key)}
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
          <Button variant="secondary" onClick={() => setDomainFilter(null)}>
            查看全部目标
          </Button>
        </EmptyState>
      ) : (
        <>
          {visibleActive.length ? (
            <div className="goal-list">{visibleActive.map(renderGoal)}</div>
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
                  <span className="inline-count">{visibleCompleted.length}</span>
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
                <div className="goal-list goal-list-completed">
                  {visibleCompleted.map(renderGoal)}
                </div>
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
        eyebrow="先看见更该走的那条"
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
