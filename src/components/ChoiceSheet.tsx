import { Sheet } from './Modal'
import { Icon } from './Icon'
import { cx } from '../lib/utils'

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  hint?: string
}

interface ChoiceSheetProps<T extends string> {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  options: Array<ChoiceOption<T>>
  value: T
  onChange: (value: T) => void
  titleId: string
}

export function ChoiceSheet<T extends string>({
  open,
  onClose,
  title,
  eyebrow,
  options,
  value,
  onChange,
  titleId,
}: ChoiceSheetProps<T>) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      eyebrow={eyebrow}
      titleId={titleId}
      panelClassName="sheet-small"
    >
      <div className="choice-list" role="group" aria-label={title}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            className={cx('choice-item', option.value === value && 'is-selected')}
            onClick={() => {
              onChange(option.value)
              onClose()
            }}
          >
            <span className="choice-copy">
              <span className="choice-label">{option.label}</span>
              {option.hint ? <span className="choice-hint">{option.hint}</span> : null}
            </span>
            <span className="choice-check" aria-hidden="true">
              {option.value === value ? <Icon name="check" size={15} /> : null}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
