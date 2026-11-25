import { cx } from '../lib/utils'

export function Brand({ large = false }: { large?: boolean }) {
  return (
    <div className={cx('brand', large && 'brand-large')} aria-label="拾焰 · 念行手记">
      <span className="brand-seal" aria-hidden="true">
        焰
      </span>
      <span className="brand-copy">
        <span className="brand-name">拾焰</span>
        <span className="brand-sub">SHIYAN · 念行手记</span>
      </span>
    </div>
  )
}
