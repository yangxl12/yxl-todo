import { memo, useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import {
  FIRE_ITEMS,
  getDailyFireIndex,
  type FireItem,
  type FireMethod,
  type FireQuote,
} from '../../lib/fireContent'
import { daysSinceEpoch } from '../../lib/date'
import { useApp } from '../../lib/store'
import { cx } from '../../lib/utils'

type FireFilter = 'all' | 'method' | 'quote' | 'saved'

const FILTERS: Array<{ value: FireFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'method', label: '科学方法' },
  { value: 'quote', label: '燃句' },
  { value: 'saved', label: '我的收藏' },
]

function useFavorite(itemId: string) {
  const { data, dispatch } = useApp()
  const favorite = data.favorites.includes(itemId)
  const toggle = () => dispatch({ type: 'favorite/toggle', id: itemId })
  return { favorite, toggle }
}

function FavoriteButton({ itemId, label = '收藏' }: { itemId: string; label?: string }) {
  const { favorite, toggle } = useFavorite(itemId)
  return (
    <button
      type="button"
      className={cx('save-button', favorite && 'is-saved')}
      onClick={toggle}
      aria-pressed={favorite}
      aria-label={favorite ? `取消${label}` : label}
    >
      <Icon name="bookmark" size={16} filled={favorite} />
      <span>{favorite ? '已收好' : label}</span>
    </button>
  )
}

function TypeBadge({ kind }: { kind: FireItem['kind'] }) {
  return (
    <span className={cx('fire-type', `fire-type-${kind}`)}>
      <Icon name={kind === 'method' ? 'flask' : 'quote'} size={12} filled={kind === 'quote'} />
      {kind === 'method' ? '有据可循' : '一句力量'}
    </span>
  )
}

function ScienceDetails({ item }: { item: FireMethod }) {
  return (
    <details className="science-details">
      <summary>
        <span>
          <Icon name="flask" size={13} />
          研究依据
        </span>
        <span className="details-action">
          展开
          <Icon name="chevronDown" size={13} className="chevron" />
        </span>
      </summary>
      <div className="science-details-body">
        <p>{item.evidence}</p>
        <p className="citation">
          {item.citation}
          {item.sourceUrl ? (
            <a href={item.sourceUrl} target="_blank" rel="noreferrer">
              {item.sourceLabel ?? '来源'}
              <Icon name="external" size={11} />
            </a>
          ) : null}
        </p>
      </div>
    </details>
  )
}

function DailyEmber({ item, onSwap }: { item: FireItem; onSwap: () => void }) {
  const isMethod = item.kind === 'method'
  return (
    <section className="daily-ember-wrap" aria-labelledby="daily-ember-title">
      <div className="daily-ember-heading">
        <h2 id="daily-ember-title">今日一焰</h2>
        <div className="daily-ember-actions">
          <FavoriteButton itemId={item.id} label="收下这一焰" />
          <button type="button" className="swap-button" onClick={onSwap}>
            <Icon name="refresh" size={15} />
            换一焰
          </button>
        </div>
      </div>

      <article className={cx('daily-ember', `daily-ember-${item.kind}`)} key={item.id}>
        <span className="daily-halo" aria-hidden="true" />
        <span className="daily-watermark" aria-hidden="true">
          {isMethod ? '法' : '燃'}
        </span>
        <div className="daily-ember-meta">
          <TypeBadge kind={item.kind} />
          <span className="theme-tag">{item.theme}</span>
        </div>

        {item.kind === 'quote' ? (
          <>
            <blockquote className="daily-quote">{item.body}</blockquote>
            <div className="daily-attribution">
              <span className="attribution-line" aria-hidden="true" />
              <span>{item.attribution}</span>
              <span className="attribution-work">{item.source}</span>
              {item.translated ? <span className="translation-mark">中文译文</span> : null}
            </div>
          </>
        ) : (
          <>
            <h3 className="daily-method-title">{item.title}</h3>
            <p className="daily-method-summary">{item.summary}</p>
            <div className="daily-practice">
              <span className="practice-label">
                <Icon name="bulb" size={14} />
                现在就做
              </span>
              <p>{item.practice}</p>
            </div>
            <div className="daily-source">
              <span>这项建议有公开发表的研究作依据。</span>
              {item.sourceUrl ? (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  查看研究
                  <Icon name="external" size={12} />
                </a>
              ) : null}
            </div>
          </>
        )}
      </article>
    </section>
  )
}

const MethodCard = memo(function MethodCard({ item, index }: { item: FireMethod; index: number }) {
  return (
    <article className="fire-card method-card">
      <div className="fire-card-top">
        <span className="fire-card-index">M{String(index + 1).padStart(2, '0')}</span>
        <span className="theme-tag">{item.theme}</span>
        <FavoriteButton itemId={item.id} />
      </div>
      <TypeBadge kind="method" />
      <h3 className="fire-card-title">{item.title}</h3>
      <p className="fire-card-summary">{item.summary}</p>
      <div className="practice-box">
        <span className="practice-label">
          <Icon name="bulb" size={14} />
          现在就做
        </span>
        <p>{item.practice}</p>
      </div>
      <ScienceDetails item={item} />
    </article>
  )
})

