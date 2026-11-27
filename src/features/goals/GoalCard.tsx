import { useCalendarDay } from '../../lib/calendarDay'
import { memo, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button, IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { DOMAIN_MAP, PRIORITY_LABEL } from '../../lib/domains'
import { formatDueDate, getDueTone } from '../../lib/date'
import type { Goal, Task } from '../../lib/types'
import { cx } from '../../lib/utils'
import { goalStats, orderTasks } from './taskUtils'

interface GoalCardProps {
  goal: Goal
  expanded: boolean
  onToggleExpanded: (goalId: string) => void
  onEdit: (goal: Goal) => void
  onToggleTask: (goalId: string, taskId: string) => void
  onEditTask: (goalId: string, task: Task) => void
  onAddTask: (goalId: string, title: string) => void
}

const EMPTY_TASKS: Task[] = []

interface TaskRowProps {
  task: Task
  goalTitle: string
  onToggle: (task: Task) => void
  onEdit: (task: Task) => void
}

const TaskRow = memo(function TaskRow({ task, goalTitle, onToggle, onEdit }: TaskRowProps) {
  const today = useCalendarDay()
  const tone = getDueTone(task.dueDate, task.done, today)

  return (
    <li className={cx('task-row', task.done && 'is-done')}>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `把「${task.title}」标为未完成` : `完成「${task.title}」`}
        className="task-check"
        onClick={() => onToggle(task)}
      >
        <Icon name="check" size={14} />
      </button>
      <div className="task-main">
        <button
          type="button"
          className="task-title"
          onClick={() => onEdit(task)}
          title={`编辑这一步：${goalTitle}`}
        >
          {task.title}
        </button>
        {!task.done && (task.dueDate || task.priority !== 'normal') ? (
          <span className="task-meta">
            {task.dueDate ? (
              <span className={cx('task-due', tone && `due-${tone}`)}>
                <Icon name="calendar" size={12} />
                {formatDueDate(task.dueDate, today)}
              </span>
            ) : null}
            {task.priority !== 'normal' ? (
              <span className={cx('task-priority', `priority-${task.priority}`)}>
                <Icon name="flag" size={11} />
                {PRIORITY_LABEL[task.priority]}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      <IconButton
        label={`编辑「${task.title}」`}
        icon="edit"
        size={15}
        subtle
        className="task-edit"
        onClick={() => onEdit(task)}
      />
    </li>
  )
})

export const GoalCard = memo(function GoalCard({
  goal,
  expanded,
  onToggleExpanded,
  onEdit,
  onToggleTask,
  onEditTask,
  onAddTask,
}: GoalCardProps) {
  const [taskTitle, setTaskTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { total, done: doneCount, complete, progress } = goalStats(goal)

  // A quiet plus is enough until someone actually wants to type.
  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  // Done steps stay in place so ticking one never moves the row under the
  // finger; ordering ignores `done` for the same reason.
  const orderedTasks = expanded ? orderTasks(goal.tasks) : EMPTY_TASKS

  const domain = DOMAIN_MAP[goal.domain]
  const today = useCalendarDay()
  const tone = getDueTone(goal.dueDate, complete, today)
  const tasksId = `goal-tasks-${goal.id}`
  const percent = Math.round(progress * 100)

  const handleToggleExpanded = useCallback(() => onToggleExpanded(goal.id), [goal.id, onToggleExpanded])
  const handleEdit = useCallback(() => onEdit(goal), [goal, onEdit])
  const handleToggleTask = useCallback(
    (task: Task) => onToggleTask(goal.id, task.id),
    [goal.id, onToggleTask],
  )
  const handleEditTask = useCallback(
    (task: Task) => onEditTask(goal.id, task),
    [goal.id, onEditTask],
  )

  const submitTask = (event?: FormEvent) => {
    event?.preventDefault()
    const cleaned = taskTitle.trim()
    if (!cleaned) {
      inputRef.current?.focus()
      return
    }
    onAddTask(goal.id, cleaned)
    setTaskTitle('')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const closeAdding = () => {
    setAdding(false)
    setTaskTitle('')
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submitTask()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeAdding()
    }
  }

  return (
    <article
      className={cx('goal-card', `domain-${goal.domain}`, complete && 'is-complete')}
      id={`goal-${goal.id}`}
    >
      <div className="goal-accent" aria-hidden="true" />
      <IconButton
        label="编辑目标"
        icon="more"
        size={18}
        subtle
        className="goal-edit-button"
        onClick={handleEdit}
      />
      <div
        className="goal-summary"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={tasksId}
        onClick={handleToggleExpanded}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleToggleExpanded()
          }
        }}
      >
        <div className="goal-topline">
          <span className={cx('domain-tag', `domain-${goal.domain}`)}>
            <span className="domain-dot" />
            {domain.label}
          </span>
          {goal.dueDate ? (
            <span className={cx('goal-due', tone && `due-${tone}`)}>
              <Icon name="calendar" size={12} />
              {formatDueDate(goal.dueDate, today)}
            </span>
          ) : null}
          {complete ? (
            <span className="achieved-stamp" aria-label="目标已达成">
              成
            </span>
          ) : null}
        </div>

        <h3 className="goal-title">{goal.title}</h3>
        {goal.why ? <p className="goal-why">{goal.why}</p> : null}

        <div className="goal-progress-row">
          <span className="goal-progress-numbers">
            {doneCount} / {total} 步
          </span>
          <span className="goal-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </span>
          <span className="goal-percent">{percent}%</span>
          <span className={expanded ? 'goal-chevron is-open' : 'goal-chevron'} aria-hidden="true">
            <Icon name="chevronDown" size={16} />
          </span>
        </div>
      </div>

      {expanded ? (
        <div className="goal-tasks" id={tasksId}>
          {orderedTasks.length ? (
            <ul className="task-list">
              {orderedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  goalTitle={goal.title}
                  onToggle={handleToggleTask}
                  onEdit={handleEditTask}
                />
              ))}
            </ul>
          ) : null}

          {adding ? (
            <form className="task-add" onSubmit={submitTask}>
              <span className="task-add-mark" aria-hidden="true">
                <Icon name="plus" size={15} />
              </span>
              <input
                ref={inputRef}
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                onKeyDown={onInputKeyDown}
                onBlur={() => {
                  if (!taskTitle.trim()) setAdding(false)
                }}
                placeholder="下一步，先做点什么？"
                aria-label={`为「${goal.title}」添加一步`}
                maxLength={300}
                enterKeyHint="done"
              />
              <button
                type="submit"
                className="task-add-submit"
                disabled={!taskTitle.trim()}
                aria-label="添加这一步"
              >
                <Icon name="arrowRight" size={16} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="task-add-open"
              aria-label={`为「${goal.title}」添加一步`}
              onClick={() => setAdding(true)}
            >
              <Icon name="plus" size={16} />
            </button>
          )}

          {complete ? (
            <div className="goal-finished-note">
              <Icon name="checkCircle" size={15} />
              所有步子都已走完。想继续，就在上面添新的一步。
            </div>
          ) : null}
        </div>
      ) : null}

      {!expanded && !goal.tasks.length ? (
        <div className="goal-quiet-cta">
          <Button variant="ghost" size="small" icon="plus" onClick={handleToggleExpanded}>
            写下第一步
          </Button>
        </div>
      ) : null}
    </article>
  )
})
