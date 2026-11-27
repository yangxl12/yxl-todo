import { makeUserPrompt, SYSTEM_PROMPT, type PolishMode, type PolishStyle } from './polishPrompts'
import type { DeepSeekModel } from './types'
import { cleanAiText } from './utils'

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cacheHitTokens: number
  reasoningTokens: number
}

export interface PolishResult {
  status: 'complete' | 'truncated' | 'stopped'
  text: string
  reasoning: string
  usage: TokenUsage | null
  model: string
  finishReason: string | null
}

export interface PolishCallbacks {
  onContent?: (full: string, delta: string) => void
  onReasoning?: (full: string, delta: string) => void
  onUsage?: (usage: TokenUsage) => void
}

export interface PolishOptions extends PolishCallbacks {
  apiKey: string
  model: DeepSeekModel
  mode: PolishMode
  style?: PolishStyle
  text: string
  thinking: boolean
  signal?: AbortSignal
}

export type DeepSeekErrorKind =
  | 'auth'
  | 'balance'
  | 'rate'
  | 'network'
  | 'server'
  | 'timeout'
  | 'empty'
  | 'request'

export class DeepSeekError extends Error {
  kind: DeepSeekErrorKind
  status?: number

  constructor(kind: DeepSeekErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'DeepSeekError'
    this.kind = kind
    this.status = status
  }
}

function statusError(status: number, detail?: string): DeepSeekError {
  const suffix = detail ? ` ${detail}` : ''
  if (status === 401 || status === 403) {
    return new DeepSeekError('auth', 'DeepSeek 没有接受这把密钥。请到设置里检查 API Key。', status)
  }
  if (status === 402) {
    return new DeepSeekError('balance', 'DeepSeek 账户余额不足，充值后再试一次。', status)
  }
  if (status === 429) {
    return new DeepSeekError('rate', '现在请求有点密，稍等片刻再试一次。', status)
  }
  if (status >= 500) {
    return new DeepSeekError('server', `DeepSeek 暂时没有回应。稍后再试。${suffix}`, status)
  }
  return new DeepSeekError('request', `这次请求没有成功。${suffix}`.trim(), status)
}

async function readErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text()
    if (!text) return undefined
    const parsed: unknown = JSON.parse(text)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error?: { message?: unknown } }).error?.message === 'string'
    ) {
      return (parsed as { error: { message: string } }).error.message.slice(0, 300)
    }
    return text.slice(0, 200)
  } catch {
    return undefined
  }
}

function mapUsage(raw: unknown): TokenUsage | null {
  if (typeof raw !== 'object' || raw === null) return null
  const usage = raw as Record<string, unknown>
  const number = (value: unknown) => (typeof value === 'number' ? value : 0)
  const completionDetails =
    typeof usage.completion_tokens_details === 'object' && usage.completion_tokens_details !== null
      ? (usage.completion_tokens_details as Record<string, unknown>)
      : {}

  return {
    promptTokens: number(usage.prompt_tokens),
    completionTokens: number(usage.completion_tokens),
    totalTokens: number(usage.total_tokens),
    cacheHitTokens: number(usage.prompt_cache_hit_tokens),
    reasoningTokens: number(completionDetails.reasoning_tokens),
  }
}

const TEMPERATURES: Record<PolishMode, number> = {
  clear: 0.7,
  concise: 0.8,
  literary: 1.3,
}

/** 思考模式的模型常常只允许默认温度；带上反而 400，所以只在快速模式里调。 */
function samplingParams(mode: PolishMode, thinking: boolean) {
  return thinking ? {} : { temperature: TEMPERATURES[mode] }
}

function buildCombinedSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  let timedOut = false
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup: () => {
      globalThis.clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

export async function polishText(options: PolishOptions): Promise<PolishResult> {
  const {
    apiKey,
    model,
    mode,
    style = 'cold',
    text,
    thinking,
    signal,
    onContent,
    onReasoning,
    onUsage,
  } = options
  if (!apiKey.trim()) {
    throw new DeepSeekError('auth', '还没有填入 DeepSeek API Key。')
  }

  const combined = buildCombinedSignal(signal, 150_000)
  const maxTokens = Math.min(8192, Math.max(1200, Math.ceil(text.length * 1.25)))
  let response: Response

  try {
    response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: makeUserPrompt(text, mode, style) },
        ],
        thinking: { type: thinking ? 'enabled' : 'disabled' },
        ...(thinking ? { reasoning_effort: 'high' } : {}),
        ...samplingParams(mode, thinking),
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: maxTokens,
      }),
      signal: combined.signal,
    })
  } catch {
    combined.cleanup()
    if (combined.didTimeOut()) {
      throw new DeepSeekError('timeout', '思考得太久了，这次先停下。可以少选“深思”再试。')
    }
    if (signal?.aborted) return {
      status: 'stopped', text: '', reasoning: '', usage: null, model, finishReason: null,
    }
    throw new DeepSeekError(
      'network',
      '没有连上 DeepSeek。请检查网络，或稍后再试。',
    )
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    combined.cleanup()
    throw statusError(response.status, detail)
  }

  if (!response.body) {
    combined.cleanup()
    throw new DeepSeekError('empty', '这次没有收到文字，再试一次。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let reasoning = ''
  let usage: TokenUsage | null = null
  let finishReason: string | null = null
  let serverModel: string = model
  let terminated = false
  let malformed = false

  function consume(event: string) {
    const payload = event.split(/\r\n|\r|\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n').trim()
    if (payload === '[DONE]') {
      terminated = true
      return
    }
    if (!payload) return

    let chunk: unknown
    try {
      chunk = JSON.parse(payload)
    } catch {
      malformed = true
      return
    }
    if (typeof chunk !== 'object' || chunk === null) {
      malformed = true
      return
    }
    const record = chunk as Record<string, unknown>
    if (record.error) throw new DeepSeekError('server', 'DeepSeek 在返回文字时遇到了错误。')
    if (typeof record.model === 'string') serverModel = record.model
    const mapped = mapUsage(record.usage)
    if (mapped) {
      usage = mapped
      onUsage?.(mapped)
    }

    const choices = Array.isArray(record.choices) ? record.choices : []
    const choice = choices[0] as Record<string, unknown> | undefined
    if (!choice) return
    if (typeof choice.finish_reason === 'string') finishReason = choice.finish_reason
    const delta = typeof choice.delta === 'object' && choice.delta !== null
      ? choice.delta as Record<string, unknown> : {}
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
      reasoning += delta.reasoning_content
      onReasoning?.(reasoning, delta.reasoning_content)
    }
    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content
      onContent?.(content, delta.content)
    }
  }

  const result = (status: PolishResult['status']): PolishResult => ({
    status, text: cleanAiText(content), reasoning: reasoning.trim(), usage, model: serverModel, finishReason,
  })

  try {
    while (!terminated) {
      const { value, done } = await reader.read()
      if (signal?.aborted) return result('stopped')
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      const events = buffer.split(/\r\n\r\n|\n\n|\r\r/)
      buffer = events.pop() ?? ''
      for (const event of events) {
        consume(event)
        if (terminated) break
      }
      if (done) {
        if (!terminated && buffer) consume(buffer)
        break
      }
    }
    if (finishReason === 'insufficient_system_resource') {
      throw new DeepSeekError('server', 'DeepSeek 暂时算不过来，请稍后再试。')
    }
    if (!cleanAiText(content)) {
      throw new DeepSeekError('empty', '这次没有收到成形的文字，再试一次。')
    }
    return result(terminated && finishReason === 'stop' && !malformed ? 'complete' : 'truncated')
  } catch (error) {
    if (combined.didTimeOut()) {
      throw new DeepSeekError('timeout', '思考得太久了，这次先停下。可以减少“深思”再试。')
    }
    if (signal?.aborted) return result('stopped')
    if (error instanceof DeepSeekError) throw error
    throw new DeepSeekError('network', '文字流到一半断了。再试一次吧。')
  } finally {
    combined.cleanup()
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}


export interface KeyCheckResult {
  models: string[]
  latencyMs: number
}

export async function checkDeepSeekKey(apiKey: string): Promise<KeyCheckResult> {
  if (!apiKey.trim()) throw new DeepSeekError('auth', '先填入 API Key。')
  const started = performance.now()
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: controller.signal,
    })
    if (!response.ok) {
      const detail = await readErrorDetail(response)
      throw statusError(response.status, detail)
    }
    const payload: unknown = await response.json()
    const models =
      typeof payload === 'object' &&
      payload !== null &&
      Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data: Array<{ id?: unknown }> }).data
            .map((item) => (typeof item?.id === 'string' ? item.id : ''))
            .filter(Boolean) as string[])
        : []
    return { models, latencyMs: Math.round(performance.now() - started) }
  } catch (error) {
    if (error instanceof DeepSeekError) throw error
    if (controller.signal.aborted) {
      throw new DeepSeekError('timeout', '连接 DeepSeek 超时，请稍后再试。')
    }
    throw new DeepSeekError('network', '没有连上 DeepSeek。请检查网络后再试。')
  } finally {
    globalThis.clearTimeout(timer)
  }
}
