import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, IconButton } from '../../components/Button'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { ChoiceSheet } from '../../components/ChoiceSheet'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { IDEA_SORTS } from '../../lib/domains'
import { useApp } from '../../lib/store'
import type { Idea, IdeaSort } from '../../lib/types'
import { IdeaCard } from './IdeaCard'
import { IdeaComposer } from './IdeaComposer'
import { IdeaDetailSheet } from './IdeaDetailSheet'

const PAGE_SIZE = 30

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN')
}

// Ideas are immutable snapshots, so a lowered search blob only has to be built
// once per idea no matter how many keystrokes filter over it.
const searchBlobs = new WeakMap<Idea, string>()

function ideaSearchBlob(idea: Idea): string {
  let blob = searchBlobs.get(idea)
  if (blob === undefined) {
    blob = `${idea.text}\n${idea.tags.join('\n')}`.toLocaleLowerCase('zh-CN')
    searchBlobs.set(idea, blob)
  }
  return blob
}

export function IdeasView() {
  const { data, dispatch } = useApp()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sortOpen, setSortOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Idea | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const idea of data.ideas) {
      for (const tag of idea.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
      .map(([tag]) => tag)
  }, [data.ideas])

  const filteredIdeas = useMemo(() => {
    const needle = normalizeSearch(query)
    return data.ideas.filter((idea) => {
      if (activeTag && !idea.tags.includes(activeTag)) return false
      if (!needle) return true
      return ideaSearchBlob(idea).includes(needle)
    })
  }, [activeTag, data.ideas, query])

  const sortedIdeas = useMemo(() => {
    const copy = [...filteredIdeas]
    copy.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (a.pinned && b.pinned) {
        if ((b.pinnedAt ?? 0) !== (a.pinnedAt ?? 0)) {
          return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)
        }
      }
      if (data.prefs.ideaSort === 'oldest') return a.createdAt - b.createdAt
      return b.updatedAt - a.updatedAt
    })
    return copy
  }, [data.prefs.ideaSort, filteredIdeas])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, activeTag, data.prefs.ideaSort])

  useEffect(() => {
    if (activeTag && !allTags.includes(activeTag)) setActiveTag(null)
  }, [activeTag, allTags])

  useEffect(() => {
    if (!lastAddedId) return
    const timer = window.setTimeout(() => setLastAddedId(null), 1200)
    return () => window.clearTimeout(timer)
  }, [lastAddedId])

  const activeIdea = selectedIdea
    ? (data.ideas.find((idea) => idea.id === selectedIdea.id) ?? selectedIdea)
    : null

  const currentSort = IDEA_SORTS.find((item) => item.value === data.prefs.ideaSort) ?? IDEA_SORTS[0]
  const shown = sortedIdeas.slice(0, visibleCount)
  const hasFilters = Boolean(query || activeTag)

  const openIdea = useCallback((idea: Idea) => {
    setSelectedIdea(idea)
    setDetailOpen(true)
  }, [])

  const requestDelete = (idea: Idea) => {
    setDetailOpen(false)
    setPendingDelete(idea)
    setConfirmOpen(true)
  }

  const deleteIdea = () => {
    if (!pendingDelete) return
    const deleted = pendingDelete
    dispatch({ type: 'idea/delete', id: deleted.id })
    setPendingDelete(null)
    showToast('这则念头已离开', {
      actionLabel: '撤回',
      onAction: () => dispatch({ type: 'idea/restore', idea: deleted }),
    })
  }

  const clearFilters = () => {
    setQuery('')
    setActiveTag(null)
    setSearchOpen(false)
  }

  const openComposer = () => setComposerOpen(true)

  const handleSaved = (id: string) => {
    setLastAddedId(id)
    setQuery('')
    setSearchOpen(false)
    setActiveTag(null)
    setVisibleCount(PAGE_SIZE)
    setComposerOpen(false)
  }

  return (
    <div className="ideas-view">
      <h1 className="sr-only">念头</h1>

      <section className="ideas-stream" aria-labelledby="ideas-stream-title">
        <div className="ideas-toolbar">
          <div className="ideas-toolbar-title">
            <h2 id="ideas-stream-title">留下的念头</h2>
          </div>
          <div className="ideas-tools">
            <button
              type="button"
              className="sort-trigger"
              onClick={() => setSortOpen(true)}
              aria-label={`排序方式：${currentSort.label}`}
            >
              <Icon name="sort" size={15} />
              <span>{currentSort.label}</span>
            </button>
            <IconButton
              label={searchOpen ? '收起搜索' : '搜索念头'}
              icon="search"
              onClick={() => {
                setSearchOpen((open) => {
                  if (open) setQuery('')
                  return !open
                })
              }}
              className={searchOpen ? 'is-active' : undefined}
            />
          </div>
        </div>

        {searchOpen ? (
          <div className="search-bar">
            <Icon name="search" size={17} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearchOpen(false)
                  setQuery('')
                }
              }}
              placeholder="搜念头或标签…"
              aria-label="搜索念头或标签"
              autoFocus
            />
            {query ? (
              <IconButton label="清空搜索" icon="close" onClick={() => setQuery('')} />
            ) : null}
          </div>
        ) : null}

        {allTags.length ? (
          <div className="filter-strip" aria-label="按标签筛选">
            <button
              type="button"
              className={activeTag === null ? 'filter-chip is-active' : 'filter-chip'}
              onClick={() => setActiveTag(null)}
              aria-pressed={activeTag === null}
            >
              全部
            </button>
            {allTags.map((tag) => (
              <button
                type="button"
                key={tag}
                className={activeTag === tag ? 'filter-chip is-active' : 'filter-chip'}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                aria-pressed={activeTag === tag}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}

        {!data.ideas.length ? (
          <EmptyState
            mark="白"
            title="纸上还空着"
            body="第一念不必完整。一句疑惑、一个想试的方向，先让它落下来。"
          >
            <Button variant="secondary" icon="feather" onClick={openComposer}>
              写下第一念
            </Button>
          </EmptyState>
        ) : sortedIdeas.length === 0 ? (
          <EmptyState
            mark="找"
            title="这里没有那一念"
            body="换个词，或把标签放下。你已经写下的，都还在。"
            compact
          >
            <Button variant="secondary" onClick={clearFilters}>
              清除筛选
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="idea-grid">
              {shown.map((idea, index) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  index={index}
                  isNew={idea.id === lastAddedId}
                  onOpen={openIdea}
                />
              ))}
            </div>
            {sortedIdeas.length > shown.length ? (
              <div className="load-more">
                <Button
                  variant="ghost"
                  iconAfter="chevronDown"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  再看 {sortedIdeas.length - shown.length} 念
                </Button>
              </div>
            ) : null}
            {hasFilters ? (
              <button type="button" className="filter-clear-under" onClick={clearFilters}>
                清除筛选
              </button>
            ) : null}
          </>
        )}
      </section>

      {createPortal(
        <button
          type="button"
          className="idea-fab"
          onClick={openComposer}
          aria-label="新增念头"
          title="新增念头"
        >
          <span className="idea-fab-glyph" aria-hidden="true">
            记
          </span>
          <span className="idea-fab-plus" aria-hidden="true">
            <Icon name="plus" size={12} />
          </span>
        </button>,
        document.body,
      )}

      <IdeaComposer
        open={composerOpen}
        allTags={allTags}
        onClose={() => setComposerOpen(false)}
        onSaved={handleSaved}
        onReopen={openComposer}
      />

      <IdeaDetailSheet
        idea={activeIdea}
        open={detailOpen}
        allTags={allTags}
        onClose={() => setDetailOpen(false)}
        onRequestDelete={(idea) => {
          setSelectedIdea(idea)
          requestDelete(idea)
        }}
      />

      <ChoiceSheet<IdeaSort>
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title="念头怎么排"
        subtitle="顺序也是整理"
        titleId="idea-sort-title"
        options={IDEA_SORTS}
        value={data.prefs.ideaSort}
        onChange={(value) => dispatch({ type: 'prefs/update', patch: { ideaSort: value } })}
      />

      <ConfirmSheet
        open={confirmOpen && Boolean(pendingDelete)}
        onClose={() => {
          setConfirmOpen(false)
          setPendingDelete(null)
        }}
        onConfirm={deleteIdea}
        title="要把这则念头删掉吗？"
        confirmLabel="删除这则念头"
        description={
          <div className="delete-preview">
            <p>{pendingDelete?.text.slice(0, 150)}</p>
            {(pendingDelete?.text.length ?? 0) > 150 ? <span>…</span> : null}
            <small>删除后 5 秒内还能撤回。再久一点，它就真的离开了。</small>
          </div>
        }
      />
    </div>
  )
}
