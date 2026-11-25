export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 3)}••••••••${key.slice(-4)}`
}

export function cleanAiText(text: string): string {
  let result = text.trim()
  result = result.replace(/^```(?:text|markdown)?\s*\n?/i, '').replace(/\n?```$/, '')
  result = result.replace(/^(润色后的(?:文本|版本|内容)|修改后的(?:文本|版本|内容))[:：]\s*/i, '')
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