const QuoteCard = memo(function QuoteCard({ item, index }: { item: FireQuote; index: number }) {
  return (
    <article className="fire-card quote-card">
      <div className="fire-card-top">
        <span className="fire-card-index">Q{String(index + 1).padStart(2, '0')}</span>
        <span className="theme-tag">{item.theme}</span>
        <FavoriteButton itemId={item.id} />
      </div>
      <Icon name="quote" size={22} className="quote-mark" />
      <blockquote className="fire-quote">{item.body}</blockquote>
      <footer className="fire-quote-footer">
        <span className="quote-attribution">{item.attribution}</span>
        <span className="quote-source">{item.source}</span>
        {item.sourceUrl ? (
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label="查看出处">
            <Icon name="external" size={12} />
          </a>
        ) : null}
        {item.translated ? <span className="translation-mark">中文译文</span> : null}
      </footer>
    </article>
  )
})

export function FireView() {
  const { data } = useApp()
  const dailyIndex = getDailyFireIndex(daysSinceEpoch())
  const [heroIndex, setHeroIndex] = useState(dailyIndex)
  const [filter, setFilter] = useState<FireFilter>('all')

  const methods = useMemo(() => FIRE_ITEMS.filter((item): item is FireMethod => item.kind === 'method'), [])
  const quotes = useMemo(() => FIRE_ITEMS.filter((item): item is FireQuote => item.kind === 'quote'), [])
  const methodIndex = useMemo(
    () => new Map(methods.map((item, index) => [item.id, index])),
    [methods],
  )
  const quoteIndex = useMemo(
    () => new Map(quotes.map((item, index) => [item.id, index])),
    [quotes],
  )
  const favoriteIds = useMemo(() => new Set(data.favorites), [data.favorites])
  const savedMethods = useMemo(
    () => methods.filter((item) => favoriteIds.has(item.id)),
    [favoriteIds, methods],
  )
  const savedQuotes = useMemo(
    () => quotes.filter((item) => favoriteIds.has(item.id)),
    [favoriteIds, quotes],
  )
  const showMethods = filter === 'all' || filter === 'method' || (filter === 'saved' && savedMethods.length > 0)
  const showQuotes = filter === 'all' || filter === 'quote' || (filter === 'saved' && savedQuotes.length > 0)
  const savedTotal = savedMethods.length + savedQuotes.length
  const activeHero = FIRE_ITEMS[heroIndex % FIRE_ITEMS.length] ?? FIRE_ITEMS[dailyIndex]
  const visibleMethodList = filter === 'saved' ? savedMethods : methods
  const visibleQuoteList = filter === 'saved' ? savedQuotes : quotes
  const nothingSaved = filter === 'saved' && savedTotal === 0

  const swap = () => {
    setHeroIndex((current) => (current + 1) % FIRE_ITEMS.length)
  }

  return (
    <div className="fire-view">
      <h1 className="sr-only">火种</h1>

      {filter === 'all' ? <DailyEmber item={activeHero} onSwap={swap} /> : null}

      <div className="fire-tabs" role="group" aria-label="火种分类">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            className={cx('fire-tab', filter === item.value && 'is-active')}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {nothingSaved ? (
        <EmptyState
          mark="留"
          title="还没有收下哪一簇"
          body="看到一句合用的话、一个想试的方法，就点一下『收下』。它们会在这里重逢。"
          compact
        >
          <Button variant="secondary" onClick={() => setFilter('all')}>
            去看看全部
          </Button>
        </EmptyState>
      ) : (
        <>
          {showMethods && visibleMethodList.length ? (
            <section className="fire-section" aria-labelledby="fire-methods-title">
              <div className="fire-section-head">
                <h2 id="fire-methods-title">方法与证据</h2>
                <p className="fire-section-note">能上手，也有出处。</p>
              </div>
              <div className="fire-grid">
                {visibleMethodList.map((item) => (
                  <MethodCard key={item.id} item={item} index={methodIndex.get(item.id) ?? 0} />
                ))}
              </div>
            </section>
          ) : null}

          {showQuotes && visibleQuoteList.length ? (
            <section className="fire-section" aria-labelledby="fire-quotes-title">
              <div className="fire-section-head">
                <h2 id="fire-quotes-title">留下的燃句</h2>
                <p className="fire-section-note">替说不出口的那部分，说一句。</p>
              </div>
              <div className="quote-grid">
                {visibleQuoteList.map((item) => (
                  <QuoteCard key={item.id} item={item} index={quoteIndex.get(item.id) ?? 0} />
                ))}
              </div>
            </section>
          ) : null}

          {filter === 'saved' && savedTotal > 0 ? (
            <button type="button" className="back-to-all" onClick={() => setFilter('all')}>
              <Icon name="arrowLeft" size={14} />
              回到全部火种
            </button>
          ) : null}
        </>
      )}

      <footer className="fire-colophon">
        <Icon name="shield" size={15} />
        <p>
          这里的方法来自公开发表的心理学与行为科学研究，但个体差异真实存在。把它当作可试验的线索，而不是保证。
          文献出处附在卡片内；外文引文为中文译文，已尽量贴近原意。
        </p>
      </footer>
    </div>
  )
}
