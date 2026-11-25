import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Modal'
import { TagEditor } from '../../components/TagEditor'
import { useApp } from '../../lib/store'
import type { Idea } from '../../lib/types'
import { formatRecordTime } from '../../lib/date'
import { AiPolishSheet } from './AiPolishSheet'

// Long enough that continuous typing stays local, short enough that a pause
// still lands the text in the store (and the local backup) on its own.
const AUTOSAVE_MS = 700

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const latestBody = useRef(body)
  const latestIdea = useRef(idea)
  const commitTimer = useRef<number | null>(null)
  const resizeFrame = useRef<number | null>(null)

  latestBody.current = body
  latestIdea.current = idea

  const commit = useCallback(
    (text: string) => {
      const current = latestIdea.current
      if (!current || !text.trim() || text === current.text) return
      dispatch({ type: 'idea/update', id: current.id, patch: { text } })
    },
    [dispatch],
  )

  const clearCommitTimer = useCallback(() => {
    if (commitTimer.current !== null) {
      window.clearTimeout(commitTimer.current)
      commitTimer.current = null
    }
  }, [])

  const flushBody = useCallback(
    (text: string) => {
      clearCommitTimer()
      commit(text)
    },
    [clearCommitTimer, commit],
  )

  const scheduleCommit = useCallback(() => {
    clearCommitTimer()
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = null
      commit(latestBody.current)
    }, AUTOSAVE_MS)
  }, [clearCommitTimer, commit])

  const applyHeight = useCallback(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, window.innerHeight * 0.58)}px`
  }, [])

  // Keystrokes only schedule one measurement per frame instead of forcing a
  // synchronous layout inside every input event.
  const queueResize = useCallback(() => {
    if (resizeFrame.current !== null) return
    resizeFrame.current = window.requestAnimationFrame(() => {
      resizeFrame.current = null
      applyHeight()
    })
  }, [applyHeight])

  useEffect(() => {
    if (open && idea) {
      setBody(idea.text)
      setUndoText(null)
      setAiOpen(false)
      clearCommitTimer()
      queueResize()
    } else {
      setAiOpen(false)
    }
    // Re-sync only when opening or switching notes; typing is kept locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea?.id, open])

  useEffect(
    () => () => {
      clearCommitTimer()
      if (resizeFrame.current !== null) window.cancelAnimationFrame(resizeFrame.current)
    },
    [clearCommitTimer],
  )

  if (!idea) return null

  const updateBody = (next: string) => {
    setBody(next)
    setUndoText(null)
    scheduleCommit()
    queueResize()
  }

  const handleClose = () => {
    flushBody(body)
    flushSave()
    onClose()
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={handleClose}
        title="念头详情"
        titleId="idea-detail-title"
        panelClassName="idea-detail-sheet"
        bodyClassName="idea-detail-body"
        headContent={
          <div className="idea-detail-head">
            <span className="idea-detail-record">
              <span className="idea-detail-record-label">最后记录</span>
              <time dateTime={new Date(idea.updatedAt).toISOString()}>
                {formatRecordTime(idea.updatedAt)}
              </time>
            </span>
            {idea.pinned ? (
              <span className="idea-detail-pin">
                <Icon name="pin" size={12} filled />
                已置顶
              </span>
            ) : null}
            <span className="idea-detail-count">{body.trim().length} 字</span>
          </div>
        }
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
                clearCommitTimer()
                queueResize()
              }}
            >
              撤回
            </button>
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          className="idea-detail-text"
          value={body}
          onChange={(event) => updateBody(event.target.value)}
          onBlur={() => {
            flushBody(latestBody.current)
            queueResize()
          }}
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
          clearCommitTimer()
          queueResize()
          dispatch({ type: 'idea/update', id: idea.id, patch: { text: next } })
        }}
      />
    </>
  )
}
