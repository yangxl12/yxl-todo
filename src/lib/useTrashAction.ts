import { useCallback } from 'react'
import { useToast } from '../components/Toast'
import { useApp } from './store'
import type { TrashTarget } from './types'

export function useTrashAction() {
  const { deleteRecord, restoreRecord } = useApp()
  const { showToast } = useToast()

  return useCallback(async (target: TrashTarget): Promise<string | null> => {
    const result = await deleteRecord(target)
    if (result.status === 'too-large') return '这条记录超过最近删除的容量，已留在原处。'
    if (result.status === 'failed') return '删除还未写入本地库。'
    if (result.status === 'busy') return '正在保存，请稍后再试。'
    if (result.status !== 'deleted') return null

    showToast(result.evicted ? `已放进最近删除，清理了 ${result.evicted} 条旧记录` : '已放进最近删除', {
      actionLabel: '撤回',
      onAction: async () => {
        const status = await restoreRecord(result.entryId)
        if (status === 'parent-missing') showToast('先恢复原目标，再恢复这一步。', { tone: 'error' })
        if (status === 'failed') showToast('恢复还未写入本地库。', { tone: 'error' })
      },
    })
    return null
  }, [deleteRecord, restoreRecord, showToast])
}
