import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { cx } from '../lib/utils'

interface BackToTopProps {
  /** How far down the page has to be before the button is worth showing. */
  threshold?: number
}

export function BackToTop({ threshold = 620 }: BackToTopProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      setVisible(window.scrollY > threshold)
    }
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [threshold])

  const toTop = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  // The view it belongs to animates its own transform, which would become the
  // containing block for a fixed child; the portal keeps it glued to the
  // viewport instead of the end of the list.
  return createPortal(
    <button
      type="button"
      className={cx('back-to-top', visible && 'is-visible')}
      onClick={toTop}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label="回到顶部"
    >
      <Icon name="arrowUp" size={14} />
      <span>回顶</span>
    </button>,
    document.body,
  )
}
