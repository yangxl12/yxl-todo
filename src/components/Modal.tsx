import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/utils'
import { IconButton } from './Button'

let scrollLockCount = 0

function lockPageScroll() {
  if (scrollLockCount === 0) {
    document.documentElement.classList.add('modal-open')
  }
  scrollLockCount += 1
}

function unlockPageScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.documentElement.classList.remove('modal-open')
  }
}

/**
 * Keeps a fixed layer above the software keyboard.
 *
 * The dialog lives in the layout viewport, which on iOS does not shrink when
 * the keyboard opens. Publishing the covered height lets CSS lift the sheet to
 * the top edge of the keyboard, and capping its height keeps the whole sheet
 * inside what is actually visible. Browsers that resize the layout viewport
 * for the keyboard report no covered area, so the inset naturally stays 0.
 */
function useKeyboardInset(active: boolean, dialogRef: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    if (!active) return
    const dialog = dialogRef.current
    if (!dialog) return
    const viewport = window.visualViewport
    let frame = 0

    const measure = () => {
      frame = 0
      const height = viewport?.height ?? window.innerHeight
      const top = viewport?.offsetTop ?? 0
      const inset = Math.max(0, window.innerHeight - height - top)
      dialog.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
      dialog.style.setProperty('--visual-viewport-height', `${Math.round(height)}px`)
      // Above the keyboard the home-indicator inset is no longer at the edge
      // of the sheet, so the footer can drop its extra safe-area padding.
      dialog.classList.toggle('has-keyboard', inset > 4)
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(measure)
    }

    measure()
    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      viewport?.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      dialog.style.removeProperty('--keyboard-inset')
      dialog.style.removeProperty('--visual-viewport-height')
      dialog.classList.remove('has-keyboard')
    }
  }, [active, dialogRef])
}

interface ModalProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  panelClassName?: string
  closeOnBackdrop?: boolean
  /** Element that should receive focus as soon as the dialog is on screen. */
  initialFocusRef?: RefObject<HTMLElement | null>
}

export function Modal({
  open,
  onClose,
  labelledBy,
  children,
  panelClassName,
  closeOnBackdrop = true,
  initialFocusRef,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeTimer = useRef<number | null>(null)
  // `rendered` outlives `open` only for the closing animation.
  const [rendered, setRendered] = useState(open)
  const [visible, setVisible] = useState(false)
  const show = open || rendered

  useEffect(() => {
    if (open) {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
      // Keeps the closing pass from unmounting while we reopen it.
      setRendered(true)
      const frame = window.requestAnimationFrame(() => setVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }

    if (!rendered) return
    setVisible(false)
    closeTimer.current = window.setTimeout(() => {
      dialogRef.current?.close()
      setRendered(false)
      closeTimer.current = null
    }, 210)

    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
    }
  }, [open, rendered])

  // Opening happens in a layout effect so the dialog and its first input are
  // live in the same task as the tap that opened it. iOS only raises the
  // keyboard for focus calls made inside that gesture, not from a later frame.
  useLayoutEffect(() => {
    if (!show) return
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) {
      dialog.showModal()
      lockPageScroll()
    }
    return () => {
      if (dialog.open) dialog.close()
      unlockPageScroll()
    }
  }, [show])

  useKeyboardInset(show, dialogRef)

  // Focus is handed over right after `showModal`, while the sheet is still in
  // the opening gesture. `preventScroll` keeps the page behind it from
  // jumping; an input that already has text continues from its end.
  useLayoutEffect(() => {
    if (!show || !open) return
    const target = initialFocusRef?.current
    if (!target) return
    target.focus({ preventScroll: true })
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      try {
        const end = target.value.length
        target.setSelectionRange(end, end)
      } catch {
        /* Some input types (date, number) do not expose a text selection. */
      }
      if (target instanceof HTMLTextAreaElement) target.scrollTop = target.scrollHeight
    }
  }, [show, open, initialFocusRef])

  if (!show) return null

  return createPortal(
    <dialog
      ref={dialogRef}
      className={cx('modal', visible && open && 'is-open', panelClassName)}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose()
      }}
    >
      {children}
    </dialog>,
    document.body,
  )
}

interface SheetProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  /** Replaces the title block while keeping the close button on the right. */
  headContent?: ReactNode
  children: ReactNode
  footer?: ReactNode
  titleId: string
  panelClassName?: string
  bodyClassName?: string
  closeOnBackdrop?: boolean
  closeLabel?: string
  initialFocusRef?: RefObject<HTMLElement | null>
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  headContent,
  children,
  footer,
  titleId,
  panelClassName,
  bodyClassName,
  closeOnBackdrop = true,
  closeLabel = '关闭',
  initialFocusRef,
}: SheetProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      panelClassName={cx('sheet-panel', panelClassName)}
      closeOnBackdrop={closeOnBackdrop}
      initialFocusRef={initialFocusRef}
    >
      <div className="sheet-grabber" aria-hidden="true" />
      <header className="sheet-head">
        {headContent ? (
          <div className="sheet-heading sheet-heading-custom">
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            {headContent}
          </div>
        ) : (
          <div className="sheet-heading">
            <h2 id={titleId} className="sheet-title">
              {title}
            </h2>
            {subtitle ? <p className="sheet-subtitle">{subtitle}</p> : null}
          </div>
        )}
        <IconButton label={closeLabel} icon="close" onClick={onClose} />
      </header>
      <div className={cx('sheet-body', bodyClassName)}>{children}</div>
      {footer ? <footer className="sheet-foot">{footer}</footer> : null}
    </Modal>
  )
}
