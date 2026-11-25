import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, IconButton } from '../../components/Button'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Modal'
import { checkDeepSeekKey } from '../../lib/deepseek'
import { useApp } from '../../lib/store'
import type { DeepSeekModel, ThemeMode } from '../../lib/types'
import {
  clearDraft,
  createEmptyData,
  downloadBackup,
  parseBackup,
  type ImportedBackup,
} from '../../lib/storage'
import { useInstallPrompt } from '../../lib/useInstallPrompt'
import { cx, maskKey } from '../../lib/utils'
import { goalTaskCounts } from '../goals/taskUtils'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
}

type Notice = { tone: 'ok' | 'error'; text: string } | null

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; hint: string; icon: 'settings' | 'sun' | 'moon' }> = [
  { value: 'system', label: '跟随系统', hint: '随设备明暗切换', icon: 'settings' },
  { value: 'light', label: '纸', hint: '暖白，像一张纸', icon: 'sun' },
  { value: 'dark', label: '墨', hint: '深墨，夜里不刺眼', icon: 'moon' },
]

const MODELS: Array<{ value: DeepSeekModel; name: string; hint: string }> = [
  { value: 'deepseek-flash', name: 'Flash', hint: '更快，适合日常润色' },
  { value: 'deepseek-v4-pro', name: 'V4 Pro', hint: '更沉稳，也更慢一些' },
]

