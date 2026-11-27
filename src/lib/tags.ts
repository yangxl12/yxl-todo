export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of value) {
    if (typeof tag !== 'string') continue
    const cleaned = tag.replace(/\s+/g, ' ').trim().slice(0, 24)
    const lower = cleaned.toLocaleLowerCase('zh-CN')
    if (!cleaned || seen.has(lower)) continue
    seen.add(lower)
    result.push(cleaned)
    if (result.length >= 12) break
  }
  return result
}
