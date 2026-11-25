import { useCallback, useEffect, useState } from 'react'

export type TabKey = 'ideas' | 'goals' | 'fire'

export const TABS: Array<{
  key: TabKey
  label: string
  english: string
  mark: string
  title: string
}> = [
  { key: 'ideas', label: '念头', english: 'THOUGHTS', mark: '念', title: '拾焰 · 念头' },
  { key: 'goals', label: '目标', english: 'MOMENTUM', mark: '行', title: '拾焰 · 目标' },
  { key: 'fire', label: '火种', english: 'KINDLING', mark: '焰', title: '拾焰 · 火种' },
]

function readHash(): TabKey {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  if (hash === 'goals' || hash === 'fire' || hash === 'ideas') return hash
  return 'ideas'
}

export function useHashRoute() {
  const [tab, setTab] = useState<TabKey>(readHash)

  useEffect(() => {
    if (!window.location.hash) {
      const url = new URL(window.location.href)
      url.hash = '#/ideas'
      window.history.replaceState(null, '', url)
    }
    const onChange = () => setTab(readHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  useEffect(() => {
    const definition = TABS.find((item) => item.key === tab)
    document.title = definition?.title ?? '拾焰'
  }, [tab])

  const navigate = useCallback(
    (next: TabKey) => {
      if (next === tab) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      window.location.hash = `/${next}`
    },
    [tab],
  )

  return { tab, navigate }
}
