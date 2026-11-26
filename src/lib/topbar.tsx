import { createContext, useContext, type ReactNode } from 'react'

/**
 * The app header owns the one row that is always on screen, so page-level
 * controls (sort, search) are rendered into it instead of taking a row of
 * their own above the content. Views portal their controls into `host`.
 */
const TopbarSlotContext = createContext<HTMLElement | null>(null)

export function TopbarSlotProvider({
  host,
  children,
}: {
  host: HTMLElement | null
  children: ReactNode
}) {
  return <TopbarSlotContext.Provider value={host}>{children}</TopbarSlotContext.Provider>
}

export function useTopbarSlot(): HTMLElement | null {
  return useContext(TopbarSlotContext)
}
