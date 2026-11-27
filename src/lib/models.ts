export const DEEPSEEK_MODELS = [
  { value: 'deepseek-flash', name: 'Flash', hint: '更快，适合日常润色' },
  { value: 'deepseek-v4-pro', name: 'V4 Pro', hint: '更沉稳，也更慢一些' },
] as const

export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number]['value']
export const DEFAULT_MODEL = DEEPSEEK_MODELS[0].value
