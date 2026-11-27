import { Sheet } from '../../components/Modal'
import { AiSettings } from './AiSettings'
import { DataSettings } from './DataSettings'
import { ThemeSettings, InstallSettings } from './AppearanceSettings'

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
}

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="设置"
      subtitle="数据留在本机，选择也由你决定。"
      titleId="settings-title"
      panelClassName="settings-sheet"
      bodyClassName="settings-body"
    >
      <AiSettings open={open} />
      <ThemeSettings />
      <DataSettings open={open} />
      <InstallSettings />
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
  )
}
