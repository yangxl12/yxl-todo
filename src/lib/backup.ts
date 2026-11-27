import { decodeBackupData, isRecord, type BackupChanges } from './dataFormat'
import { toDateKey } from './date'
import type { AppData } from './types'

export function createBackup(data: AppData) {
  return {
    app: 'shiyan',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { ...data, prefs: { ...data.prefs, apiKey: '' } },
  }
}

export interface ImportedBackup {
  data: AppData
  changes: BackupChanges
}

export function parseBackup(text: string): ImportedBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('这个文件不是有效的 JSON。')
  }
  if (!isRecord(parsed)) throw new Error('备份内容无法识别。')
  const wrapped = 'app' in parsed || 'data' in parsed
  if (wrapped && (parsed.app !== 'shiyan' || parsed.version !== 1)) {
    throw new Error('这份文件的应用标识或备份版本不受支持。')
  }
  const result = decodeBackupData(wrapped ? parsed.data : parsed)
  return { ...result, data: { ...result.data, prefs: { ...result.data.prefs, apiKey: '' } } }
}

export function downloadJson(value: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadBackup(data: AppData, suffix = ''): void {
  downloadJson(createBackup(data), `shiyan-${toDateKey()}${suffix}.json`)
}
