import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))

// Vite 7.3.x 在 Windows 上构建时，index.html 内联 <style> 的 html-proxy
// 模块会因 config 实例不一致而加载失败（"No matching HTML proxy module
// found"）。这里在 vite 自己处理之前把内联样式抽成一个虚拟 CSS 模块，让
// 样式走普通的样式表链路；package-single.mjs 最后仍会把它内联回 <style>。
function extractHtmlInlineStyles(): Plugin {
  let code: string | null = null
  return {
    name: 'shiyan:extract-html-inline-styles',
    enforce: 'pre',
    transform(html, id) {
      if (!path.basename(id).endsWith('.html')) return null
      const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
      if (!styles.length) return null
      code = styles.map((match) => match[1]).join('\n')
      return html.replace(
        /<style[^>]*>[\s\S]*?<\/style>/gi,
        '<link rel="stylesheet" href="./virtual-html-styles.css">',
      )
    },
    resolveId(source, importer) {
      if (source !== './virtual-html-styles.css' || !importer?.endsWith('.html')) return null
      return '\0shiyan-virtual-html-styles.css'
    },
    load(id) {
      if (id !== '\0shiyan-virtual-html-styles.css') return null
      return code ?? ''
    },
  }
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), extractHtmlInlineStyles()],
  resolve: {
    alias: [
      {
        find: 'virtual:pwa-register/react',
        replacement: path.resolve(root, 'src/lib/pwaStub.ts'),
      },
    ],
  },
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
