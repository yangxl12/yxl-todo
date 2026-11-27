import { Icon, type IconName } from './Icon'
import { TABS, type TabKey } from '../lib/useHashRoute'
import { Brand } from './Brand'
import { cx } from '../lib/utils'

const TAB_ICONS: Record<TabKey, IconName> = {
  ideas: 'feather',
  goals: 'compass',
  fire: 'flame',
}

export function BottomNav({
  active,
  onNavigate,
}: {
  active: TabKey
  onNavigate: (tab: TabKey) => void
}) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      <div className="bottom-nav-inner">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={cx('bottom-nav-item', active === tab.key && 'is-active')}
            onClick={() => onNavigate(tab.key)}
            aria-current={active === tab.key ? 'page' : undefined}
          >
            <span className="bottom-nav-icon">
              <Icon name={TAB_ICONS[tab.key]} size={20} filled={active === tab.key && tab.key === 'fire'} />
            </span>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

export function SideRail({
  active,
  onNavigate,
  dailyFragment,
}: {
  dailyFragment: string
  active: TabKey
  onNavigate: (tab: TabKey) => void
}) {
  return (
    <aside className="side-rail">
      <div>
        <Brand large />
        <p className="rail-tagline">把一闪而过的念，燃成做成的事。</p>
      </div>

      <nav className="rail-nav" aria-label="主导航">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={cx('rail-nav-item', active === tab.key && 'is-active')}
            onClick={() => onNavigate(tab.key)}
            aria-current={active === tab.key ? 'page' : undefined}
          >
            <span className="rail-nav-copy">
              <span className="rail-nav-label">{tab.label}</span>
              <span className="rail-nav-en">{tab.english}</span>
            </span>
            <Icon name={TAB_ICONS[tab.key]} size={17} />
          </button>
        ))}
      </nav>

      <div className="rail-ember">
        <p className="rail-ember-label">
          <Icon name="flame" size={13} filled />
          今日一焰
        </p>
        <p className="rail-ember-text">
          {dailyFragment}
        </p>
        <button type="button" className="rail-ember-link" onClick={() => onNavigate('fire')}>
          续一簇火
          <Icon name="arrowUpRight" size={14} />
        </button>
      </div>

      <p className="rail-foot">
        <Icon name="lock" size={13} />
        数据只留在此设备
      </p>
    </aside>
  )
}
