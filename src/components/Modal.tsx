import { useEffect, useRef, useState, type ReactNode } from 'react'
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

interface ModalProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  panelClassName?: string
  closeOnBackdrop?: boolean
}

export function Modal({
  open,
  onClose,
  labelledBy,
  children,
  panelClassName,
  closeOnBackdrop = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeTimer = useRef<number | null>(null)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
      setMounted(true)
      const frame = window.requestAnimationFrame(() => setVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }

    if (!mounted) return
    setVisible(false)
    closeTimer.current = window.setTimeout(() => {
      dialogRef.current?.close()
      setMounted(false)
      closeTimer.current = null
    }, 210)

    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
    }
  }, [open, mounted])

  useEffect(() => {
    if (!mounted) return
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    lockPageScroll()
    const frame = window.requestAnimationFrame(() => setVisible(true))
    return () => {
      window.cancelAnimationFrame(frame)
      if (dialog.open) dialog.close()
      unlockPageScroll()
    }
  }, [mounted])

  if (!mounted) return null

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
  eyebrow?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  titleId: string
  panelClassName?: string
  bodyClassName?: string
  closeOnBackdrop?: boolean
  closeLabel?: string
}

export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  subtitle,
  children,
  footer,
  titleId,
  panelClassName,
  bodyClassName,
  closeOnBackdrop = true,
  closeLabel = '关闭',
}: SheetProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      panelClassName={cx('sheet-panel', panelClassName)}
      closeOnBackdrop={closeOnBackdrop}
    >
      <div className="sheet-grabber" aria-hidden="true" />
      <header className="sheet-head">
        <div className="sheet-heading">
          {eyebrow ? <p className="sheet-eyebrow">{eyebrow}</p> : null}
          <h2 id={titleId} className="sheet-title">
            {title}
          </h2>
          {subtitle ? <p className="sheet-subtitle">{subtitle}</p> : null}
        </div>
        <IconButton label={closeLabel} icon="close" onClick={onClose} />
      </header>
      <div className={cx('sheet-body', bodyClassName)}>{children}</div>
      {footer ? <footer className="sheet-foot">{footer}</footer> : null}
    </Modal>
  )
}
