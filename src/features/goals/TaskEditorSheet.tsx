import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Modal'
import { DOMAIN_MAP, PRIORITIES } from '../../lib/domains'
import type { Goal, Priority, Task } from '../../lib/types'
import { addDays, formatDueDate, toDateKey } from '../../lib/date'
import { cx } from '../../lib/utils'

interface TaskEditorSheetProps {
  open: boolean
  goal: Goal | null
  task: Task | null
  onClose: () => void
  onSave: (values: { title: string; dueDate: string | null; priority: Priority }) => void
  onRequestDelete: (goal: Goal, task: Task) => void
}

export function TaskEditorSheet({
  open,
  goal,
  task,
  onClose,
  onSave,
  onRequestDelete,
}: TaskEditorSheetProps) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [priority, setPriority] = useState<Priority>('normal')
  const [error, setError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !task) return
    setTitle(task.title)
    setDueDate(task.dueDate)
    setPriority(task.priority)
    setError('')
  }, [open, task])

  if (!goal || !task) return null

  const handleSave = () => {
    if (!title.trim()) {
      setError('这一步总得有个名字。')
      titleRef.current?.focus()
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
      footer={
        <div className="sheet-foot-split">
          <Button variant="ghost" icon="trash" onClick={() => onRequestDelete(goal, task)}>
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
          <button type="button" className="mini-action" onClick={() => setDueDate(toDateKey())}>
            今天
          </button>
          <button
            type="button"
            className="mini-action"
            onClick={() => setDueDate(toDateKey(addDays(new Date(), 1)))}
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
            ? `会出现在 ${formatDueDate(dueDate)} 的优先清单里。`
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
