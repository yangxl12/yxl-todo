import type { ComposerDraft } from './types'
import { isRecord } from './dataFormat'
import { normalizeTags } from './tags'

const DRAFT_KEY = 'shiyan:composer-draft'

export function loadDraft(): ComposerDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value)) return null
    const text = typeof value.text === 'string' ? value.text : ''
    if (!text.trim() && !normalizeTags(value.tags).length) return null
    return {
      text,
      tags: normalizeTags(value.tags),
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export function saveDraft(draft: ComposerDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* A draft is a convenience; committed ideas remain saved. */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* Nothing else to do. */
  }
}
