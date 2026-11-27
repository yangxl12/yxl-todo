import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { toDateKey } from './date'

const CalendarDay = createContext<Date | null>(null)

export function CalendarDayProvider({ children }: { children: ReactNode }) {
  const [day, setDay] = useState(() => new Date())
  useEffect(() => {
    let timer: number | undefined
    const sync = () => {
      window.clearTimeout(timer)
      const now = new Date()
      const nextMidnight = new Date(now)
      nextMidnight.setHours(24, 0, 0, 0)
      setDay((current) => toDateKey(current) === toDateKey(now) ? current : now)
      timer = window.setTimeout(sync, Math.max(1, nextMidnight.getTime() - now.getTime()))
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync()
    }
    sync()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', sync)
    window.addEventListener('pageshow', sync)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', sync)
      window.removeEventListener('pageshow', sync)
    }
  }, [])
  return <CalendarDay.Provider value={day}>{children}</CalendarDay.Provider>
}

export function useCalendarDay(): Date {
  const day = useContext(CalendarDay)
  if (!day) throw new Error('useCalendarDay must be used inside CalendarDayProvider')
  return day
}
