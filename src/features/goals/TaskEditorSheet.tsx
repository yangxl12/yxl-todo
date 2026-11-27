import { useCalendarDay } from '../../lib/calendarDay'
import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Modal'
import { DOMAIN_MAP, PRIORITIES } from '../../lib/domains'
import type { Goal, Priority, Task } from '../../lib/types'
import { addDays, formatDueDate, toDateKey } from '../../lib/date'
import { cx } from '../../lib/utils'
import { useApp } from '../../lib/store'

interface TaskEditorSheetProps {
  open: boolean
  goal: Goal | null
  task: Task | null
  onClose: () => void
  onSave: (values: { title: string; dueDate: string | null; priority: Priority }) => void
  onRequestDelete: (goal: Goal, task: Task) => Promise<string | null>
}

export function TaskEditorSheet({
  open,
  goal,
  task,
  onClose,
  onSave,
  onRequestDelete,
}: TaskEditorSheetProps) {
  // Remounted on every open, so the task being edited is already in state.
  const [title, setTitle] = useState(task?.title ?? '')
  const [dueDate, setDueDate] = useState<string | null>(task?.dueDate ?? null)
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'normal')
  const today = useCalendarDay()
  const [error, setError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const initial = useRef(task)
  const { getData } = useApp()

  if (!goal || !task) return null

  const handleSave = () => {
    if (!title.trim()) {
      setError('这一步总得有个名字。')
      titleRef.current?.focus()
      return
    }
    const original = initial.current
    const saved = getData().goals.find((item) => item.id === goal.id)?.tasks.find((item) => item.id === task.id)
    if (!original || !saved || saved.title !== original.title ||
        saved.dueDate !== original.dueDate || saved.priority !== original.priority) {
      setError('这一步已在另一页改动。可以复制当前输入，再打开最新版。')
      return
    }
    onSave({ title: title.trim(), dueDate, priority })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="安排这一步"
      subtitle={`${DOMAIN_MAP[goal.domain].label} · 在目标「${goal.title}」之下`}
      titleId="task-editor-title"
      panelClassName="sheet-small task-editor-sheet"
      initialFocusRef={titleRef}
      footer={
        <div className="sheet-foot-split">
          <Button variant="ghost" icon="trash" onClick={async () => setError(await onRequestDelete(goal, task) ?? '')}>
            删除
          </Button>
          <Button variant="primary" icon="check" onClick={handleSave}>
            保存这一步
          </Button>
        </div>
      }
    >
      <div className="form-field">
        <label className="field-label" htmlFor="task-title">
          下一步是什么
        </label>
        <input
          ref={titleRef}
          id="task-title"
          className={cx('text-field', error && 'has-error')}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            if (error) setError('')
          }}
          placeholder="尽量写成今天能开始的动作"
          maxLength={300}
        />
        {error ? <p className="field-error">{error}</p> : null}
      </div>

      <div className="form-field">
        <span className="field-label">要紧程度</span>
        <div className="priority-picker" role="group" aria-label="任务要紧程度">
          {PRIORITIES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={priority === item.value}
              className={cx('priority-option', `priority-${item.value}`, priority === item.value && 'is-selected')}
              onClick={() => setPriority(item.value)}
            >
              <span className="priority-dot" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor="task-due">
          哪一天做
          <span className="field-optional">可选</span>
        </label>
        <div className="date-row">
          <input
            id="task-due"
            type="date"
            className="date-field"
            value={dueDate ?? ''}
            onChange={(event) => setDueDate(event.target.value || null)}
          />
          <button type="button" className="mini-action" onClick={() => setDueDate(toDateKey(today))}>
            今天
          </button>
          <button
            type="button"
            className="mini-action"
            onClick={() => setDueDate(toDateKey(addDays(today, 1)))}
          >
            明天
          </button>
          {dueDate ? (
            <button type="button" className="mini-action is-muted" onClick={() => setDueDate(null)}>
              清除
            </button>
          ) : null}
        </div>
        <p className="field-hint">
          {dueDate
            ? `会出现在 ${formatDueDate(dueDate, today)} 的优先清单里。`
            : '不设日期也可以。它仍会留在这个目标里。'}
        </p>
      </div>

      <p className="form-footnote">
        <Icon name="flag" size={14} />
        任务排序会自动把有日期、要紧的步骤放在前面。
      </p>
    </Sheet>
  )
}
