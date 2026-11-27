import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Modal'
import { TagEditor } from '../../components/TagEditor'
import { useToast } from '../../components/Toast'
import { formatRecordTime } from '../../lib/date'
import { clearDraft, loadDraft, saveDraft } from '../../lib/draft'
import { useApp } from '../../lib/store'
import type { Idea } from '../../lib/types'
import { cx, isMac, newId } from '../../lib/utils'
import { AiPolishSheet } from './AiPolishSheet'

export type IdeaSheetMode = 'create' | 'edit'

interface IdeaSheetProps {
  open: boolean
  mode: IdeaSheetMode
  idea: Idea | null
  allTags: string[]
  onClose: () => void
  onCreated: (id: string) => void
  onReopen: () => void
  onRequestDelete: (idea: Idea) => Promise<string | null>
}

/**
 * One sheet for both writing a new thought and editing a saved one. The two
 * flows share the same textarea, tag editor, AI polish and mobile keyboard
 * behaviour; only the header and the footer's primary action differ.
 */
export function IdeaSheet({
  open,
  mode,
  idea,
  allTags,
  onClose,
  onCreated,
  onReopen,
  onRequestDelete,
}: IdeaSheetProps) {
  const { dispatch, flushSave, saveStatus, getData } = useApp()
  const { showToast } = useToast()
  const isEdit = mode === 'edit'
  const [initialDraft] = useState(loadDraft)
  const [text, setText] = useState(isEdit ? (idea?.text ?? '') : (initialDraft?.text ?? ''))
  const [tags, setTags] = useState<string[]>(
    isEdit ? (idea?.tags ?? []) : (initialDraft?.tags ?? []),
  )
  const [showTags, setShowTags] = useState(isEdit || Boolean(initialDraft?.tags.length))
  const [restored, setRestored] = useState(!isEdit && Boolean(initialDraft))
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiUndo, setAiUndo] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const latestText = useRef(text)
  const resizeFrame = useRef<number | null>(null)
  const submitting = useRef(false)

  const applyHeight = useCallback(() => {
    const element = textareaRef.current
    if (!element || CSS.supports('field-sizing', 'content')) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, window.innerHeight * 0.52)}px`
  }, [])

  // Keystrokes only schedule one measurement per frame instead of forcing a
  // synchronous layout inside every input event.
  const queueResize = useCallback(() => {
    if (resizeFrame.current !== null || CSS.supports('field-sizing', 'content')) return
    resizeFrame.current = window.requestAnimationFrame(() => {
      resizeFrame.current = null
      applyHeight()
    })
  }, [applyHeight])

  // Measure once before the sheet is painted: a long thought must not make
  // the panel grow a frame into its own entrance animation.
  useLayoutEffect(() => {
    if (open) applyHeight()
  }, [open, mode, idea?.id, applyHeight])

  // Draft only belongs to a thought that has not been saved yet. Writing it
  // from the change handlers keeps an edit sheet's text from ever being
  // mistaken for a draft.
  const persistDraft = (nextText: string, nextTags: string[]) => {
    if (isEdit) return
    if (nextText.trim() || nextTags.length) {
      saveDraft({ text: nextText, tags: nextTags, updatedAt: Date.now() })
    } else {
      clearDraft()
    }
  }

  useEffect(() => {
    if (!open) {
      setAiOpen(false)
      return
    }

    setAiUndo(null)
    setDeleteError(null)

    if (isEdit) {
      const nextText = idea?.text ?? ''
      setText(nextText)
      setTags(idea?.tags ?? [])
      setShowTags(true)
      setRestored(false)
      latestText.current = nextText
      queueResize()
    } else {
      queueResize()
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, idea?.id])

  useEffect(() => {
    if (!open || !isEdit || !idea || getData().ideas.find((item) => item.id === idea.id) !== idea) return
    // Only synchronize the current store revision. A React render may still
    // show an older published snapshot while the user has typed beyond it.
    if (latestText.current.trim() && latestText.current !== idea.text) {
      latestText.current = idea.text
      setText(idea.text)
      setAiUndo(null)
      queueResize()
    }
    setTags(idea.tags)
  }, [open, isEdit, idea, getData, queueResize])

  useEffect(
    () => () => {
        if (resizeFrame.current !== null) window.cancelAnimationFrame(resizeFrame.current)
    },
    [],
  )

  const reset = () => {
    setText('')
    latestText.current = ''
    setTags([])
    setShowTags(false)
    setRestored(false)
    setAiUndo(null)
    clearDraft()
    queueResize()
  }

  const submit = async () => {
    if (submitting.current) return
    const cleaned = text.trim()
    if (!cleaned) {
      textareaRef.current?.focus()
      return
    }

    const now = Date.now()
    const nextIdea: Idea = {
      id: newId(),
      text: cleaned,
      tags,
      pinned: false,
      pinnedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    submitting.current = true
    if (!dispatch({ type: 'idea/add', idea: nextIdea })) {
      submitting.current = false
      return
    }
    reset()
    onCreated(nextIdea.id)
    const saved = await flushSave()
    submitting.current = false
    if (!saved) return
    showToast('已收进念头', {
      actionLabel: '撤回',
      onAction: () => {
        if (!dispatch({ type: 'idea/undoAdd', idea: nextIdea })) return
        setText(cleaned)
        latestText.current = cleaned
        setTags(tags)
        setShowTags(Boolean(tags.length))
        setRestored(false)
        saveDraft({ text: cleaned, tags, updatedAt: Date.now() })
        onReopen()
      },
    })
  }

  const finishEditing = async () => {
    if (await flushSave()) onClose()
  }

  const handleClose = () => {
    if (isEdit) void flushSave()
    onClose()
  }

  const updateText = (next: string) => {
    setText(next)
    latestText.current = next
    setRestored(false)
    setAiUndo(null)
    queueResize()
    persistDraft(next, tags)
    if (isEdit && idea && next.trim()) {
      dispatch({ type: 'idea/update', id: idea.id, patch: { text: next, tags } })
    }
  }

  const updateTags = (next: string[]) => {
    setTags(next)
    persistDraft(text, next)
    if (isEdit && idea) {
      dispatch({ type: 'idea/update', id: idea.id, patch: { tags: next, ...(latestText.current.trim() ? { text: latestText.current } : {}) } })
    }
  }

  const restoreAiText = (previous: string) => {
    setText(previous)
    latestText.current = previous
    setAiUndo(null)
    queueResize()
    persistDraft(previous, tags)
    if (isEdit && idea) {
        dispatch({ type: 'idea/update', id: idea.id, patch: { text: previous, tags } })
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      if (isEdit) void finishEditing()
      else void submit()
    }
  }

  const activeIdea = isEdit ? idea : null
  const canSubmit = Boolean(text.trim())

  return (
    <>
      <Sheet
        open={open}
        onClose={handleClose}
        title={isEdit ? '念头详情' : '此刻的念头'}
        subtitle={isEdit ? undefined : '只在此设备，草稿会自动留住。'}
        headContent={
          isEdit && activeIdea ? (
            <div className="idea-detail-head">
              <span className="idea-detail-record">
                <span className="idea-detail-record-label">最后记录</span>
                <time dateTime={new Date(activeIdea.updatedAt).toISOString()}>
                  {formatRecordTime(activeIdea.updatedAt)}
                </time>
              </span>
              {activeIdea.pinned ? (
                <span className="idea-detail-pin">
                  <Icon name="pin" size={12} filled />
                  已置顶
                </span>
              ) : null}
              <span className="idea-detail-count">{text.trim().length} 字</span>
            </div>
          ) : undefined
        }
        titleId="idea-sheet-title"
        panelClassName={cx('idea-sheet', isEdit ? 'idea-detail-sheet' : 'idea-composer-sheet')}
        bodyClassName={isEdit ? 'idea-detail-body' : 'idea-composer-body'}
        initialFocusRef={textareaRef}
        footer={
          isEdit && activeIdea ? (
            <div className="idea-detail-actions">
              <div className="idea-detail-sub-actions">
                <button
                  type="button"
                  className={activeIdea.pinned ? 'detail-tool is-active' : 'detail-tool'}
                  onClick={() =>
                    dispatch({ type: 'idea/togglePin', id: activeIdea.id })
                  }
                >
                  <Icon name="pin" size={16} filled={activeIdea.pinned} />
                  {activeIdea.pinned ? '已置顶' : '置顶'}
                </button>
                <button
                  type="button"
                  className="detail-tool detail-tool-danger"
                  onClick={async () => setDeleteError(await onRequestDelete(activeIdea))}
                >
                  <Icon name="trash" size={16} />
                  删除
                </button>
                {canSubmit ? (
                  <button
                    type="button"
                    className="tool-button tool-ai"
                    onClick={() => setAiOpen(true)}
                  >
                    <Icon name="spark" size={16} />
                    <span>AI 润色</span>
                  </button>
                ) : null}
              </div>
              <Button variant="primary" icon="check" onClick={finishEditing}>
                完成
              </Button>
            </div>
          ) : (
            <div className="composer-foot">
              <div className="composer-foot-tools">
                <button
                  type="button"
                  className={cx('tool-button', showTags && 'is-active')}
                  onClick={() => setShowTags((value) => !value)}
                  aria-expanded={showTags}
                >
                  <Icon name="tag" size={16} />
                  <span>{tags.length ? `${tags.length} 个标签` : '标签'}</span>
                </button>
                {canSubmit ? (
                  <button
                    type="button"
                    className="tool-button tool-ai"
                    onClick={() => setAiOpen(true)}
                  >
                    <Icon name="spark" size={16} />
                    <span>AI 润色</span>
                  </button>
                ) : null}
              </div>
              <div className="composer-foot-submit">
                <span className="keyboard-hint" aria-hidden="true">
                  {isMac() ? '⌘ ↵' : 'Ctrl ↵'}
                </span>
                <Button
                  variant="primary"
                  iconAfter="arrowRight"
                  onClick={submit}
                  disabled={!canSubmit}
                >
                  收下
                </Button>
              </div>
            </div>
          )
        }
      >
        <textarea
          ref={textareaRef}
          id="idea-sheet-text"
          className="idea-sheet-text"
          value={text}
          onChange={(event) => updateText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            isEdit ? '把这一念写完整…' : '此刻在想什么？先写下来，不求完整。'
          }
          aria-label={isEdit ? '念头正文' : '写下一个念头'}
          rows={5}
        />

        {restored && text.trim() ? (
          <div className="composer-restore">
            <Icon name="clock" size={14} />
            <span>已找回上次没写完的草稿</span>
            <button type="button" onClick={() => setRestored(false)}>
              知道了
            </button>
          </div>
        ) : null}

        {aiUndo !== null ? (
          <div className="inline-undo">
            <Icon name="spark" size={14} />
            <span>已换成润色后的文字</span>
            <button type="button" onClick={() => restoreAiText(aiUndo)}>
              撤回
            </button>
          </div>
        ) : null}

        {isEdit || showTags ? (
          <div className={isEdit ? 'idea-detail-tags' : 'composer-tags'}>
            {isEdit ? <p className="field-label">分类</p> : null}
            <TagEditor
              value={tags}
              onChange={updateTags}
              suggestions={allTags}
              placeholder={isEdit ? '加一个标签，回车确认' : '加标签，回车确认'}
            />
          </div>
        ) : null}

        {deleteError ? <p className="field-error" role="alert">{deleteError}</p> : null}

        {isEdit && (saveStatus === 'failed' || saveStatus === 'conflict') ? (
          <p className="field-hint field-hint-warn" role="alert">
            <Icon name="alert" size={13} />
            {saveStatus === 'conflict' ? '另一页已保存新版。关闭详情后可以导出这里的编辑。' : '尚未保存。再次点击完成可以重试。'}
          </p>
        ) : null}

        {isEdit && !text.trim() ? (
          <p className="field-hint field-hint-warn">
            <Icon name="alert" size={13} />
            至少写一句才会保存；或用下方删除这则念头。
          </p>
        ) : null}
      </Sheet>

      <AiPolishSheet
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onAfterClose={() => { if (open) textareaRef.current?.focus({ preventScroll: true }) }}
        sourceText={text}
        contextLabel={isEdit ? '润色这则已经收下的念头' : '润色正在写的这则念头'}
        onApply={(next) => {
          const previous = text
          setText(next)
          latestText.current = next
          setAiUndo(previous)
          setRestored(false)
          queueResize()
          persistDraft(next, tags)
          if (isEdit && activeIdea) {
                    dispatch({ type: 'idea/update', id: activeIdea.id, patch: { text: next, tags } })
          }

        }}
      />
    </>
  )
}
