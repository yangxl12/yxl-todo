import { useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmSheet } from '../../components/ConfirmSheet'
import { downloadBackup, parseBackup, type ImportedBackup } from '../../lib/backup'
import { loadArchivedCopy } from '../../lib/storage'
import { formatBytes, trashBytes } from '../../lib/trash'
import type { AppData } from '../../lib/types'
import { goalTaskCounts } from '../goals/taskUtils'
import { TrashSheet } from './TrashSheet'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { useApp } from '../../lib/store'
import { cx } from '../../lib/utils'

const IMPORT_GROUPS = {
  ideas: '念头', goals: '目标', tasks: '步骤', favorites: '收藏', trash: '最近删除', preferences: '偏好设置',
}

type Notice = { tone: 'ok' | 'error'; text: string } | null

export function DataSettings({ open }: { open: boolean }) {
  const { data, replaceData } = useApp()
  const [dataNotice, setDataNotice] = useState<Notice>(null)
  const [pendingImport, setPendingImport] = useState<ImportedBackup | null>(null)
  const [archived, setArchived] = useState<AppData | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const importRequest = useRef(0)
  const stats = useMemo(() => goalTaskCounts(data.goals), [data.goals])
  const trashed = useMemo(() => trashBytes(data.trash), [data.trash])

  useEffect(() => {
    if (!open) return
    let active = true
    setDataNotice(null)
    setPendingImport(null)
    setClearOpen(false)
    setTrashOpen(false)
    void loadArchivedCopy().then((data) => { if (active) setArchived(data) })
    return () => {
      active = false
      importRequest.current++
    }
  }, [open])

  const exportData = () => {
    downloadBackup(data)
    setDataNotice({ tone: 'ok', text: '备份已导出。API Key 不会写进备份文件。' })
  }

  const chooseFile = () => {
    setDataNotice(null)
    fileRef.current?.click()
  }

  const readImport = async (file: File) => {
    const request = ++importRequest.current
    try {
      const text = await file.text()
      const imported = parseBackup(text)
      if (request === importRequest.current) setPendingImport(imported)
    } catch (error) {
      if (request !== importRequest.current) return
      setPendingImport(null)
      setDataNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : '这份备份无法读取。',
      })
    } finally {
      if (request === importRequest.current && fileRef.current) fileRef.current.value = ''
    }
  }

  const applyImport = async () => {
    if (!pendingImport || replacing) return
    setReplacing(true)
    const saved = await replaceData(pendingImport.data)
    setReplacing(false)
    if (saved) {
      setDataNotice({
        tone: 'ok',
        text: `已导入 ${pendingImport.data.ideas.length} 则念头、${pendingImport.data.goals.length} 个目标。`,
      })
      setPendingImport(null)
    } else {
      setDataNotice({ tone: 'error', text: '导入未完成，当前数据已保留。' })
    }
  }

  const clearEverything = async () => {
    if (replacing) return false
    setReplacing(true)
    const saved = await replaceData(null)
    setReplacing(false)
    if (!saved) {
      setDataNotice({ tone: 'error', text: '清除未完成，当前数据已保留。' })
      return false
    }
    setPendingImport(null)
    setArchived(null)
    setDataNotice({ tone: 'ok', text: '所有本地数据与密钥已清除。' })
    return true
  }

  return (
    <>
      <section className="settings-section" aria-labelledby="settings-data-title">
        <div className="settings-section-head">
          <span className="settings-icon">
            <Icon name="lock" size={17} />
          </span>
          <h3 id="settings-data-title">本地数据</h3>
        </div>
        <p className="settings-description">
          {data.ideas.length} 则念头、{data.goals.length} 个目标和 {stats.total} 个步骤都在本机。
          没有账号，也没有云端副本。换设备或清理浏览器前，记得导出一份备份。
        </p>

        <div className="data-actions">
          <Button variant="secondary" icon="download" onClick={exportData}>
            导出备份
          </Button>
          <Button variant="secondary" icon="upload" onClick={chooseFile} disabled={replacing}>
            导入备份
          </Button>
          {archived ? (
            <Button variant="ghost" icon="download" onClick={() => downloadBackup(archived, '-recovery')}>
              导出另一份旧副本
            </Button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void readImport(file)
            }}
          />
        </div>

        {pendingImport ? (
          <div className="import-review">
            <div className="import-review-head">
              <Icon name="upload" size={16} />
              <p>找到一份备份，准备替换当前数据。</p>
            </div>
            <p className="import-counts">
              {pendingImport.data.ideas.length} 则念头 · {pendingImport.data.goals.length} 个目标 ·{' '}
              {goalTaskCounts(pendingImport.data.goals).total} 个步骤 · {pendingImport.data.favorites.length} 条收藏 ·{' '}
              {pendingImport.data.trash.length} 条最近删除
            </p>
            <p className="import-warning">
              导入会替换当前的念头、目标、收藏、最近删除和偏好设置。本机 API Key 会保留。
            </p>
            {Object.entries(pendingImport.changes).map(([group, counts]) => (
              <p className="import-warning" key={group}>
                {IMPORT_GROUPS[group as keyof typeof IMPORT_GROUPS]}
                  {counts.repaired ? ` · 修复 ${counts.repaired} 处` : ''}
                {counts.dropped ? ` · 跳过 ${counts.dropped} 条` : ''}
              </p>
            ))}
            <div className="import-actions">
                <Button variant="ghost" size="small" disabled={replacing} onClick={() => setPendingImport(null)}>
                先不导入
              </Button>
              <Button variant="primary" size="small" onClick={applyImport} disabled={replacing}>
                替换为这份备份
              </Button>
            </div>
          </div>
        ) : null}

        {dataNotice ? (
          <p className={cx('settings-notice', `notice-${dataNotice.tone}`)} role="status">
            <Icon name={dataNotice.tone === 'ok' ? 'checkCircle' : 'alert'} size={14} />
            {dataNotice.text}
          </p>
        ) : null}

        <button
          type="button"
          className="danger-link"
          onClick={() => setClearOpen(true)}
        >
          清除所有本地数据
        </button>
      </section>

      <section className="settings-section" aria-labelledby="settings-trash-title">
        <div className="settings-section-head">
          <span className="settings-icon">
            <Icon name="trash" size={17} />
          </span>
          <h3 id="settings-trash-title">最近删除</h3>
          <span className="settings-status">
            {data.trash.length ? `${data.trash.length} 条 · ${formatBytes(trashed)}` : '空'}
          </span>
        </div>
        <p className="settings-description">
          删掉的念头、目标和步骤不会立刻消失，先在这里躺一阵。最多留 5 MB，满了就从最旧的开始清。
        </p>
        <div className="data-actions">
          <Button variant="secondary" icon="trash" onClick={() => setTrashOpen(true)}>
            查看最近删除
          </Button>
        </div>
      </section>

      <ConfirmSheet
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearEverything}
        title="要清空全部数据吗？"
        confirmLabel="清空全部数据"
        description={
          <div className="delete-preview">
            <p>所有念头、目标和任务都会从这台设备移除。</p>
            <small>
              本机的 DeepSeek API Key 也会一并清除。这个操作无法撤回，建议先导出备份。
            </small>
            {dataNotice?.tone === 'error' ? <p className="field-error" role="alert">{dataNotice.text}</p> : null}
          </div>
        }
      />

      <TrashSheet open={trashOpen} onClose={() => setTrashOpen(false)} />
    </>
  )
}
