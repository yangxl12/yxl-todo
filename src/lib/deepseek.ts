import { POLISH_MODEL } from './models'
import { makePolishPrompt, type PolishMode, type PolishStyle } from './polishPrompts'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const POLISH_TIMEOUT_MS = 150_000
const IDLE_TIMEOUT_MS = 35_000
const THINKING_IDLE_TIMEOUT_MS = 60_000

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cacheHitTokens: number
  reasoningTokens: number
}

interface PolishResult {
  status: 'complete' | 'truncated' | 'stopped'
  text: string
  reasoning: string
  usage: TokenUsage | null
  model: string
  finishReason: string | null
}

export interface PolishOptions {
  apiKey: string
  mode: PolishMode
  style?: PolishStyle
  text: string
  thinking: boolean
  signal?: AbortSignal
  onContent?: (full: string) => void
  onReasoning?: (full: string) => void
  onUsage?: (usage: TokenUsage) => void
}

type DeepSeekErrorKind =
  | 'auth'
  | 'balance'
  | 'rate'
  | 'network'
  | 'server'
  | 'timeout'
  | 'empty'
  | 'request'

export class DeepSeekError extends Error {
  constructor(readonly kind: DeepSeekErrorKind, message: string, readonly status?: number) {
    super(message)
    this.name = 'DeepSeekError'
  }
}

