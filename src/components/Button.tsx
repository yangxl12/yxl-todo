import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { cx } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink'
type Size = 'regular' | 'small'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  iconAfter?: IconName
  children?: ReactNode
  full?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'regular',
  icon,
  iconAfter,
  children,
  full,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('btn', `btn-${variant}`, size === 'small' && 'btn-small', full && 'btn-full', className)}
      {...props}
    >
      {icon ? <Icon name={icon} size={size === 'small' ? 15 : 17} /> : null}
      {children ? <span>{children}</span> : null}
      {iconAfter ? <Icon name={iconAfter} size={size === 'small' ? 15 : 17} /> : null}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  icon: IconName
  size?: number
  filled?: boolean
  subtle?: boolean
}

export function IconButton({
  label,
  icon,
  size = 19,
  filled,
  subtle,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx('icon-btn', subtle && 'icon-btn-subtle', className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon name={icon} size={size} filled={filled} />
    </button>
  )
}
