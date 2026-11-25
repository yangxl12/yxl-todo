import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Modal'
import { TagEditor } from '../../components/TagEditor'
import { useApp } from '../../lib/store'
import type { Idea } from '../../lib/types'
import { formatNoteTime } from '../../lib/date'
import { AiPolishSheet } from './AiPolishSheet'

interface IdeaDetailSheetProps {
  idea: Idea | null
  open: boolean
  allTags: string[]
  onClose: () => void
  onRequestDelete: (idea: Idea) => void
}

export function IdeaDetailSheet({
  idea,
  open,
  allTags,
  onClose,
  onRequestDelete,
}: IdeaDetailSheetProps) {
  const { dispatch, flushSave } = useApp()
  const [body, setBody] = useState(idea?.text ?? '')
  const [aiOpen, setAiOpen] = useState(false)
  const [undoText, setUndoText] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && idea) {
      setBody(idea.text)
      setUndoText(null)
    }
    // Re-sync only when opening or switching notes; typing is kept locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea?.id, open])

  useEffect(() => {
    if (!open) return
    setAiOpen(false)
    const frame = window.requestAnimationFrame(() => {
      const element = textareaRef.current
      if (!element) return
      element.style.height = 'auto'
      element.style.height = `${Math.min(element.scrollHeight, window.innerHeight * 0.58)}px`
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, idea?.id])

  if (!idea) return null

  const resize = (element: HTMLTextAreaElement | null) => {
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, window.innerHeight * 0.58)}px`
  }

  const updateBody = (next: string) => {
    setBody(next)
    setUndoText(null)
    if (next.trim()) {
      dispatch({ type: 'idea/update', id: idea.id, patch: { text: next } })
    }
  }

  const handleClose = () => {
    if (body.trim() && body !== idea.text) {
      dispatch({ type: 'idea/update', id: idea.id, patch: { text: body } })
    }
    flushSave()
    onClose()
  }

  const edited = idea.updatedAt - idea.createdAt > 60_000

  return (
    <>
      <Sheet
        open={open}
        onClose={handleClose}
        title="一个念头"
        eyebrow="THOUGHT · 自动保存"
        subtitle={`记于 ${formatNoteTime(idea.createdAt)}${edited ? ` · 改于 ${formatNoteTime(idea.updatedAt)}` : ''}`}
        titleId="idea-detail-title"
        panelClassName="idea-detail-sheet"
        bodyClassName="idea-detail-body"
        footer={
          <div className="idea-detail-actions">
            <div className="idea-detail-sub-actions">
              <button
                type="button"
                className={idea.pinned ? 'detail-tool is-active' : 'detail-tool'}
                onClick={() => dispatch({ type: 'idea/togglePin', id: idea.id, now: Date.now() })}
              >
                <Icon name="pin" size={16} filled={idea.pinned} />
                {idea.pinned ? '已置顶' : '置顶'}
              </button>
              <button
                type="button"
                className="detail-tool detail-tool-danger"
                onClick={() => onRequestDelete(idea)}
              >
                <Icon name="trash" size={16} />
                删除
              </button>
            </div>
            <Button
              variant="primary"
              icon="spark"
              onClick={() => setAiOpen(true)}
              disabled={!body.trim()}
            >
              AI 润色
            </Button>
          </div>
        }
      >
        <div className="idea-detail-meta">
          <span className={idea.pinned ? 'detail-state is-pinned' : 'detail-state'}>
            <span className="detail-state-dot" />
            {idea.pinned ? '留在最前' : '未置顶'}
          </span>
          <span>{body.trim().length} 字</span>
        </div>

        {undoText !== null ? (
          <div className="inline-undo">
            <Icon name="spark" size={14} />
            <span>已换成润色后的文字</span>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'idea/update', id: idea.id, patch: { text: undoText } })
                setBody(undoText)
                setUndoText(null)
              }}
            >
              撤回
            </button>
          </div>
        ) : null}

        <textarea
          ref={(node) => {
            textareaRef.current = node
            resize(node)
          }}
          className="idea-detail-text"
          value={body}
          onChange={(event) => {
            updateBody(event.target.value)
            resize(event.currentTarget)
          }}
          onBlur={(event) => resize(event.currentTarget)}
          aria-label="念头正文"
          spellCheck
        />
        {!body.trim() ? (
          <p className="field-hint field-hint-warn">
            <Icon name="alert" size={13} />
            至少写一句才会保存；或用下方删除这则念头。
          </p>
        ) : null}

        <div className="idea-detail-tags">
          <p className="field-label">分类</p>
          <TagEditor
            value={idea.tags}
            onChange={(next) => dispatch({ type: 'idea/update', id: idea.id, patch: { tags: next } })}
            suggestions={allTags}
            placeholder="加一个标签，回车确认"
          />
        </div>
      </Sheet>

      <AiPolishSheet
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        sourceText={body}
        contextLabel="润色这则已经收下的念头"
        onApply={(next) => {
          const previous = body
          setBody(next)
          setUndoText(previous)
          dispatch({ type: 'idea/update', id: idea.id, patch: { text: next } })
        }}
      />
    </>
  )
}
