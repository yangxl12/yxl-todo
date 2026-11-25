const pad = (value: number) => String(value).padStart(2, '0')
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function toDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function formatFullDate(date = new Date()): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${WEEKDAYS[date.getDay()]}`
}

export function formatTime(ts: number): string {
  const date = new Date(ts)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatNoteTime(ts: number): string {
  const date = new Date(ts)
  const today = new Date()
  const yesterday = addDays(today, -1)
  if (toDateKey(date) === toDateKey(today)) return `今天 ${formatTime(ts)}`
  if (toDateKey(date) === toDateKey(yesterday)) return `昨天 ${formatTime(ts)}`
  if (date.getFullYear() === today.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

// The detail sheet is the one place that has to state the exact moment a
// thought was last put down, so it keeps the full year, month, day and time.
export function formatRecordTime(ts: number): string {
  const date = new Date(ts)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${formatTime(ts)}`
}

export function formatDueDate(key: string | null): string {
  if (!key) return ''
  const date = parseDateKey(key)
  if (!date) return key
  const today = new Date()
  if (key === toDateKey(today)) return '今天'
  if (key === toDateKey(addDays(today, 1))) return '明天'
  if (key === toDateKey(addDays(today, -1))) return '昨天'
  if (date.getFullYear() === today.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export type DueTone = 'overdue' | 'today' | 'tomorrow' | 'later'

export function getDueTone(key: string | null, done = false): DueTone | null {
  if (!key || done) return null
  const date = parseDateKey(key)
  if (!date) return null
  const today = new Date()
  const todayKey = toDateKey(today)
  if (key < todayKey) return 'overdue'
  if (key === todayKey) return 'today'
  if (key === toDateKey(addDays(today, 1))) return 'tomorrow'
  return 'later'
}

export function daysSinceEpoch(date = new Date()): number {
  const start = new Date(1970, 0, 1)
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((current.getTime() - start.getTime()) / 86400000)
}
