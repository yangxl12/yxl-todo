import { useState } from 'react'
import { downloadBackup, downloadJson } from '../lib/backup'
import { useApp } from '../lib/store'
import { Button } from './Button'
import { Icon } from './Icon'

export function StorageRecovery() {
  const { problem, retryLoad, resolveCopies } = useApp()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!problem) return null

  const choose = async (source: 'primary' | 'fallback') => {
    setBusy(true)
    setFailed(!(await resolveCopies(source)))
    setBusy(false)
  }

  return (
    <main className="main-content">
      <section className="page-container settings-section">
        <h1>恢复本地数据</h1>
        {problem.status === 'diverged' ? (
          <>
            <p>找到两份本地数据，暂时无法判断哪份更新。请先导出两份备份，再选择要打开的一份。</p>
            {(['primary', 'fallback'] as const).map((source) => {
              const data = problem[source].data
              const name = source === 'primary' ? '主库' : '备用副本'
              return (
                <div key={source}>
                  <p>{name} · {data.ideas.length} 则念头 · {data.goals.length} 个目标 · {data.trash.length} 条最近删除</p>
                  <div className="data-actions">
                    <Button variant="secondary" onClick={() => downloadBackup(data, `-${source}`)}>导出{name}</Button>
                    <Button variant="ghost" onClick={() => void choose(source)} disabled={busy}>使用{name}</Button>
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <>
            <p>本地数据暂时无法读取。重试后，读取成功就会打开拾焰。</p>
            {problem.copies.map((copy) => (
              <Button key={copy.revision} variant="secondary" onClick={() => downloadBackup(copy.data, '-recovery')}>导出可读副本</Button>
            ))}
          </>
        )}
        <Button variant="primary" onClick={() => void retryLoad()} disabled={busy}>重试读取</Button>
        {failed ? <p role="alert">恢复未完成，请重试读取。</p> : null}
      </section>
    </main>
  )
}

export function StorageNotice() {
  const { data, saveStatus, savedInFallback, recovery, flushSave, keepLatest, saveToPrimary, restoreJournal, restoreIdeaCopies } = useApp()
  const [fallbackFailed, setFallbackFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const act = async (run: () => Promise<boolean>, failure: string) => {
    setBusy(true)
    setError(await run() ? null : failure)
    setBusy(false)
  }

  const recoverPrimary = async () => {
    setBusy(true)
    setFallbackFailed(!(await saveToPrimary()))
    setBusy(false)
  }

  return (
    <>
      {saveStatus === 'conflict' ? (
        <div className="save-warning" role="alert">
          <Icon name="alert" size={16} />
          <span>另一个页面已保存新版数据。可以读取最新版，再从保留的编辑中恢复念头。</span>
          <button type="button" onClick={() => downloadBackup(data, '-edits')}>导出当前副本</button>
          <button type="button" disabled={busy} onClick={() => void act(keepLatest, '未能保留当前编辑，请先导出当前副本。')}>读取最新版</button>
        </div>
      ) : saveStatus === 'failed' ? (
        <div className="save-warning" role="alert">
          <Icon name="alert" size={16} />
          <span>最近的改动还没写入本地库。</span>
          <button type="button" onClick={() => void flushSave()}>重试保存</button>
          <button type="button" onClick={() => downloadBackup(data, '-edits')}>导出当前副本</button>
        </div>
      ) : savedInFallback ? (
        <div className="save-warning" role="status">
          <span>{fallbackFailed ? '主库暂时仍无法写入，数据已留在备用副本。' : '数据已保存在备用副本。'}</span>
          <button type="button" disabled={busy} onClick={() => void recoverPrimary()}>保存到主库</button>
        </div>
      ) : null}

      {error ? <div className="save-warning" role="alert">{error}</div> : null}

      {recovery.map((entry, index) => (
        <div className="save-warning" role="status" key={entry.key}>
          <span>找到 {entry.journal.changes.length} 项待恢复的编辑{entry.restorable ? '。' : '，本地库已有更新。'}</span>
          {entry.restorable ? (
            <button type="button" disabled={busy} onClick={() => void act(() => restoreJournal(entry), '恢复未完成，请重试保存。')}>恢复编辑</button>
          ) : entry.journal.changes.some(({ action }) =>
            action.type === 'idea/add' || (action.type === 'idea/update' && action.patch.text)) ? (
            <button type="button" disabled={busy} onClick={() => void act(() => restoreIdeaCopies(entry), '恢复未完成，请重试保存。')}>将念头存为副本</button>
          ) : null}
          <button type="button" onClick={() => {
            const changes = entry.journal.changes.map(({ action, now }) => ({
              now,
              action: action.type === 'prefs/update' ? { ...action, patch: { ...action.patch, apiKey: undefined } } : action,
            }))
            downloadJson({ app: 'shiyan', version: 1, changes }, `shiyan-pending-${index + 1}.json`)
          }}>下载编辑记录</button>
        </div>
      ))}
    </>
  )
}
