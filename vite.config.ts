import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function normalizeBase(input?: string) {
  if (!input || input === '/') return '/'
  const clean = input.replace(/^\/+|\/+$/g, '')
  return clean ? `/${clean}/` : '/'
}

export default defineConfig(() => {
  const base = normalizeBase(process.env.BASE_PATH)

  return {
    base,
    server: {
      port: 7173,
      strictPort: true,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: '拾焰 · 念行手记',
          short_name: '拾焰',
          description: '一个把念头、目标与一簇火留在本地的个人手记。',
          lang: 'zh-CN',
          dir: 'ltr',
          id: base,
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          theme_color: '#f3eee3',
          background_color: '#f3eee3',
          categories: ['productivity', 'lifestyle'],
          icons: [
            {
              src: `${base}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: `${base}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: '记一个念头',
              short_name: '记念头',
              url: `${base}#/ideas`,
              icons: [{ src: `${base}pwa-192x192.png`, sizes: '192x192' }],
            },
            {
              name: '看一眼目标',
              short_name: '看目标',
              url: `${base}#/goals`,
              icons: [{ src: `${base}pwa-192x192.png`, sizes: '192x192' }],
            },
            {
              name: '续一簇火',
              short_name: '续一焰',
              url: `${base}#/fire`,
              icons: [{ src: `${base}pwa-192x192.png`, sizes: '192x192' }],
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: `${base}index.html`,
        },
      }),
    ],
  }
})
