// Run after both site builds. Keep the API functions alongside the static site.
import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'deploy-site')
const blog = join(root, 'XHBlogs', 'out')
const portfolio = join(root, 'ZZC', 'dist')
const api = join(root, 'ZZC', 'api')

for (const file of [join(blog, 'index.html'), join(portfolio, 'about', 'index.html'),
  ...['map-notes.ts', 'track.ts', 'logs.ts'].map(name => join(api, name))]) {
  if (!existsSync(file)) throw new Error('Missing build input: ' + file)
}

mkdirSync(output, { recursive: true })
for (const name of readdirSync(output)) {
  if (name === '.vercel' || name === '.gitignore') continue
  const target = resolve(output, name)
  if (!target.startsWith(output + sep)) throw new Error('Unsafe output path: ' + target)
  rmSync(target, { recursive: true, force: true })
}
cpSync(blog, output, { recursive: true, filter: source => source !== join(blog, 'portfolio') })
cpSync(portfolio, join(output, 'portfolio'), { recursive: true })
cpSync(api, join(output, 'api'), { recursive: true })
copyFileSync(join(root, 'XHBlogs', 'vercel.json'), join(output, 'vercel.json'))

// Next 16 on Windows exports nested segment files with backslashes. The browser
// requests the dotted filenames used by the client router on all platforms.
let segmentCount = 0
for (const file of readdirSync(blog, { recursive: true })) {
  const normalized = file.replaceAll('\\', '/')
  const match = normalized.match(/^(.*?)(__next[^]*\.txt)$/)
  if (!match || !match[2].includes('/')) continue
  const alias = match[1] + match[2].replaceAll('/', '.')
  copyFileSync(join(blog, file), join(output, alias))
  segmentCount++
}
console.log(`Deployment ready: main site, portfolio, 3 API functions, ${segmentCount} navigation data aliases.`)