function statusError(status: number): DeepSeekError {
  if (status === 401 || status === 403) {
    return new DeepSeekError('auth', 'DeepSeek 没有接受这把密钥。请检查 API Key。', status)
  }
  if (status === 402) {
    return new DeepSeekError('balance', 'DeepSeek 账户余额不足，充值后再试一次。', status)
  }
  if (status === 429) {
    return new DeepSeekError('rate', '现在请求有点密，稍等片刻再试一次。', status)
  }
  if (status >= 500) {
    return new DeepSeekError('server', 'DeepSeek 暂时无法处理请求，请稍后再试。', status)
  }
  return new DeepSeekError('request', 'DeepSeek 没有接受这次请求，请稍后再试。', status)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function mapUsage(raw: unknown): TokenUsage | null {
  if (!isRecord(raw)) return null
  const number = (value: unknown) => (typeof value === 'number' ? value : 0)
  const details = isRecord(raw.completion_tokens_details) ? raw.completion_tokens_details : {}
  return {
    promptTokens: number(raw.prompt_tokens),
    completionTokens: number(raw.completion_tokens),
    totalTokens: number(raw.total_tokens),
    cacheHitTokens: number(raw.prompt_cache_hit_tokens),
    reasoningTokens: number(details.reasoning_tokens),
  }
}

const TEMPERATURES: Record<PolishMode, number> = { clear: 0.3, concise: 0.4, literary: 0.65 }

function trackRequest(signal: AbortSignal | undefined, idleMs: number, timeout: DeepSeekError) {
  const controller = new AbortController()
  const onAbort = () => controller.abort(signal?.reason)
  const onTimeout = () => controller.abort(timeout)
  const deadline = globalThis.setTimeout(onTimeout, POLISH_TIMEOUT_MS)
  let idle: ReturnType<typeof setTimeout> | undefined
  const progress = () => {
    globalThis.clearTimeout(idle)
    idle = globalThis.setTimeout(onTimeout, idleMs)
  }
  if (signal?.aborted) onAbort()
  else signal?.addEventListener('abort', onAbort, { once: true })
  progress()

  return {
    signal: controller.signal,
    progress,
    cleanup: () => {
      globalThis.clearTimeout(deadline)
      globalThis.clearTimeout(idle)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

export async function polishText(options: PolishOptions): Promise<PolishResult> {
  const { apiKey, mode, style, thinking, text, signal, onContent, onReasoning, onUsage } = options
  const key = apiKey.trim()
  if (!key) throw new DeepSeekError('auth', '还没有填入 DeepSeek API Key。')

  const timeout = new DeepSeekError(
    'timeout',
    thinking ? '等候 DeepSeek 超时。可以关闭深思再试。' : '等候 DeepSeek 超时，请再试一次。',
  )
  const request = trackRequest(signal, thinking ? THINKING_IDLE_TIMEOUT_MS : IDLE_TIMEOUT_MS, timeout)
  const maxTokens = Math.min(65_536, Math.max(1024, Math.ceil(text.length * 1.5)) + (thinking ? 4096 : 0))
  let content = ''
  let reasoning = ''
  let usage: TokenUsage | null = null
  let finishReason: string | null = null
  let serverModel: string = POLISH_MODEL.id
  let malformed = false
  let terminated = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

  const result = (status: PolishResult['status']): PolishResult => ({
    status, text: content.trim(), reasoning: reasoning.trim(), usage, model: serverModel, finishReason,
  })

  function consume(payload: string) {
    if (payload === '[DONE]') {
      terminated = true
      return
    }

    let chunk: unknown
    try {
      chunk = JSON.parse(payload)
    } catch {
      malformed = true
      return
    }
    if (isRecord(chunk) && chunk.error) {
      throw new DeepSeekError('server', 'DeepSeek 在返回文字时遇到了错误。')
    }
    if (!isRecord(chunk) || !Array.isArray(chunk.choices)) {
      malformed = true
      return
    }
    if (typeof chunk.model === 'string') serverModel = chunk.model
    const mapped = mapUsage(chunk.usage)
    if (mapped) {
      usage = mapped
      onUsage?.(mapped)
    }

    if (chunk.choices.length === 0) return
    const choice: unknown = chunk.choices[0]
    if (!isRecord(choice)) {
      malformed = true
      return
    }
    if (typeof choice.finish_reason === 'string') finishReason = choice.finish_reason
    if (!isRecord(choice.delta)) return

    if (typeof choice.delta.reasoning_content === 'string' && choice.delta.reasoning_content) {
      reasoning += choice.delta.reasoning_content
      request.progress()
      onReasoning?.(reasoning)
    }
    if (typeof choice.delta.content === 'string' && choice.delta.content) {
      content += choice.delta.content
      request.progress()
      onContent?.(content)
    }
  }

  try {
    request.signal.throwIfAborted()
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: POLISH_MODEL.id,
        messages: [
          { role: 'system', content: makePolishPrompt(mode, style) },
          { role: 'user', content: text },
        ],
        thinking: { type: thinking ? 'enabled' : 'disabled' },
        ...(thinking ? { reasoning_effort: 'low' } : { temperature: TEMPERATURES[mode] }),
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: maxTokens,
      }),
      signal: request.signal,
    })
    if (!response.ok) {
      void response.body?.cancel().catch(() => {})
      throw statusError(response.status)
    }
    if (!response.body) throw new DeepSeekError('empty', '这次没有收到文字，再试一次。')

    reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let buffer = ''
    const dataLines: string[] = []
    while (!terminated) {
      const { value, done } = await reader.read()
      request.signal.throwIfAborted()
      buffer += decoder.decode(value, { stream: !done })

      // Keep a trailing CR with the unread line until we can tell whether it
      // starts a CRLF pair. Only a blank line dispatches the pending SSE event.
      const splitAt = !done && buffer.endsWith('\r') ? buffer.length - 1 : buffer.length
      const lines = buffer.slice(0, splitAt).split(/\r\n|[\r\n]/)
      buffer = (lines.pop() ?? '') + buffer.slice(splitAt)
      for (const line of lines) {
        if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
        if (line !== '' || dataLines.length === 0) continue
        const payload = dataLines.join('\n').trim()
        dataLines.length = 0
        if (payload) consume(payload)
        if (terminated) break
      }
      if (done) break
    }

    if (finishReason === 'insufficient_system_resource') {
      throw new DeepSeekError('server', 'DeepSeek 暂时无法完成润色，请稍后再试。')
    }
    if (finishReason === 'content_filter' || finishReason === 'safety') {
      throw new DeepSeekError('request', 'DeepSeek 结束了这次润色，原文已保留。')
    }
    if (!content.trim()) throw new DeepSeekError('empty', '这次没有收到正文，请再试一次。')
    return result(terminated && finishReason === 'stop' && !malformed ? 'complete' : 'truncated')
  } catch (error) {
    if (request.signal.reason === timeout) throw timeout
    if (signal?.aborted) return result('stopped')
    if (error instanceof DeepSeekError) throw error
    throw new DeepSeekError('network', reader
      ? '与 DeepSeek 的连接中断，请再试一次。'
      : '没有连上 DeepSeek。请检查网络，或稍后再试。')
  } finally {
    request.cleanup()
    if (reader) {
      void reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  }
}

export async function checkDeepSeekKey(apiKey: string): Promise<number> {
  const key = apiKey.trim()
  if (!key) throw new DeepSeekError('auth', '先填入 API Key。')
  const started = performance.now()
  const signal = AbortSignal.timeout(20_000)
  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal,
    })
    if (!response.ok) {
      void response.body?.cancel().catch(() => {})
      throw statusError(response.status)
    }
    const payload: unknown = await response.json()
    if (!isRecord(payload) || !Array.isArray(payload.data) ||
        !payload.data.some((model: unknown) => isRecord(model) && model.id === POLISH_MODEL.id)) {
      throw new DeepSeekError('server', `DeepSeek 的可用模型列表里没有 ${POLISH_MODEL.name}。`)
    }
    return Math.round(performance.now() - started)
  } catch (error) {
    if (error instanceof DeepSeekError) throw error
    if (signal.aborted) throw new DeepSeekError('timeout', '连接 DeepSeek 超时，请稍后再试。')
    throw new DeepSeekError('network', '没有连上 DeepSeek。请检查网络后再试。')
  }
}
