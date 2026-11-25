import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Brand } from './components/Brand'
import { IconButton } from './components/Button'
import { Icon } from './components/Icon'
import { BottomNav, SideRail } from './components/Navigation'
import { ToastProvider } from './components/Toast'
import { useApp } from './lib/store'
import { useHashRoute } from './lib/useHashRoute'
import { useTheme } from './lib/useTheme'
import { formatFullDate } from './lib/date'
import { InstallProvider } from './lib/useInstallPrompt'
import { cx } from './lib/utils'
import { IdeasView } from './features/ideas/IdeasView'
import { GoalsView } from './features/goals/GoalsView'
import { FireView } from './features/fire/FireView'
import { SettingsSheet } from './features/settings/SettingsSheet'

function BootScreen() {
  return (
    <div className="boot-screen" aria-label="拾焰正在打开">
      <div className="boot-seal">焰</div>
      <p className="boot-word">拾焰</p>
      <span className="boot-line" />
    </div>
  )
}

function AppContent() {
  const { data, dispatch, ready, saveFailed, flushSave } = useApp()
  const { tab, navigate } = useHashRoute()
  const { resolvedDark } = useTheme(data.prefs.theme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  if (!ready) return <BootScreen />

  const nextTheme = resolvedDark ? 'light' : 'dark'

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <div className="app-frame">
        <SideRail active={tab} onNavigate={navigate} />
        <div className="app-column">
          <header className="topbar">
            <div className="topbar-left">
              <div className="topbar-mobile-brand">
                <Brand />
              </div>
              <div className="topbar-context">
                <span className="topbar-date">{formatFullDate()}</span>
                <span className="local-chip">
                  <Icon name="lock" size={12} />
                  仅此设备
                </span>
              </div>
            </div>
            <div className="topbar-actions">
              <IconButton
                label={resolvedDark ? '切换到纸色主题' : '切换到墨色主题'}
                icon={resolvedDark ? 'sun' : 'moon'}
                onClick={() =>
                  dispatch({ type: 'prefs/update', patch: { theme: nextTheme } })
                }
              />
              <IconButton
                label="打开设置"
                icon="settings"
                onClick={() => setSettingsOpen(true)}
              />
            </div>
          </header>

          {saveFailed ? (
            <div className="save-warning" role="alert">
              <Icon name="alert" size={16} />
              <span>本地存储没能写入，最近的改动可能还没保存。建议先导出备份。</span>
              <button type="button" onClick={flushSave}>
                重试保存
              </button>
            </div>
          ) : null}

          <main className="main-content" id="main-content">
            <div className={cx('page-container', `page-${tab}`)} key={tab}>
              {tab === 'ideas' ? <IdeasView /> : null}
              {tab === 'goals' ? <GoalsView /> : null}
              {tab === 'fire' ? <FireView /> : null}
            </div>
          </main>
        </div>
      </div>

      <BottomNav active={tab} onNavigate={navigate} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {needRefresh ? (
        <div className="update-banner" role="status">
          <span>新版本的拾焰已经备好。</span>
          <button type="button" onClick={() => void updateServiceWorker(true)}>
            更新
          </button>
        </div>
      ) : null}
    </>
  )
}

export default function App() {
  return (
    <InstallProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </InstallProvider>
  )
}
