import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button, IconButton } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { DOMAIN_MAP, PRIORITY_LABEL } from '../../lib/domains'
import { formatDueDate, getDueTone } from '../../lib/date'
import type { Goal, Task } from '../../lib/types'
import { cx } from '../../lib/utils'
import {
  completedTaskCount,
  goalProgress,
  isGoalComplete,
  orderDoneTasks,
  orderOpenTasks,
} from './taskUtils'

interface GoalCardProps {
  goal: Goal
  expanded: boolean
  onToggleExpanded: () => void
  onEdit: () => void
  onToggleTask: (task: Task) => void
  onEditTask: (task: Task) => void
  onAddTask: (title: string) => void
}

function TaskRow({
  task,
  goalTitle,
  onToggle,
  onEdit,
}: {
  task: Task
  goalTitle: string
  onToggle: () => void
  onEdit: () => void
}) {
  const tone = getDueTone(task.dueDate, task.done)

  return (
    <li className={cx('task-row', task.done && 'is-done')}>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `把「${task.title}」标为未完成` : `完成「${task.title}」`}
        className="task-check"
        onClick={onToggle}
      >
        <Icon name="check" size={14} />
      </button>
      <div className="task-main">
        <button
          type="button"
          className="task-title"
          onClick={onEdit}
          title={`编辑这一步：${goalTitle}`}
        >
          {task.title}
        </button>
        {!task.done && (task.dueDate || task.priority !== 'normal') ? (
          <span className="task-meta">
            {task.dueDate ? (
              <span className={cx('task-due', tone && `due-${tone}`)}>
                <Icon name="calendar" size={12} />
                {formatDueDate(task.dueDate)}
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
        onClick={onEdit}
      />
    </li>
  )
}

export function GoalCard({
  goal,
  expanded,
  onToggleExpanded,
  onEdit,
  onToggleTask,
  onEditTask,
  onAddTask,
}: GoalCardProps) {
  const [taskTitle, setTaskTitle] = useState('')
  const [showDone, setShowDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const complete = isGoalComplete(goal)
  const progress = goalProgress(goal)
  const doneCount = completedTaskCount(goal)
  const openTasks = orderOpenTasks(goal.tasks.filter((task) => !task.done))
  const doneTasks = orderDoneTasks(goal.tasks.filter((task) => task.done))
  const domain = DOMAIN_MAP[goal.domain]
  const tone = getDueTone(goal.dueDate, complete)
  const showCompletedBlock = !complete && doneTasks.length > 0
  const tasksId = `goal-tasks-${goal.id}`

  const submitTask = (event?: FormEvent) => {
    event?.preventDefault()
    const cleaned = taskTitle.trim()
    if (!cleaned) {
      inputRef.current?.focus()
      return
    }
    onAddTask(cleaned)
    setTaskTitle('')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submitTask()
    }
  }

  return (
    <article
      className={cx(
        'goal-card',
        `domain-${goal.domain}`,
        complete && 'is-complete',
      )}
      id={`goal-${goal.id}`}
    >
      <div className="goal-accent" aria-hidden="true" />
      <IconButton
        label="编辑目标"
        icon="more"
        size={18}
        subtle
        className="goal-edit-button"
        onClick={onEdit}
      />
      <div
        className="goal-summary"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={tasksId}
        onClick={onToggleExpanded}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggleExpanded()
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
              {formatDueDate(goal.dueDate)}
            </span>
          ) : (
            <span className="goal-due is-soft">不设期</span>
          )}
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
            {doneCount} / {goal.tasks.length} 步
          </span>
          <span className="goal-bar" aria-hidden="true">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
          <span className="goal-percent">{Math.round(progress * 100)}%</span>
          <span className={expanded ? 'goal-chevron is-open' : 'goal-chevron'} aria-hidden="true">
            <Icon name="chevronDown" size={16} />
          </span>
        </div>
      </div>

      {expanded ? (
        <div className="goal-tasks" id={tasksId}>
          {goal.tasks.length === 0 ? (
            <div className="goal-empty-tasks">
              <p>还没有下一步。</p>
              <span>把第一步写小一点：小到今天就能开始。</span>
            </div>
          ) : null}

          {openTasks.length ? (
            <ul className="task-list">
              {openTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  goalTitle={goal.title}
                  onToggle={() => onToggleTask(task)}
                  onEdit={() => onEditTask(task)}
                />
              ))}
            </ul>
          ) : null}

          {showCompletedBlock ? (
            <div className="completed-tasks">
              <button
                type="button"
                className="completed-toggle"
                onClick={() => setShowDone((value) => !value)}
                aria-expanded={showDone}
              >
                <span>
                  已完成 {doneTasks.length} 步
                </span>
                <Icon
                  name="chevronDown"
                  size={14}
                  className={cx('chevron', showDone && 'is-up')}
                />
              </button>
              {showDone ? (
                <ul className="task-list task-list-done">
                  {doneTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      goalTitle={goal.title}
                      onToggle={() => onToggleTask(task)}
                      onEdit={() => onEditTask(task)}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {complete && expanded && doneTasks.length ? (
            <div className="completed-tasks">
              <p className="completed-label">已走完的步子</p>
              <ul className="task-list task-list-done">
                {doneTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    goalTitle={goal.title}
                    onToggle={() => onToggleTask(task)}
                    onEdit={() => onEditTask(task)}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          <form className="task-add" onSubmit={submitTask}>
            <span className="task-add-mark" aria-hidden="true">
              <Icon name="plus" size={15} />
            </span>
            <input
              ref={inputRef}
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              onKeyDown={onInputKeyDown}
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
          <p className="task-add-hint">回车添加 · 点开一步可设日期与要紧程度</p>

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
          <Button variant="ghost" size="small" icon="plus" onClick={onToggleExpanded}>
            写下第一步
          </Button>
        </div>
      ) : null}
    </article>
  )
}
