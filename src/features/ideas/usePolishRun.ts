import { useCallback, useEffect, useRef, useState } from 'react'
import { DeepSeekError, polishText, type PolishOptions, type TokenUsage } from '../../lib/deepseek'

type RunState = 'idle' | 'running' | 'done' | 'truncated' | 'stopped' | 'error'
interface RunOutput {
  state: RunState
  content: string
  reasoning: string
  usage: TokenUsage | null
  error: DeepSeekError | null
  input: Pick<PolishOptions, 'text' | 'mode' | 'style'> | null
}

interface Session {
  controller: AbortController
  output: RunOutput
  timer?: number
}

const EMPTY: RunOutput = { state: 'idle', content: '', reasoning: '', usage: null, error: null, input: null }

export function usePolishRun(open: boolean) {
  const [output, setOutput] = useState<RunOutput>(EMPTY)
  const session = useRef<Session | null>(null)

  const cancel = useCallback(() => {
    const current = session.current
    session.current = null
    if (current) {
      window.clearTimeout(current.timer)
      current.controller.abort()
    }
    return current?.output
  }, [])

  useEffect(() => {
    if (open) setOutput(EMPTY)
    return () => { cancel() }
  }, [open, cancel])

  const stop = () => {
    const partial = cancel()
    if (partial) setOutput({ ...partial, state: 'stopped' })
  }

  const start = async (options: Omit<PolishOptions, 'onContent' | 'onReasoning' | 'onUsage' | 'signal'>) => {
    if (session.current) return
    const { text, mode, style } = options
    const current: Session = {
      controller: new AbortController(),
      output: { ...EMPTY, state: 'running', input: { text, mode, style } },
    }
    session.current = current
    setOutput(current.output)

    const update = (patch: Partial<RunOutput>) => {
      if (session.current !== current) return
      current.output = { ...current.output, ...patch }
      if (current.timer === undefined) {
        current.timer = window.setTimeout(() => {
          current.timer = undefined
          if (session.current === current) setOutput(current.output)
        }, 50)
      }
    }

    try {
      const result = await polishText({
        ...options,
        signal: current.controller.signal,
        onContent: (content) => update({ content }),
        onReasoning: (reasoning) => update({ reasoning }),
        onUsage: (usage) => update({ usage }),
      })
      if (session.current !== current) return
      setOutput({
        ...current.output,
        state: result.status === 'complete' ? 'done' : result.status,
        content: result.text,
        reasoning: result.reasoning,
        usage: result.usage,
      })
    } catch (error) {
      if (session.current !== current) return
      setOutput({ ...current.output, state: 'error', error: error instanceof DeepSeekError
        ? error : new DeepSeekError('request', '这次没有润色成功，请稍后再试。') })
    } finally {
      if (session.current === current) {
        window.clearTimeout(current.timer)
        session.current = null
      }
    }
  }

  return { output, start, stop, cancel }
}
