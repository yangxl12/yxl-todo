import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist-single')
const output = path.join(root, 'shiyan.html')

const escapeClosingTag = (source, tag) =>
  source.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`)

const mimeTypes = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

async function dataUriFor(publicPath) {
  const extension = path.extname(publicPath)
  const file = await fs.readFile(path.join(root, 'public', publicPath))
  const mime = mimeTypes[extension] ?? 'application/octet-stream'
  if (mime === 'image/svg+xml') {
    return `data:${mime};charset=utf-8,${encodeURIComponent(file.toString('utf8'))}`
  }
  return `data:${mime};base64,${file.toString('base64')}`
}

async function localFileForUrl(url) {
  const cleanUrl = url.replace(/^\.\//, '').split('?')[0].split('#')[0]
  const file = path.resolve(dist, cleanUrl)
  if (!file.startsWith(dist + path.sep)) {
    throw new Error(`Refusing to inline a file outside dist-single: ${url}`)
  }
  return fs.readFile(file, 'utf8')
}

let html = await fs.readFile(path.join(dist, 'index.html'), 'utf8')

// Replace Vite's external stylesheet with the generated CSS.
const stylesheetPattern = /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/gi
const stylesheets = [...html.matchAll(stylesheetPattern)]
if (stylesheets.length !== 1) {
  throw new Error(`Expected exactly one stylesheet, found ${stylesheets.length}`)
}
for (const match of stylesheets) {
  const css = await localFileForUrl(match[1])
  html = html.replace(match[0], () => `<style>${escapeClosingTag(css, 'style')}</style>`)
}

// Replace the module entry script with inline, non-fetching code.
const scriptPattern = /<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi
const scripts = [...html.matchAll(scriptPattern)]
if (scripts.length !== 1) {
  throw new Error(`Expected exactly one module script, found ${scripts.length}`)
}
for (const match of scripts) {
  const js = await localFileForUrl(match[1])
  html = html.replace(
    match[0],
    () => `<script type="module">${escapeClosingTag(js, 'script')}</script>`,
  )
}

// No modulepreload links should point outside the single file.
html = html.replace(/\s*<link\b[^>]*rel="modulepreload"[^>]*>/gi, '')

// Inline the icons so sharing only the HTML keeps the identity intact.
const iconUri = await dataUriFor('icon.svg')
html = html.replace(
  /<link\b[^>]*rel="icon"[^>]*>/i,
  () => `<link rel="icon" type="image/svg+xml" href="${iconUri}" />`,
)

const appleIconUri = await dataUriFor('apple-touch-icon.png')
html = html.replace(
  /<link\b[^>]*rel="apple-touch-icon"[^>]*>/i,
  () => `<link rel="apple-touch-icon" href="${appleIconUri}" />`,
)

// If a font URL or any other local asset URL remains, inline it as well.
const assetUrlPattern = /url\((?!['"]?data:)(['"]?)([^)'"]+)\1\)/g
for (const match of html.matchAll(assetUrlPattern)) {
  const assetUrl = match[2]
  if (/^(https?:|data:|#)/.test(assetUrl)) continue
  const extension = path.extname(assetUrl.split('?')[0])
  const mime = mimeTypes[extension]
  if (!mime) continue
  const file = path.resolve(dist, assetUrl.replace(/^\.\//, '').split('?')[0])
  if (!file.startsWith(dist + path.sep)) continue
  const data = await fs.readFile(file)
  const dataUrl =
    mime === 'image/svg+xml'
      ? `data:${mime};charset=utf-8,${encodeURIComponent(data.toString('utf8'))}`
      : `data:${mime};base64,${data.toString('base64')}`
  html = html.replaceAll(match[0], () => `url("${dataUrl}")`)
}

// Validate the markup only. The bundled JavaScript legitimately contains
// strings such as source URLs and must not be parsed as HTML tags.
const markup = html.replace(/<script type="module">[\s\S]*?<\/script>/gi, '<script type="module"></script>')
const unresolvedReferences = [
  ...markup.matchAll(/(?:src|href)="((?:\.\/|\/)[^"]+)"/g),
].map((match) => match[1])
if (unresolvedReferences.length) {
  throw new Error(`External file references remain: ${unresolvedReferences.join(', ')}`)
}

if (/<script\b[^>]*\bsrc=|<link\b[^>]*rel="stylesheet"/i.test(markup)) {
  throw new Error('The packaged file still references external scripts or styles.')
}
const styleMarkup = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
  .map((match) => match[1])
  .join('\n')
if (/url\(\s*['"]?(?:\.\/|\/)/i.test(styleMarkup) || /assets\//.test(styleMarkup)) {
  throw new Error('The packaged stylesheet still contains an external asset URL.')
}
if (/\.woff2?(?:['")?#]|\s|$)/i.test(styleMarkup)) {
  throw new Error('A font file was not embedded in the portable build.')
}

html = `<!-- 拾焰 · portable single-file build. Open directly in a browser; PWA install/service worker is intentionally disabled. -->\n${html}`
await fs.writeFile(output, html, 'utf8')
await fs.rm(dist, { recursive: true, force: true })

const size = Buffer.byteLength(html, 'utf8')
console.log(`Portable build written to ${path.relative(root, output)} (${(size / 1024).toFixed(1)} KiB)`)
