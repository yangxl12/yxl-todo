import { createPortal } from 'react-dom'
import { Icon } from './Icon'

interface FabProps {
  /** One character that names what gets added, e.g. 记 or 立. */
  glyph: string
  label: string
  onClick: () => void
}

/**
 * The floating seal both streams use to add something new. It lives in a
 * portal so a page's scroll container can never clip it.
 */
export function Fab({ glyph, label, onClick }: FabProps) {
  return createPortal(
    <button type="button" className="fab" onClick={onClick} aria-label={label} title={label}>
      <span className="fab-glyph" aria-hidden="true">
        {glyph}
      </span>
      <span className="fab-plus" aria-hidden="true">
        <Icon name="plus" size={12} />
      </span>
    </button>,
    document.body,
  )
}
