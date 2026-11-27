import { useEffect, useRef, useState } from 'react'
import type { DeepSeekError, TokenUsage } from '../../lib/deepseek'
import type { PolishMode, PolishStyle } from '../../lib/polishPrompts'
import { DEEPSEEK_MODELS } from '../../lib/models'
import { usePolishRun } from './usePolishRun'
import { useApp } from '../../lib/store'
import { Button, IconButton } from '../../components/Button'
import { Sheet } from '../../components/Modal'
import { Icon } from '../../components/Icon'
import { writeClipboard } from '../../lib/clipboard'
import { cx, formatNumber } from '../../lib/utils'

interface AiPolishSheetProps {
  open: boolean
  onClose: () => void
  onAfterClose: () => void
  sourceText: string
  onApply: (text: string) => void
  contextLabel?: string
}

const MODES: Array<{ value: PolishMode; label: string; hint: string }> = [
  { value: 'clear', label: '理顺', hint: '顺句子，留原声' },
  { value: 'concise', label: '收紧', hint: '削三成，见骨头' },
  { value: 'literary', label: '文气', hint: '短句留白，见筋骨' },
]

const STYLES: Array<{ value: PolishStyle; label: string; hint: string }> = [
  { value: 'cold', label: '冷硬', hint: '古龙' },
  { value: 'plain', label: '极简', hint: '海明威' },
  { value: 'own', label: '本色', hint: '像你自己' },
]

function modeName(mode: PolishMode): string {
  return MODES.find((item) => item.value === mode)?.label ?? '理顺'
}

function styleName(style: PolishStyle): string {
  return STYLES.find((item) => item.value === style)?.label ?? '冷硬'
}

function usageLine(usage: TokenUsage | null): string | null {
  if (!usage) return null
  const parts = [`${formatNumber(usage.totalTokens)} tokens`]
  if (usage.reasoningTokens) parts.push(`思考 ${formatNumber(usage.reasoningTokens)}`)
  if (usage.promptTokens > 0 && usage.cacheHitTokens > 0) {
    parts.push(`缓存 ${Math.round((usage.cacheHitTokens / usage.promptTokens) * 100)}%`)
  }
  return parts.join(' · ')
}

