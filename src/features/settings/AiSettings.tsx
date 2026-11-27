import { useEffect, useState } from 'react'
import { IconButton } from '../../components/Button'
import { checkDeepSeekKey } from '../../lib/deepseek'
import { DEEPSEEK_MODELS } from '../../lib/models'
import { maskKey } from '../../lib/utils'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { useApp } from '../../lib/store'
import { cx } from '../../lib/utils'

type Notice = { tone: 'ok' | 'error'; text: string } | null

function firstSentence(text: string): string {
  const index = text.indexOf('。')
  return index >= 0 ? text.slice(0, index + 1) : text
}

export function AiSettings({ open }: { open: boolean }) {
  const { data, dispatch, flushSave } = useApp()
  const [keyEditing, setKeyEditing] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [apiNotice, setApiNotice] = useState<Notice>(null)
  const [verifying, setVerifying] = useState(false)
  const hasKey = Boolean(data.prefs.apiKey)
  const editingKey = keyEditing || !hasKey
  useEffect(() => {
    const reset = () => {
      setKeyEditing(false)
      setKeyDraft('')
      setShowKey(false)
      setApiNotice(null)
    }
    window.addEventListener('shiyan:data-changed', reset)
    return () => window.removeEventListener('shiyan:data-changed', reset)
  }, [])
  useEffect(() => {
    if (!open) return
    setKeyEditing(false)
    setKeyDraft('')
    setShowKey(false)
    setApiNotice(null)
  }, [open])

  const saveKey = async () => {
    const cleaned = keyDraft.trim()
    if (!cleaned) {
      setApiNotice({ tone: 'error', text: '先把 API Key 粘贴进来。' })
      return
    }
    dispatch({ type: 'prefs/update', patch: { apiKey: cleaned } })
    if (!(await flushSave())) {
      setApiNotice({ tone: 'error', text: '密钥改动还未写入本地库。' })
      return
    }
    setKeyEditing(false)
    setKeyDraft('')
    setShowKey(false)
    setApiNotice({ tone: 'ok', text: '密钥已保存在这台设备。AI 只在润色时使用它。' })
  }

  const removeKey = async () => {
    dispatch({ type: 'prefs/update', patch: { apiKey: '' } })
    if (!(await flushSave())) {
      setApiNotice({ tone: 'error', text: '密钥改动还未写入本地库。' })
      return
    }
    setKeyEditing(true)
    setKeyDraft('')
    setApiNotice({ tone: 'ok', text: '已从本机移除密钥。' })
  }

  const verify = async () => {
    if (!data.prefs.apiKey) {
      setApiNotice({ tone: 'error', text: '先保存密钥再验证。' })
      return
    }
    setVerifying(true)
    setApiNotice(null)
    try {
      const result = await checkDeepSeekKey(data.prefs.apiKey)
      setApiNotice({
        tone: 'ok',
        text: `连接正常 · ${result.latencyMs} 毫秒 · 可以调用 ${result.models.length || '可用'} 个模型`,
      })
    } catch (error) {
      setApiNotice({
        tone: 'error',
        text: error instanceof Error ? firstSentence(error.message) : '没有连上 DeepSeek。',
      })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <section className="settings-section" aria-labelledby="settings-ai-title">
      <div className="settings-section-head">
        <span className="settings-icon">
          <Icon name="spark" size={17} />
        </span>
        <h3 id="settings-ai-title">AI 润色</h3>
        <span className={hasKey ? 'settings-status is-connected' : 'settings-status'}>
          <span className="status-dot" />
          {hasKey ? '已接入' : '未接入'}
        </span>
      </div>

      <p className="settings-description">
        只有你主动润色的那段文字会发送给 DeepSeek；目标、任务和其他念头都不会离开这台设备。
      </p>

      {editingKey ? (
        <div className="key-form">
          <label className="field-label" htmlFor="api-key">
            DeepSeek API Key
          </label>
          <div className="secret-field">
            <input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && keyDraft.trim()) {
                  event.preventDefault()
                  saveKey()
                }
              }}
              placeholder="sk-... 粘贴 API Key"
              autoComplete="off"
              spellCheck={false}
            />
            <IconButton
              label={showKey ? '隐藏密钥' : '显示密钥'}
              icon={showKey ? 'eyeOff' : 'eye'}
              onClick={() => setShowKey((value) => !value)}
            />
          </div>
          <div className="key-form-actions">
            <a
              className="text-link"
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noreferrer"
            >
              去获取 Key
              <Icon name="external" size={12} />
            </a>
            <div className="footer-button-group">
              {hasKey ? (
                <Button variant="ghost" size="small" onClick={() => setKeyEditing(false)}>
                  取消
                </Button>
              ) : null}
              <Button variant="primary" size="small" onClick={saveKey}>
                保存密钥
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="connected-key">
          <span className="key-mask">
            <Icon name="key" size={14} />
            {maskKey(data.prefs.apiKey)}
          </span>
          <div className="connected-actions">
            <Button
              variant="ghost"
              size="small"
              icon={verifying ? 'refresh' : 'shield'}
              onClick={verify}
              disabled={verifying}
            >
              {verifying ? '验证中…' : '验证连接'}
            </Button>
            <button
              type="button"
              className="text-action"
              onClick={() => {
                setKeyEditing(true)
                setKeyDraft('')
                setShowKey(false)
              }}
            >
              更换
            </button>
            <button
              type="button"
              className="text-action is-danger"
              onClick={removeKey}
            >
              移除
            </button>
          </div>
        </div>
      )}

      {apiNotice ? (
        <p className={cx('settings-notice', `notice-${apiNotice.tone}`)} role="status">
          <Icon name={apiNotice.tone === 'ok' ? 'checkCircle' : 'alert'} size={14} />
          {apiNotice.text}
        </p>
      ) : null}

      <div className="model-choice">
        <span className="field-label">用哪个模型</span>
        <div className="model-grid" role="group" aria-label="DeepSeek 模型">
          {DEEPSEEK_MODELS.map((model) => (
            <button
              key={model.value}
              type="button"
              aria-pressed={data.prefs.model === model.value}
              className={cx('model-option', data.prefs.model === model.value && 'is-selected')}
              onClick={() =>
                dispatch({ type: 'prefs/update', patch: { model: model.value } })
              }
            >
              <span className="model-option-name">{model.name}</span>
              <span className="model-option-hint">{model.hint}</span>
              <span className="model-check" aria-hidden="true">
                {data.prefs.model === model.value ? <Icon name="check" size={13} /> : null}
              </span>
            </button>
          ))}
        </div>
        <p className="feature-badges">
          <span>流式输出</span>
          <span>深思模式</span>
          <span>上下文缓存</span>
          <a href="https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/" target="_blank" rel="noreferrer">
            DeepSeek 文档
            <Icon name="external" size={11} />
          </a>
        </p>
      </div>
    </section>
  )
}
