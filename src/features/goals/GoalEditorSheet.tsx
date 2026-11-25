import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Modal'
import { DOMAINS } from '../../lib/domains'
import type { DomainKey, Goal } from '../../lib/types'
import { toDateKey, addDays, formatDueDate } from '../../lib/date'
import { cx } from '../../lib/utils'

interface GoalEditorSheetProps {
  open: boolean
  mode: 'create' | 'edit'
  goal: Goal | null
  initialDomain?: DomainKey
  onClose: () => void
  onSave: (values: { title: string; why: string; domain: DomainKey; dueDate: string | null }) => void
  onRequestDelete?: (goal: Goal) => void
}

export function GoalEditorSheet({
  open,
  mode,
  goal,
  initialDomain = 'life',
  onClose,
  onSave,
  onRequestDelete,
}: GoalEditorSheetProps) {
  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const [domain, setDomain] = useState<DomainKey>(initialDomain)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [error, setError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && goal) {
      setTitle(goal.title)
      setWhy(goal.why)
      setDomain(goal.domain)
      setDueDate(goal.dueDate)
    } else {
      setTitle('')
      setWhy('')
      setDomain(initialDomain)
      setDueDate(null)
    }
    setError('')
  }, [goal, initialDomain, mode, open])

  const handleSave = () => {
    const cleaned = title.trim()
    if (!cleaned) {
      setError('先给这件事一个名字。')
      titleRef.current?.focus()
      return
    }
    onSave({ title: cleaned, why: why.trim(), domain, dueDate })
  }

  const tomorrow = toDateKey(addDays(new Date(), 1))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'create' ? '立下一个目标' : '整理这个目标'}
      eyebrow={mode === 'create' ? 'A NEW DIRECTION' : 'GOAL SETTINGS'}
      subtitle={mode === 'create' ? '先写方向，下一步可以慢慢补。' : '把方向调准确，再继续走。'}
      titleId="goal-editor-title"
      panelClassName="goal-editor-sheet"
      footer={
        <div className="sheet-foot-split">
          {mode === 'edit' && goal && onRequestDelete ? (
            <Button variant="ghost" icon="trash" onClick={() => onRequestDelete(goal)}>
              删除目标
            </Button>
          ) : (
            <span />
          )}
          <div className="footer-button-group">
            <Button variant="ghost" onClick={onClose}>
              先不
            </Button>
            <Button variant="primary" icon={mode === 'create' ? 'compass' : 'check'} onClick={handleSave}>
              {mode === 'create' ? '立下目标' : '保存修改'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="form-field">
        <label className="field-label" htmlFor="goal-title">
          想做成什么
        </label>
        <input
          ref={titleRef}
          id="goal-title"
          className={cx('text-field', error && 'has-error')}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            if (error) setError('')
          }}
          placeholder="例如：把身体重新练回有力量的状态"
          maxLength={120}
        />
        {error ? <p className="field-error">{error}</p> : null}
      </div>

      <div className="form-field">
        <span className="field-label">属于哪一类</span>
        <div className="domain-picker" role="group" aria-label="目标分类">
          {DOMAINS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={domain === item.key}
              className={cx('domain-option', `domain-${item.key}`, domain === item.key && 'is-selected')}
              onClick={() => setDomain(item.key)}
            >
              <span className="domain-option-dot" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor="goal-due">
          想到哪一天
          <span className="field-optional">可选</span>
        </label>
        <div className="date-row">
          <input
            id="goal-due"
            type="date"
            className="date-field"
            value={dueDate ?? ''}
            onChange={(event) => setDueDate(event.target.value || null)}
          />
          <button
            type="button"
            className="mini-action"
            onClick={() => setDueDate(toDateKey())}
          >
            今天
          </button>
          <button
            type="button"
            className="mini-action"
            onClick={() => setDueDate(tomorrow)}
          >
            明天
          </button>
          {dueDate ? (
            <button type="button" className="mini-action is-muted" onClick={() => setDueDate(null)}>
              不设
            </button>
          ) : null}
        </div>
        <p className="field-hint">
          {dueDate ? `这件事想在 ${formatDueDate(dueDate)} 之前收口。` : '不设期限也可以，先把第一步走起来。'}
        </p>
      </div>

      <div className="form-field">
        <label className="field-label" htmlFor="goal-why">
          为什么想做成它
          <span className="field-optional">可选</span>
        </label>
        <textarea
          id="goal-why"
          className="textarea-field"
          value={why}
          onChange={(event) => setWhy(event.target.value)}
          placeholder="写一句对自己说的话。走到一半时，它会提醒你最初为什么出发。"
          rows={3}
          maxLength={1000}
        />
      </div>

      <p className="form-footnote">
        <Icon name="bulb" size={14} />
        目标给方向；下一步写成任务，才更容易开始。
      </p>
    </Sheet>
  )
}
