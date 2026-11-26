import { useEffect, useState } from 'react'
import { Button, IconButton } from '../../components/Button'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Modal'
import { formatNoteTime } from '../../lib/date'
import { useApp } from '../../lib/store'
import {
  TRASH_KIND_LABEL,
  TRASH_LIMIT_BYTES,
  formatBytes,
  trashBytes,
  trashNote,
  trashTitle,
} from '../../lib/trash'
import type { TrashEntry } from '../../lib/types'
import { cx } from '../../lib/utils'

interface TrashSheetProps {
  open: boolean
  onClose: () => void
}

type Notice = { tone: 'ok' | 'error'; text: string } | null

export function TrashSheet({ open, onClose }: TrashSheetProps) {
  const { data, dispatch } = useApp()
  const [clearOpen, setClearOpen] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const entries = data.trash
  const used = trashBytes(entries)
  const ratio = Math.min(1, used / TRASH_LIMIT_BYTES)
  const goalIds = new Set(data.goals.map((goal) => goal.id))

  // A step that was deleted together with its goal has nowhere to go back to.
  const canRestore = (entry: TrashEntry) =>
    entry.kind !== 'task' || Boolean(entry.task && goalIds.has(entry.task.goalId))

  // Feedback stays inside the sheet: a toast would sit underneath the dialog
  // while it is open, which is exactly when these presses happen.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!open) setNotice(null)
  }, [open])

  const restore = (entry: TrashEntry) => {
    if (!canRestore(entry)) {
      setNotice({ tone: 'error', text: '原目标已删除，这一步放不回去了' })
      return
    }
    dispatch({ type: 'trash/restore', entryId: entry.id })
    setNotice({ tone: 'ok', text: '已经放回去了' })
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="最近删除"
        subtitle={`删掉的东西先落在这里，最多留 ${formatBytes(TRASH_LIMIT_BYTES)}。`}
        titleId="trash-title"
        panelClassName="trash-sheet"
        bodyClassName="trash-body"
        footer={
          entries.length ? (
            <div className="sheet-foot-split">
              <span className="trash-usage">
                已用 {formatBytes(used)} / {formatBytes(TRASH_LIMIT_BYTES)}
              </span>
              <Button variant="danger" icon="trash" onClick={() => setClearOpen(true)}>
                彻底删除全部
              </Button>
            </div>
          ) : (
            <span className="trash-usage">已用 {formatBytes(used)}</span>
          )
        }
      >
        <div className="trash-meter" aria-hidden="true">
          <span style={{ transform: `scaleX(${ratio})` }} />
        </div>

        {notice ? (
          <p className={cx('trash-notice', `notice-${notice.tone}`)} role="status">
            <Icon name={notice.tone === 'ok' ? 'checkCircle' : 'alert'} size={14} />
            {notice.text}
          </p>
        ) : null}

        {entries.length ? (
          <>
            <p className="trash-hint">
              超过 {formatBytes(TRASH_LIMIT_BYTES)} 之后，最旧的记录会被自动清掉。想留住哪一条，就早点恢复它。
            </p>
            <ul className="trash-list">
              {entries.map((entry) => (
                <li className="trash-item" key={entry.id}>
                  <div className="trash-item-main">
                    <span className={cx('trash-kind', `trash-kind-${entry.kind}`)}>
                      {TRASH_KIND_LABEL[entry.kind]}
                    </span>
                    <p className="trash-text">{trashTitle(entry)}</p>
                    <p className="trash-meta">
                      {formatNoteTime(entry.deletedAt)} 删除
                      {trashNote(entry) ? ` · ${trashNote(entry)}` : ''}
                      {canRestore(entry) ? '' : ' · 原目标已不在'}
                    </p>
                  </div>
                  <div className="trash-item-actions">
                    <button
                      type="button"
                      className="mini-action"
                      onClick={() => restore(entry)}
                      disabled={!canRestore(entry)}
                    >
                      恢复
                    </button>
                    <IconButton
                      label="彻底删除这一条"
                      icon="trash"
                      size={15}
                      subtle
                      onClick={() => dispatch({ type: 'trash/purge', entryId: entry.id })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState
            mark="净"
            title="这里空着"
            body="删掉的念头、目标和步骤会先落到这里，反悔了还能拿回去。"
            compact
          />
        )}
      </Sheet>

      <ConfirmSheet
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          dispatch({ type: 'trash/clear' })
          setNotice({ tone: 'ok', text: '最近删除已清空' })
        }}
        title="要把这些都彻底删掉吗？"
        confirmLabel="彻底删除"
        description={
          <div className="delete-preview">
            <p>{entries.length} 条记录会从这台设备上消失。</p>
            <small>清掉之后就找不回来了，建议先确认没有还要留下的。</small>
          </div>
        }
      />
    </>
  )
}
