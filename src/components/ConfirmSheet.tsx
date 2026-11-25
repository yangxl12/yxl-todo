import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { Sheet } from './Modal'

interface ConfirmSheetProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
}

interface ConfirmSnapshot {
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel: string
  tone: 'danger' | 'primary'
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = '先不',
  tone = 'danger',
}: ConfirmSheetProps) {
  const snapshot = useRef<ConfirmSnapshot>({
    title,
    description,
    confirmLabel,
    cancelLabel,
    tone,
  })

  useEffect(() => {
    if (open) snapshot.current = { title, description, confirmLabel, cancelLabel, tone }
  }, [open, title, description, confirmLabel, cancelLabel, tone])

  const display = open ? { title, description, confirmLabel, cancelLabel, tone } : snapshot.current

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={display.title}
      titleId="confirm-sheet-title"
      panelClassName="sheet-small"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {display.cancelLabel}
          </Button>
          <Button
            variant={display.tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {display.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="confirm-copy">{display.description}</div>
    </Sheet>
  )
}
