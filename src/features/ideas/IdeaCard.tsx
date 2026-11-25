import { memo } from 'react'
import { Icon } from '../../components/Icon'
import type { Idea } from '../../lib/types'
import { formatNoteTime } from '../../lib/date'
import { cx } from '../../lib/utils'

interface IdeaCardProps {
  idea: Idea
  index: number
  isNew: boolean
  onOpen: (idea: Idea) => void
}

export const IdeaCard = memo(function IdeaCard({ idea, index, isNew, onOpen }: IdeaCardProps) {
  const edited = idea.updatedAt - idea.createdAt > 60_000

  return (
    <article
      className={cx('idea-card', idea.pinned && 'is-pinned', isNew && 'is-new')}
      role="button"
      tabIndex={0}
      aria-label={`打开念头：${idea.text.slice(0, 40)}`}
      onClick={() => onOpen(idea)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(idea)
        }
      }}
    >
      <div className="idea-card-top">
        <span className="idea-card-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="idea-card-meta">
          {idea.pinned ? (
            <span className="pin-mark">
              <Icon name="pin" size={12} filled />
              留
            </span>
          ) : null}
          <time dateTime={new Date(idea.createdAt).toISOString()}>
            {formatNoteTime(idea.createdAt)}
          </time>
          {edited ? <span className="edited-mark">改过</span> : null}
        </span>
      </div>

      <p className="idea-card-text">{idea.text}</p>

      <div className="idea-card-foot">
        <div className="idea-card-tags">
          {idea.tags.map((tag) => (
            <span className="tag-chip" key={tag}>
              {tag}
            </span>
          ))}
          {!idea.tags.length ? <span className="idea-card-untagged">未归类</span> : null}
        </div>
        <span className="idea-card-open">
          打开
          <Icon name="arrowUpRight" size={14} />
        </span>
      </div>
    </article>
  )
})
