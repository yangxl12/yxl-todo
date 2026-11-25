import { useMemo, useState, type KeyboardEvent } from 'react'
import { Icon } from './Icon'
import { normalizeTags } from '../lib/storage'
import { cx } from '../lib/utils'

interface TagEditorProps {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
  compact?: boolean
  placeholder?: string
  id?: string
}

export function TagEditor({
  value,
  onChange,
  suggestions,
  compact,
  placeholder = '加一个标签，回车确认',
  id,
}: TagEditorProps) {
  const [input, setInput] = useState('')
  const available = useMemo(
    () =>
      suggestions
        .filter(
          (suggestion) =>
            !value.some(
              (tag) => tag.toLocaleLowerCase('zh-CN') === suggestion.toLocaleLowerCase('zh-CN'),
            ),
        )
        .slice(0, 6),
    [suggestions, value],
  )

  const add = (raw: string) => {
    const next = normalizeTags([...value, raw])
    onChange(next)
    setInput('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault()
      if (input.trim()) add(input)
    }
    if (event.key === 'Backspace' && !input && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className={cx('tag-editor', compact && 'tag-editor-compact')}>
      {value.length ? (
        <div className="tag-editor-values">
          {value.map((tag) => (
            <span className="tag-chip tag-chip-editable" key={tag}>
              <span>{tag}</span>
              <button
                type="button"
                aria-label={`移除标签 ${tag}`}
                onClick={() => onChange(value.filter((item) => item !== tag))}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <label className="tag-input-row">
        <span className="sr-only">标签</span>
        <Icon name="tag" size={15} className="tag-input-icon" />
        <input
          id={id}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (input.trim()) add(input)
          }}
          placeholder={placeholder}
          maxLength={24}
          enterKeyHint="done"
        />
      </label>
      {available.length ? (
        <div className="tag-suggestions">
          <span className="tag-suggestions-label">用过</span>
          {available.map((tag) => (
            <button
              type="button"
              className="tag-suggestion"
              key={tag}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => add(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
