import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useApp } from '../../lib/store'
import { useToast } from '../../components/Toast'
import { Icon } from '../../components/Icon'
import { TagEditor } from '../../components/TagEditor'
import { AiPolishSheet } from './AiPolishSheet'
import { clearDraft, loadDraft, newId, saveDraft } from '../../lib/storage'
import type { Idea } from '../../lib/types'
import { cx, isMac } from '../../lib/utils'

interface IdeaComposerProps {
  allTags: string[]
  onSaved: (id: string) => void
}

export function IdeaComposer({ allTags, onSaved }: IdeaComposerProps) {
  const { dispatch } = useApp()
  const { showToast } = useToast()
  const [initialDraft] = useState(loadDraft)
  const [text, setText] = useState(initialDraft?.text ?? '')
  const [tags, setTags] = useState<string[]>(initialDraft?.tags ?? [])
  const [showTags, setShowTags] = useState(Boolean(initialDraft?.tags.length))
  const [restored, setRestored] = useState(Boolean(initialDraft))
  const [aiOpen, setAiOpen] = useState(false)
  const [aiUndo, setAiUndo] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (text.trim() || tags.length) {
      saveDraft({ text, tags, updatedAt: Date.now() })
    } else {
      clearDraft()
    }
  }, [text, tags])

  useEffect(() => {
    const onDataChanged = () => {
      setText('')
      setTags([])
      setShowTags(false)
      setRestored(false)
      setAiUndo(null)
      setAiOpen(false)
      clearDraft()
    }
    window.addEventListener('shiyan:data-changed', onDataChanged)
    return () => window.removeEventListener('shiyan:data-changed', onDataChanged)
  }, [])

  const reset = () => {
    setText('')
    setTags([])
    setShowTags(false)
    setRestored(false)
    setAiUndo(null)
    clearDraft()
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const cleaned = text.trim()
    if (!cleaned) {
      textareaRef.current?.focus()
      return
    }

    const now = Date.now()
    const idea: Idea = {
      id: newId(),
      text: cleaned,
      tags,
      pinned: false,
      pinnedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    dispatch({ type: 'idea/add', idea })
    reset()
    onSaved(idea.id)
    showToast('已收进念头', {
      actionLabel: '撤回',
      onAction: () => {
        dispatch({ type: 'idea/delete', id: idea.id })
        setText(cleaned)
        setTags(tags)
        setShowTags(Boolean(tags.length))
        window.setTimeout(() => textareaRef.current?.focus(), 50)
      },
    })
    window.setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  const changeText = (value: string) => {
    setText(value)
    setAiUndo(null)
  }

  return (
    <>
      <section className={cx('composer', focused && 'is-focused')} aria-labelledby="composer-heading">
        <div className="composer-head">
          <div className="composer-title-group">
            <span className="composer-mark" aria-hidden="true">
              记
            </span>
            <h2 className="composer-title" id="composer-heading">
              此刻的念头
            </h2>
          </div>
          <span className="composer-rule" aria-hidden="true" />
          <span className="composer-date">只在此设备</span>
        </div>

        <form onSubmit={submit}>
          <label className="sr-only" htmlFor="idea-composer">
            写下一个念头
          </label>
          <textarea
            ref={textareaRef}
            id="idea-composer"
            className="composer-textarea"
            value={text}
            onChange={(event) => changeText(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            placeholder="此刻在想什么？先写下来，不求完整。"
            rows={2}
            enterKeyHint="enter"
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
              <button
                type="button"
                onClick={() => {
                  setText(aiUndo)
                  setAiUndo(null)
                }}
              >
                撤回
              </button>
            </div>
          ) : null}

          {showTags ? (
            <div className="composer-tags">
              <TagEditor
                value={tags}
                onChange={setTags}
                suggestions={allTags}
                compact
                placeholder="加标签，回车确认"
              />
            </div>
          ) : null}

          <div className="composer-actions">
            <div className="composer-tools">
              <button
                type="button"
                className={cx('tool-button', showTags && 'is-active')}
                onClick={() => setShowTags((value) => !value)}
                aria-expanded={showTags}
              >
                <Icon name="tag" size={16} />
                <span>{tags.length ? `${tags.length} 个标签` : '标签'}</span>
              </button>
              {text.trim() ? (
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
            <div className="composer-submit">
              <span className="keyboard-hint" aria-hidden="true">
                {isMac() ? '⌘ ↵' : 'Ctrl ↵'}
              </span>
              <button type="submit" className="btn btn-primary composer-save" disabled={!text.trim()}>
                <span>收下</span>
                <Icon name="arrowRight" size={16} />
              </button>
            </div>
          </div>
        </form>
      </section>

      <AiPolishSheet
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        sourceText={text}
        contextLabel="润色正在写的这则念头"
        onApply={(next) => {
          setAiUndo(text)
          setText(next)
          setRestored(false)
          window.setTimeout(() => textareaRef.current?.focus(), 80)
        }}
      />
    </>
  )
}
