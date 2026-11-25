import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { cx } from '../lib/utils'

interface ToastOptions {
  actionLabel?: string
  onAction?: () => void
  tone?: 'default' | 'error'
  duration?: number
}

interface ToastState extends ToastOptions {
  id: number
  message: string
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void
  dismissToast: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | null>(null)
  const counter = useRef(0)

  const dismissToast = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    setToast(null)
  }, [])

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      counter.current += 1
      const next = { ...options, id: counter.current, message }
      setToast(next)
      timer.current = window.setTimeout(() => {
        setToast((current) => (current?.id === next.id ? null : current))
        timer.current = null
      }, options?.duration ?? 5200)
    },
    [],
  )

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {toast
        ? createPortal(
            <div
              className={cx('toast', toast.tone === 'error' && 'toast-error')}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              <div className="toast-copy">
                {toast.tone === 'error' ? <Icon name="alert" size={17} /> : null}
                <span>{toast.message}</span>
              </div>
              <div className="toast-actions">
                {toast.actionLabel && toast.onAction ? (
                  <button
                    type="button"
                    className="toast-action"
                    onClick={() => {
                      toast.onAction?.()
                      dismissToast()
                    }}
                  >
                    {toast.actionLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="toast-close"
                  onClick={dismissToast}
                  aria-label="关闭提示"
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
