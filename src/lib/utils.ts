export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function newId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 3)}••••••••${key.slice(-4)}`
}

export function cleanAiText(text: string): string {
  let result = text.trim()
  result = result.replace(/^```(?:text|markdown|md)?\s*\n?/i, '').replace(/\n?```$/, '')
  // Models still like to announce the result; the正文 should start at the first sentence.
  result = result.replace(
    /^(?:以下是|这是|下面是|给你)?\s*(?:润色|改写|修改|重写)(?:后|过)?的(?:文本|版本|内容|稿子|正文)[:：]?\s*/i,
    '',
  )
  // A pair of quotes wrapping the whole thing is the model talking, not the author.
  const pairs: Array<[string, string]> = [
    ['「', '」'],
    ['“', '”'],
    ['"', '"'],
    ['《', '》'],
  ]
  for (const [open, close] of pairs) {
    if (result.length > open.length + close.length && result.startsWith(open) && result.endsWith(close)) {
      const inner = result.slice(open.length, result.length - close.length)
      if (!inner.includes(close)) {
        result = inner.trim()
        break
      }
    }
  }
  return result.trim()
}

const numberFormatter = new Intl.NumberFormat('zh-CN')

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export function isMac(): boolean {
  return /mac/i.test(window.navigator.userAgent)
}
