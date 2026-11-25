import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'spark'
  | 'plus'
  | 'search'
  | 'close'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'pin'
  | 'trash'
  | 'check'
  | 'chevronDown'
  | 'chevronRight'
  | 'arrowUpRight'
  | 'arrowRight'
  | 'arrowLeft'
  | 'calendar'
  | 'flag'
  | 'copy'
  | 'refresh'
  | 'quote'
  | 'flask'
  | 'bookmark'
  | 'download'
  | 'upload'
  | 'install'
  | 'more'
  | 'feather'
  | 'compass'
  | 'flame'
  | 'lock'
  | 'key'
  | 'eye'
  | 'eyeOff'
  | 'edit'
  | 'sort'
  | 'tag'
  | 'external'
  | 'alert'
  | 'shield'
  | 'bulb'
  | 'clock'
  | 'undo'
  | 'checkCircle'

const paths: Record<IconName, ReactNode> = {
  spark: (
    <>
      <path d="M12 3.2c.5 4.1 2.7 6.3 6.8 6.8-4.1.5-6.3 2.7-6.8 6.8-.5-4.1-2.7-6.3-6.8-6.8 4.1-.5 6.3-2.7 6.8-6.8Z" />
      <path d="M18.6 15.4c.2 1.6 1.1 2.5 2.7 2.7-1.6.2-2.5 1.1-2.7 2.7-.2-1.6-1.1-2.5-2.7-2.7 1.6-.2 2.5-1.1 2.7-2.7Z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m16 16 4.2 4.2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  settings: (
    <>
      <path d="M4 7h8M16 7h4M4 17h3M11 17h9" />
      <circle cx="14" cy="7" r="2.2" />
      <circle cx="9" cy="17" r="2.2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.1" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 15.2A8.6 8.6 0 0 1 8.8 4a8.7 8.7 0 1 0 11.2 11.2Z" />,
  pin: <path d="M9 3h6l-1 6 3.2 3.2-7.4 1.1L5 20l1.5-4.9L9 13l.1-6-3-1.6L9 3Z" />,
  trash: (
    <>
      <path d="M4.5 7h15M9 7V4.8h6V7M7 7l.8 13h8.4L17 7M10 11v5.5M14 11v5.5" />
    </>
  ),
  check: <path d="m4.8 12.5 4.7 4.7L19.4 7" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
  arrowRight: <path d="M4 12h15m-5-5 5 5-5 5" />,
  arrowLeft: <path d="M20 12H5m5-5-5 5 5 5" />,
  calendar: (
    <>
      <rect x="3.5" y="5.2" width="17" height="15.3" rx="1.6" />
      <path d="M7.5 3v4.3M16.5 3v4.3M3.5 9.8h17M8 13.4h2M14 13.4h2M8 17h2M14 17h2" />
    </>
  ),
  flag: <path d="M6 21V4c4.4-2 7.4 2.1 12 0v9.2c-4.6 2.1-7.6-2-12 0" />,
  copy: (
    <>
      <rect x="8.2" y="8.2" width="11.8" height="11.8" rx="1.4" />
      <path d="M15.8 8.2V5.4A1.4 1.4 0 0 0 14.4 4H5.4A1.4 1.4 0 0 0 4 5.4v9a1.4 1.4 0 0 0 1.4 1.4h2.8" />
    </>
  ),
  refresh: <path d="M20 7v5h-5M4 17v-5h5M18.2 11a6.5 6.5 0 0 0-11-3.6L4 10M5.8 13a6.5 6.5 0 0 0 11 3.6L20 14" />,
  quote: (
    <path
      d="M9.2 6C6.3 7.4 4.8 9.7 4.8 12.6c0 3.1 1.6 5.2 4.1 5.2 2 0 3.5-1.4 3.5-3.4 0-1.9-1.3-3.2-3.1-3.2-.3 0-.6 0-.8.1.5-1.4 1.7-2.6 3.2-3.4L9.2 6Zm9 0c-2.9 1.4-4.4 3.7-4.4 6.6 0 3.1 1.6 5.2 4.1 5.2 2 0 3.5-1.4 3.5-3.4 0-1.9-1.3-3.2-3.1-3.2-.3 0-.6 0-.8.1.5-1.4 1.7-2.6 3.2-3.4L18.2 6Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v6.2L5.2 18a2 2 0 0 0 1.7 3h10.2a2 2 0 0 0 1.7-3L14 9.2V3" />
      <path d="M8 14h8" />
    </>
  ),
  bookmark: <path d="M6.5 4.2h11v16.3L12 16.7l-5.5 3.8V4.2Z" />,
  download: <path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17.5V20h16v-2.5" />,
  upload: <path d="M12 16V5m0 0 4 4m-4-4L8 9M4 17.5V20h16v-2.5" />,
  install: (
    <>
      <path d="M12 3v10.5m0 0 3.8-3.8M12 13.5 8.2 9.7" />
      <path d="M5 14.8V19h14v-4.2" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  feather: (
    <>
      <path d="M20 4c-6 .2-11 2.3-13.2 7.2-1.3 2.7-.9 5.4-.9 5.4s2.7.4 5.4-.9C16.2 13.5 19.8 10 20 4Z" />
      <path d="M4 20l6.5-6.5M9 14h5M12 11V7" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z" />
    </>
  ),
  flame: (
    <>
      <path d="M12 21c4 0 6.5-2.4 6.5-6 0-2.8-1.5-5.1-4-7.4-.1 2.2-.8 3.9-2.1 4.8.5-2.8-.2-5.5-2.2-7.4.1 3.6-4.7 5.9-4.7 10 0 3.6 2.6 6 6.5 6Z" />
      <path d="M12 21c1.8 0 3-1.3 3-3.1 0-1.4-.7-2.4-2-3.6-.1 1.5-1 2.4-1 3.6 0 1.8-1 3.1 0 3.1Z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10.5" rx="1.6" />
      <path d="M8.2 10V7.2a3.8 3.8 0 0 1 7.6 0V10M12 14v2.4" />
    </>
  ),
  key: (
    <>
      <circle cx="8.2" cy="15.8" r="3.8" />
      <path d="m11 13.1 8.2-8.2M16.2 6.8l2 2M14.2 8.8l2 2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.8 12S6.2 6.2 12 6.2 21.2 12 21.2 12 17.8 17.8 12 17.8 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4l16 16M10.2 6.5A9.9 9.9 0 0 1 12 6.2c5.8 0 9.2 5.8 9.2 5.8a16 16 0 0 1-3.2 3.8M6.5 8.2C4.2 9.8 2.8 12 2.8 12s3.4 5.8 9.2 5.8c1.2 0 2.3-.2 3.3-.6" />
      <path d="M9.8 10a2.6 2.6 0 0 0 3.8 3.6" />
    </>
  ),
  edit: (
    <>
      <path d="m4 20 4.2-1 11.3-11.3-3.2-3.2L5 15.8 4 20Z" />
      <path d="m13.8 6.8 3.4 3.4" />
    </>
  ),
  sort: <path d="M4 7h10M4 12h7M4 17h4M17 6v12m0 0 3.2-3.2M17 18l-3.2-3.2" />,
  tag: (
    <>
      <path d="M3.8 4.8h7.4l9 9-6.4 6.4-9-9V4.8Z" />
      <circle cx="8" cy="9" r="1.3" />
    </>
  ),
  external: <path d="M13 5h6v6M19 5l-8 8M10 5H5v14h14v-5" />,
  alert: (
    <>
      <path d="M12 3.2 21.3 20H2.7L12 3.2Z" />
      <path d="M12 9v4.8M12 17.2v.1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.8 20 6v6c0 5-3.2 8.1-8 9.2-4.8-1.1-8-4.2-8-9.2V6l8-3.2Z" />
      <path d="m8.5 12.1 2.4 2.4 4.7-4.8" />
    </>
  ),
  bulb: (
    <>
      <path d="M8 15.2c-1.3-1.1-2.1-2.7-2.1-4.4a6.1 6.1 0 0 1 12.2 0c0 1.7-.8 3.3-2.1 4.4-.9.8-1.4 1.7-1.4 2.8h-5.2c0-1.1-.5-2-1.4-2.8Z" />
      <path d="M9.6 21h4.8M10 18h4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 6.8v5.6l3.5 2" />
    </>
  ),
  undo: <path d="M8 6 3.8 10.2 8 14.4M4 10.2h9.2a6.2 6.2 0 0 1 0 12.4H9" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.7" />
      <path d="m8 12.2 2.7 2.7 5.4-5.5" />
    </>
  ),
}

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
  filled?: boolean
}

export function Icon({ name, size = 20, filled = false, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
