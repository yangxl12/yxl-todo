import type { DomainKey, GoalSort, IdeaSort, Priority } from './types'

export interface DomainMeta {
  key: DomainKey
  label: string
  short: string
}

export const DOMAINS: DomainMeta[] = [
  { key: 'work', label: '工作', short: '工' },
  { key: 'study', label: '学习', short: '学' },
  { key: 'health', label: '健康', short: '健' },
  { key: 'life', label: '生活', short: '生' },
  { key: 'create', label: '创作', short: '创' },
]

export const DOMAIN_MAP = Object.fromEntries(DOMAINS.map((item) => [item.key, item])) as Record<
  DomainKey,
  DomainMeta
>

export const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 'high', label: '要紧' },
  { value: 'normal', label: '寻常' },
  { value: 'low', label: '从容' },
]

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: '要紧',
  normal: '寻常',
  low: '从容',
}

export const IDEA_SORTS: Array<{ value: IdeaSort; label: string; hint: string }> = [
  { value: 'recent', label: '最近有动', hint: '刚写过或改过的在前' },
  { value: 'oldest', label: '最早落笔', hint: '按第一次记下的时间排' },
]

export const GOAL_SORTS: Array<{ value: GoalSort; label: string; hint: string }> = [
  { value: 'newest', label: '新建在前', hint: '最近立下的目标先看见' },
  { value: 'due', label: '截止优先', hint: '日期近的、没写完的在前' },
  { value: 'progress', label: '进展优先', hint: '离完成更近的在前' },
]
