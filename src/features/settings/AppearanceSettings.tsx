import { useState } from 'react'
import type { ThemeMode } from '../../lib/types'
import { useInstallPrompt } from '../../lib/useInstallPrompt'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { useApp } from '../../lib/store'
import { cx } from '../../lib/utils'

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; hint: string; icon: 'settings' | 'sun' | 'moon' }> = [
  { value: 'system', label: '跟随系统', hint: '随设备明暗切换', icon: 'settings' },
  { value: 'light', label: '纸', hint: '暖白，像一张纸', icon: 'sun' },
  { value: 'dark', label: '墨', hint: '深墨，夜里不刺眼', icon: 'moon' },
]

export function ThemeSettings() {
  const { data, dispatch } = useApp()
  return (
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
  )
}

export function InstallSettings() {
  const install = useInstallPrompt()
  const [accepted, setAccepted] = useState(false)
  if (!install.canInstall && !install.installed && !install.iosHint && !accepted) return null
  return (
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
          <Button variant="secondary" size="small" icon="install" onClick={async () => setAccepted(await install.install())}>
            安装
          </Button>
        </div>
      ) : install.iosHint ? (
        <p className="settings-description">
          在 Safari 中点「分享」→「添加到主屏幕」，拾焰就会像应用一样待在手边。
        </p>
      ) : null}
      {accepted && !install.installed ? <p className="settings-notice notice-ok" role="status">已开始安装拾焰。</p> : null}
    </section>
  )
}
