import { useCallback, useEffect, useState } from 'react'
import type { ThemeMode } from './types'
import { rememberTheme } from './storage'

const DARK_QUERY = '(prefers-color-scheme: dark)'
const META_LIGHT = '#f3eee3'
const META_DARK = '#171612'

function getSystemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches
}

function applyTheme(mode: ThemeMode, systemDark: boolean): boolean {
  const dark = mode === 'dark' || (mode === 'system' && systemDark)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document
    .querySelector('#theme-color-meta')
    ?.setAttribute('content', dark ? META_DARK : META_LIGHT)
  return dark
}

export function useTheme(mode: ThemeMode) {
  const [systemDark, setSystemDark] = useState(getSystemDark)
  const [resolvedDark, setResolvedDark] = useState(() => getSystemDark())

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    rememberTheme(mode)
    setResolvedDark(applyTheme(mode, systemDark))
  }, [mode, systemDark])

  const toggle = useCallback(() => {
    const next: ThemeMode = resolvedDark ? 'light' : 'dark'
    return next
  }, [resolvedDark])

  return { resolvedDark, toggle }
}