function firstSentence(text: string): string {
  const index = text.indexOf('。')
  return index >= 0 ? text.slice(0, index + 1) : text
}

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const { data, dispatch } = useApp()
  const install = useInstallPrompt()
  const [keyEditing, setKeyEditing] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [apiNotice, setApiNotice] = useState<Notice>(null)
  const [verifying, setVerifying] = useState(false)
  const [dataNotice, setDataNotice] = useState<Notice>(null)
  const [pendingImport, setPendingImport] = useState<ImportedBackup | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const hasKey = Boolean(data.prefs.apiKey)
  const editingKey = keyEditing || !hasKey
  const stats = useMemo(() => goalTaskCounts(data.goals), [data.goals])

  useEffect(() => {
    if (!open) return
    setKeyEditing(false)
    setKeyDraft('')
    setShowKey(false)
    setApiNotice(null)
    setDataNotice(null)
    setPendingImport(null)
    setClearOpen(false)
  }, [open])

  const saveKey = () => {
    const cleaned = keyDraft.trim()
    if (!cleaned) {
      setApiNotice({ tone: 'error', text: '先把 API Key 粘贴进来。' })
      return
    }
    dispatch({ type: 'prefs/update', patch: { apiKey: cleaned } })
    setKeyEditing(false)
    setKeyDraft('')
    setShowKey(false)
    setApiNotice({ tone: 'ok', text: '密钥已保存在这台设备。AI 只在润色时使用它。' })
  }

  const removeKey = () => {
    dispatch({ type: 'prefs/update', patch: { apiKey: '' } })
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

  const exportData = () => {
    downloadBackup(data)
    setDataNotice({ tone: 'ok', text: '备份已导出。API Key 不会写进备份文件。' })
  }

  const chooseFile = () => {
    setDataNotice(null)
    fileRef.current?.click()
  }

  const readImport = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setDataNotice({ tone: 'error', text: '这个备份超过 10 MB，拾焰暂时读不了。' })
      return
    }
    try {
      const text = await file.text()
      const imported = parseBackup(text, data.prefs.apiKey)
      setPendingImport(imported)
    } catch (error) {
      setPendingImport(null)
      setDataNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : '这份备份无法读取。',
      })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const applyImport = () => {
    if (!pendingImport) return
    dispatch({ type: 'data/replace', data: pendingImport.data })
    clearDraft()
    window.dispatchEvent(new CustomEvent('shiyan:data-changed'))
    setDataNotice({
      tone: 'ok',
      text: `已导入 ${pendingImport.data.ideas.length} 则念头、${pendingImport.data.goals.length} 个目标。${
        pendingImport.droppedCount ? `有 ${pendingImport.droppedCount} 条无效内容被略过。` : ''
      }`,
    })
    setPendingImport(null)
  }

  const clearEverything = () => {
    dispatch({ type: 'data/reset', data: createEmptyData() })
    clearDraft()
    setKeyEditing(true)
    setKeyDraft('')
    setApiNotice(null)
    setPendingImport(null)
    setDataNotice({ tone: 'ok', text: '所有本地数据与密钥已清除。' })
    window.dispatchEvent(new CustomEvent('shiyan:data-changed'))
  }

  const handleInstall = async () => {
    const accepted = await install.install()
    if (accepted) setDataNotice({ tone: 'ok', text: '已开始安装拾焰。' })
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="设置"
        subtitle="数据留在本机，选择也由你决定。"
        titleId="settings-title"
        panelClassName="settings-sheet"
        bodyClassName="settings-body"
      >
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
              {MODELS.map((model) => (
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

        <section className="settings-section" aria-labelledby="settings-theme-title">
          <div className="settings-section-head">
            <span className="settings-icon">
              <Icon name={data.prefs.theme === 'dark' ? 'moon' : 'sun'} size={17} />
            </span>
            <h3 id="settings-theme-title">纸与墨</h3>
          </div>
          <div className="theme-options" role="group" aria-label="主题">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={data.prefs.theme === option.value}
                className={cx('theme-option', data.prefs.theme === option.value && 'is-selected')}
                onClick={() =>
                  dispatch({ type: 'prefs/update', patch: { theme: option.value } })
                }
              >
                <Icon name={option.icon} size={17} />
                <span className="theme-option-label">{option.label}</span>
                <span className="theme-option-hint">{option.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-data-title">
          <div className="settings-section-head">
            <span className="settings-icon">
              <Icon name="lock" size={17} />
            </span>
            <h3 id="settings-data-title">本地数据</h3>
          </div>
          <p className="settings-description">
            {data.ideas.length} 则念头、{data.goals.length} 个目标和 {stats.total} 个步骤都在本机。
            没有账号，也没有云端副本。换设备或清理浏览器前，记得导出一份备份。
          </p>

          <div className="data-actions">
            <Button variant="secondary" icon="download" onClick={exportData}>
              导出备份
            </Button>
            <Button variant="secondary" icon="upload" onClick={chooseFile}>
              导入备份
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void readImport(file)
              }}
            />
          </div>

          {pendingImport ? (
            <div className="import-review">
              <div className="import-review-head">
                <Icon name="upload" size={16} />
                <p>找到一份备份，准备替换当前数据。</p>
              </div>
              <p className="import-counts">
                {pendingImport.data.ideas.length} 则念头 · {pendingImport.data.goals.length} 个目标 ·{' '}
                {goalTaskCounts(pendingImport.data.goals).total} 个步骤
              </p>
              <p className="import-warning">
                导入会覆盖当前的念头与目标；本机 API Key 会保留。建议先导出当前备份。
              </p>
              <div className="import-actions">
                <Button variant="ghost" size="small" onClick={() => setPendingImport(null)}>
                  先不导入
                </Button>
                <Button variant="primary" size="small" onClick={applyImport}>
                  替换为这份备份
                </Button>
              </div>
            </div>
          ) : null}

          {dataNotice ? (
            <p className={cx('settings-notice', `notice-${dataNotice.tone}`)} role="status">
              <Icon name={dataNotice.tone === 'ok' ? 'checkCircle' : 'alert'} size={14} />
              {dataNotice.text}
            </p>
          ) : null}

          <button
            type="button"
            className="danger-link"
            onClick={() => setClearOpen(true)}
          >
            清除所有本地数据
          </button>
        </section>

        {(install.canInstall || install.installed || install.iosHint) && (
          <section className="settings-section" aria-labelledby="settings-install-title">
            <div className="settings-section-head">
              <span className="settings-icon">
                <Icon name="install" size={17} />
              </span>
              <h3 id="settings-install-title">放在手边</h3>
              {install.installed ? (
                <span className="settings-status is-connected">
                  <Icon name="check" size={12} /> 已安装
                </span>
              ) : null}
            </div>
            {install.installed ? (
              <p className="settings-description">拾焰已作为独立应用运行，断网也能打开。</p>
            ) : install.canInstall ? (
              <div className="install-row">
                <p>安装到主屏幕，打开更快，也不用每次找网址。</p>
                <Button variant="secondary" size="small" icon="install" onClick={handleInstall}>
                  安装
                </Button>
              </div>
            ) : (
              <p className="settings-description">
                在 Safari 中点「分享」→「添加到主屏幕」，拾焰就会像应用一样待在手边。
              </p>
            )}
          </section>
        )}

        <footer className="settings-about">
          <div className="about-brand">
            <span className="about-seal" aria-hidden="true">
              焰
            </span>
            <div>
              <p>拾焰 · 念行手记</p>
              <span>v1.0 · 本地优先</span>
            </div>
          </div>
          <p>
            无账号、无广告、无追踪。页面本身可在离线时打开；AI 润色需要网络和你的 DeepSeek
            Key。
          </p>
          <span className="about-made">为个人使用而做。</span>
        </footer>
      </Sheet>

      <ConfirmSheet
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearEverything}
        title="要清空全部数据吗？"
        confirmLabel="清空全部数据"
        description={
          <div className="delete-preview">
            <p>所有念头、目标和任务都会从这台设备移除。</p>
            <small>
              本机的 DeepSeek API Key 也会一并清除。这个操作无法撤回，建议先导出备份。
            </small>
          </div>
        }
      />
    </>
  )
}
