import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Sheet } from './Modal'

interface ConfirmSheetProps {
  open: boolean
  onClose: () => void
  onConfirm: () => boolean | void | Promise<boolean | void>
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
  const [busy, setBusy] = useState(false)
  const confirming = useRef(false)

  const confirm = async () => {
    if (confirming.current) return
    confirming.current = true
    setBusy(true)
    try {
      if (await onConfirm() !== false) onClose()
    } finally {
      confirming.current = false
      setBusy(false)
    }
  }

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
      onClose={() => { if (!confirming.current) onClose() }}
      title={display.title}
      titleId="confirm-sheet-title"
      panelClassName="sheet-small"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {display.cancelLabel}
          </Button>
          <Button
            variant={display.tone === 'danger' ? 'danger' : 'primary'}
            disabled={busy}
            onClick={confirm}
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
