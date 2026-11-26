import { createPortal } from 'react-dom'
import { Icon } from './Icon'

interface FabProps {
  /** What gets added, e.g. 新增念头. The plus reads the same on every page. */
  label: string
  onClick: () => void
}

/**
 * The quiet way to add something. A plain outlined plus instead of a red seal:
 * adding is the most frequent action here, so it should be easy to hit and
 * easy to ignore. Lives in a portal so a page's scroll container can't clip it.
 */
export function Fab({ label, onClick }: FabProps) {
  return createPortal(
    <button type="button" className="fab" onClick={onClick} aria-label={label} title={label}>
      <Icon name="plus" size={20} />
    </button>,
    document.body,
  )
}
