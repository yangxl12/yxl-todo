import { useCallback, useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Brand } from './components/Brand'
import { IconButton } from './components/Button'
import { Icon } from './components/Icon'
import { BottomNav, SideRail } from './components/Navigation'
import { StorageNotice, StorageRecovery } from './components/StorageStatus'
import { ToastProvider, useToast } from './components/Toast'
import { useApp } from './lib/store'
import { useHashRoute } from './lib/useHashRoute'
import { useTheme } from './lib/useTheme'
import { CalendarDayProvider, useCalendarDay } from './lib/calendarDay'
import { daysSinceEpoch, formatFullDate } from './lib/date'
import { InstallProvider } from './lib/useInstallPrompt'
import { TopbarSlotProvider } from './lib/topbar'
import { cx } from './lib/utils'
import { IdeasView } from './features/ideas/IdeasView'
import { GoalsView } from './features/goals/GoalsView'
import { FIRE_ITEMS, getDailyFireIndex } from './features/fire/fireContent'
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
  const { data, dispatch, ready, problem, flushSave } = useApp()
  const today = useCalendarDay()
  const { tab, navigate } = useHashRoute()
  const { resolvedDark } = useTheme(data.prefs.theme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Page controls are rendered by each view but live in the header row, so a
  // stable callback ref hands them the slot instead of making them duplicate
  // the header markup.
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)
  const bindActions = useCallback((node: HTMLDivElement | null) => {
    setActionsHost(node)
  }, [])
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  const [dataEpoch, setDataEpoch] = useState(0)
  const { dismissToast } = useToast()
  useEffect(() => {
    const reset = () => {
      dismissToast()
      setDataEpoch((epoch) => epoch + 1)
    }
    window.addEventListener('shiyan:data-changed', reset)
    return () => window.removeEventListener('shiyan:data-changed', reset)
  }, [dismissToast])

  if (!ready) return problem ? <StorageRecovery /> : <BootScreen />

  const daily = FIRE_ITEMS[getDailyFireIndex(daysSinceEpoch(today))]
  const nextTheme = resolvedDark ? 'light' : 'dark'

  return (
    <TopbarSlotProvider host={actionsHost}>
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault()
        document.getElementById('main-content')?.focus()
      }}>
        跳到主要内容
      </a>

      <div className="app-frame">
        <SideRail active={tab} onNavigate={navigate} dailyFragment={daily.kind === 'quote' ? daily.body : daily.title} />
        <div className="app-column">
          <header className="topbar">
            <div className="topbar-left">
              <div className="topbar-mobile-brand">
                <Brand />
              </div>
              <div className="topbar-context">
                <span className="topbar-date">{formatFullDate(today)}</span>
                <span className="local-chip">
                  <Icon name="lock" size={12} />
                  仅此设备
                </span>
              </div>
            </div>
            <div className="topbar-actions">
              <div className="topbar-page-actions" ref={bindActions} />
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

          <StorageNotice />

          <main className="main-content" id="main-content" tabIndex={-1}>
            <div className={cx('page-container', `page-${tab}`)} key={`${tab}-${dataEpoch}`}>
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
          <button type="button" onClick={async () => { if (await flushSave()) await updateServiceWorker(true) }}>
            更新
          </button>
        </div>
      ) : null}
    </TopbarSlotProvider>
  )
}

export default function App() {
  return (
    <InstallProvider>
      <ToastProvider>
        <CalendarDayProvider>
          <AppContent />
        </CalendarDayProvider>
      </ToastProvider>
    </InstallProvider>
  )
}