export function AiPolishSheet({
  open,
  onClose,
  onAfterClose,
  sourceText,
  onApply,
  contextLabel = '正在润色这则念头',
}: AiPolishSheetProps) {
  const { data, dispatch } = useApp()
  const [mode, setMode] = useState<PolishMode>('literary')
  const [style, setStyle] = useState<PolishStyle>('cold')
  const [thinking, setThinking] = useState(true)
  const { output, start: run, stop, cancel } = usePolishRun(open)
  const { state: runState, content, reasoning, usage } = output
  const [localError, setError] = useState<string | null>(null)
  const [dismissedError, setDismissedError] = useState<DeepSeekError | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [keyEditing, setKeyEditing] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  const requestError = output.error !== dismissedError ? output.error : null
  const error = localError ?? requestError?.message
  const errorKind = requestError?.kind
  const apiKey = data.prefs.apiKey
  const hasKey = Boolean(apiKey)

  useEffect(() => {
    if (!open) return
    setMode('literary')
    setStyle('cold')
    setThinking(true)
    setKeyDraft('')
    setKeyEditing(false)
    setShowKey(false)
    setShowReasoning(false)
    setCopied(false)
    setShowOriginal(false)
    setError(null)
    setDismissedError(null)
  }, [open])

  useEffect(() => {
    if (runState !== 'running') return
    const node = outputRef.current
    if (!node) return
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 100
    if (nearBottom) node.scrollTop = node.scrollHeight
  }, [content, runState])

  const start = () => {
    const key = (keyEditing || !hasKey ? keyDraft : apiKey).trim()
    if (!key || !sourceText.trim()) return
    if (key !== apiKey) dispatch({ type: 'prefs/update', patch: { apiKey: key } })
    setKeyEditing(false)
    setError(null)
    setDismissedError(null)
    setCopied(false)
    setShowReasoning(false)
    void run({ apiKey: key, model: data.prefs.model, mode, style, text: sourceText, thinking })
  }

  const canReplace = runState === 'done' && output.source === sourceText
  const handleApply = () => {
    if (!canReplace || !content) return
    onApply(content)
    onClose()
  }

  const handleCopy = async () => {
    const success = await writeClipboard(content)
    setCopied(success)
    if (!success) setError('复制没有成功，可以手动选中这段文字。')
    window.setTimeout(() => setCopied(false), 1800)
  }

  const canRun = runState !== 'running'
  const editingKey = !hasKey || keyEditing
  const keyReady = editingKey ? Boolean(keyDraft.trim()) : hasKey
  const noKeyMessage = 'AI 润色会把这段念头发送给 DeepSeek，并把 Key 留在本设备。'

  return (
    <Sheet
      open={open}
      onClose={() => {
        cancel()
        onClose()
      }}
      onAfterClose={onAfterClose}
      title="让文字更靠近你"
      subtitle={contextLabel}
      titleId="ai-polish-title"
      panelClassName="ai-sheet"
      bodyClassName="ai-sheet-body"
      closeOnBackdrop={runState !== 'running'}
      footer={
        canReplace ? (
          <>
            <Button variant="ghost" icon="refresh" onClick={() => start()} disabled={!canRun}>
              再来一版
            </Button>
            <Button variant="primary" icon="check" onClick={handleApply}>
              替换原文
            </Button>
          </>
        ) : runState === 'running' ? (
          <>
            <span className="ai-running-note">
              <span className="typing-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {thinking ? '正在多想几步…' : '正在落笔…'}
            </span>
            <Button variant="secondary" onClick={stop}>
              停下
            </Button>
          </>
        ) : (
          <>
            <span className="ai-footer-hint">{hasKey && !editingKey ? '密钥只在本机' : '尚未连接 DeepSeek'}</span>
            <Button
              variant="primary"
              icon="spark"
              onClick={() => start()}
              disabled={!canRun || !keyReady || !sourceText.trim()}
            >
              {runState === 'error' ? '再试一次' : runState === 'stopped' ? '重新落笔' : '开始润色'}
            </Button>
          </>
        )
      }
    >
      <div className="ai-context">
        <button
          type="button"
          className="ai-context-toggle"
          onClick={() => setShowOriginal((value) => !value)}
          aria-expanded={showOriginal}
        >
          <span>
            <Icon name="feather" size={14} /> 原念
          </span>
          <span className="ai-context-date">{sourceText.trim().length} 字</span>
          <Icon name="chevronDown" size={14} className={cx('chevron', showOriginal && 'is-up')} />
        </button>
        {showOriginal ? <p className="ai-original-text">{sourceText}</p> : null}
      </div>

      {editingKey ? (
        <div className="ai-key-setup">
          <div className="ai-key-copy">
            <p className="ai-key-title">
              <Icon name="key" size={15} />
              {hasKey ? '换一把 DeepSeek 密钥' : '接上你的 DeepSeek'}
            </p>
            <p>{noKeyMessage}</p>
          </div>
          <div className="secret-field">
            <input
              type={showKey ? 'text' : 'password'}
              value={keyDraft}
              onChange={(event) => {
                setKeyDraft(event.target.value)
                if (errorKind === 'auth') setDismissedError(requestError)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && keyDraft.trim()) {
                  event.preventDefault()
                  void start()
                }
              }}
              placeholder="sk-... 粘贴 API Key"
              autoComplete="off"
              spellCheck={false}
              aria-label="DeepSeek API Key"
            />
            <IconButton
              label={showKey ? '隐藏密钥' : '显示密钥'}
              icon={showKey ? 'eyeOff' : 'eye'}
              onClick={() => setShowKey((value) => !value)}
            />
          </div>
          <div className="ai-key-actions">
            <a
              className="text-link"
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noreferrer"
            >
              去 DeepSeek 获取 Key
              <Icon name="external" size={13} />
            </a>
            {hasKey ? (
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  setKeyEditing(false)
                  setKeyDraft('')
                  setDismissedError(requestError)
                }}
              >
                取消更换
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="ai-controls">
        <fieldset className="control-group">
          <legend className="field-label">怎么润</legend>
          <div className="mode-grid" role="group" aria-label="润色方式">
            {MODES.map((item) => (
              <button
                type="button"
                aria-pressed={mode === item.value}
                key={item.value}
                className={cx('mode-card', mode === item.value && 'is-selected')}
                onClick={() => setMode(item.value)}
                disabled={runState === 'running'}
              >
                <span className="mode-name">{item.label}</span>
                <span className="mode-hint">{item.hint}</span>
              </button>
            ))}
          </div>
          {mode === 'literary' ? (
            <div className="style-row" role="group" aria-label="文风">
              {STYLES.map((item) => (
                <button
                  type="button"
                  aria-pressed={style === item.value}
                  key={item.value}
                  className={cx('style-chip', style === item.value && 'is-selected')}
                  onClick={() => setStyle(item.value)}
                  disabled={runState === 'running'}
                >
                  <span className="style-name">{item.label}</span>
                  <span className="style-master">{item.hint}</span>
                </button>
              ))}
            </div>
          ) : null}
        </fieldset>

        <label className={cx('think-toggle', thinking && 'is-on')}>
          <span className="think-toggle-copy">
            <span className="think-toggle-title">
              <Icon name="spark" size={15} />
              深思
            </span>
            <span className="think-toggle-hint">先想清楚再落笔，慢一些</span>
          </span>
          <input
            type="checkbox"
            checked={thinking}
            onChange={(event) => setThinking(event.target.checked)}
            disabled={runState === 'running'}
          />
          <span className="switch" aria-hidden="true">
            <span />
          </span>
        </label>
        <p className="model-hint">
          DeepSeek {DEEPSEEK_MODELS.find((model) => model.value === data.prefs.model)?.name}
          {thinking ? ' · 思考模式' : ' · 快速模式'} · 可在设置中切换
          {hasKey && !editingKey ? (
            <button
              type="button"
              className="ai-key-change"
              onClick={() => {
                setKeyEditing(true)
                setKeyDraft('')
                setShowKey(false)
              }}
            >
              更换密钥
            </button>
          ) : null}
        </p>
      </div>

      {runState === 'running' || content || runState === 'done' || runState === 'stopped' ? (
        <div className="ai-result-block">
          <div className="ai-result-head">
            <span className="field-label">
              落笔 · {modeName(mode)}
              {mode === 'literary' ? ` · ${styleName(style)}` : ''}
            </span>
            {runState === 'done' ? (
              <span className="ai-done-mark">
                <Icon name="checkCircle" size={14} /> 完成
              </span>
            ) : runState === 'stopped' ? (
              <span className="ai-done-mark is-muted">已停下</span>
            ) : null}
          </div>

          {reasoning ? (
            <div className={cx('reasoning-box', showReasoning && 'is-open')}>
              <button
                type="button"
                className="reasoning-toggle"
                onClick={() => setShowReasoning((value) => !value)}
                aria-expanded={showReasoning}
              >
                <span>
                  <Icon name="bulb" size={14} />
                  {runState === 'running' ? '正在思考' : '思考过程'}
                  <span className="reasoning-count">{reasoning.length} 字</span>
                </span>
                <Icon name="chevronDown" size={14} className={cx('chevron', showReasoning && 'is-up')} />
              </button>
              {showReasoning ? <div className="reasoning-text">{reasoning}</div> : null}
            </div>
          ) : null}

          <div className="ai-output" ref={outputRef} aria-live="polite">
            {content ? (
              <p className="ai-output-text">{content}</p>
            ) : (
              <div className="ai-writing-state" aria-hidden="true">
                <span className="ink-line" />
                <span className="ink-line ink-line-short" />
                <span className="ink-line ink-line-mid" />
              </div>
            )}
            {runState === 'running' && content ? <span className="typing-caret" aria-hidden="true" /> : null}
          </div>

          {runState === 'truncated' ? (
            <p className="inline-note">
              只收到部分文字。可以复制片段，或重新润色。
            </p>
          ) : null}

          {runState !== 'running' && content ? (
            <div className="ai-result-meta">
              <span>{usageLine(usage) ?? (runState === 'done' ? 'DeepSeek 已完成这次润色' : '润色片段')}</span>
              {content ? (
                <button type="button" className="text-action" onClick={handleCopy}>
                  <Icon name="copy" size={14} />
                  {copied ? '已复制' : '复制'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="ai-error" role="alert">
          <Icon name="alert" size={17} />
          <div>
            <p>{error}</p>
            {errorKind === 'auth' ? (
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  setKeyEditing(true)
                  setKeyDraft('')
                  setDismissedError(requestError)
                }}
              >
                更换密钥
              </button>
            ) : errorKind === 'balance' ? (
              <a
                className="text-action"
                href="https://platform.deepseek.com/top_up"
                target="_blank"
                rel="noreferrer"
              >
                查看 DeepSeek 余额
                <Icon name="external" size={12} />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {!sourceText.trim() ? (
        <p className="inline-note">先写下一点内容，再让 AI 帮你润色。</p>
      ) : null}
    </Sheet>
  )
}
