/**
 * Used only by the portable single-file build.
 * A file:// page cannot register a service worker, so the PWA hook resolves to
 * an inert state instead of trying to install one.
 */
export function useRegisterSW(_options?: unknown) {
  const needRefresh = [false, () => undefined] as [boolean, (value: boolean) => void]
  const offlineReady = [false, () => undefined] as [boolean, (value: boolean) => void]

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async (_reloadPage?: boolean) => undefined,
  }
}
