import type { ReactNode } from 'react'

interface PageHeaderProps {
  index: string
  english: string
  mark: string
  title: string
  tagline: string
  aside?: ReactNode
}

export function PageHeader({ index, english, mark, title, tagline, aside }: PageHeaderProps) {
  return (
    <header className="page-header">
      <span className="page-watermark" aria-hidden="true">
        {mark}
      </span>
      <div className="page-heading">
        <p className="page-kicker">
          <span className="page-index">{index}</span>
          <span>{english}</span>
        </p>
        <h1 className="page-title">{title}</h1>
        <p className="page-tagline">{tagline}</p>
      </div>
      {aside ? <div className="page-aside">{aside}</div> : null}
    </header>
  )
}
