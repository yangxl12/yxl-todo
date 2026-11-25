import type { ReactNode } from 'react'

interface EmptyStateProps {
  mark: string
  title: string
  body: string
  children?: ReactNode
  compact?: boolean
}

export function EmptyState({ mark, title, body, children, compact }: EmptyStateProps) {
  return (
    <div className={compact ? 'empty-state empty-state-compact' : 'empty-state'}>
      <span className="empty-mark" aria-hidden="true">
        {mark}
      </span>
      <div>
        <h2 className="empty-title">{title}</h2>
        <p className="empty-body">{body}</p>
        {children ? <div className="empty-actions">{children}</div> : null}
      </div>
    </div>
  )
}
