// 构建后合并脚本：把介绍页移入 /about/，把门户静态页放到根目录
// 由 package.json 的 build 在 vite build 之后调用
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

const root = process.cwd()
const dist = join(root, 'dist')
const about = join(dist, 'about')
const portal = join(root, 'portal')

function fail(msg) {
  console.error('[build-portal] 错误: ' + msg)
  process.exit(1)
}

if (!existsSync(join(dist, 'index.html'))) fail('vite 构建产物 dist/index.html 不存在')

// 1. 介绍页移入 dist/about/
mkdirSync(about, { recursive: true })
renameSync(join(dist, 'index.html'), join(about, 'index.html'))
if (existsSync(join(dist, 'assets'))) {
  renameSync(join(dist, 'assets'), join(about, 'assets'))
}

// 2. 门户静态页复制到 dist 根（注入最新文章卡）
let indexHtml = readFileSync(join(portal, 'index.html'), 'utf8')
const latestPath = join(dist, 'blog-latest.json')
if (existsSync(latestPath)) {
  try {
    const data = JSON.parse(readFileSync(latestPath, 'utf8'))
    if (data && data.latest) {
      indexHtml = indexHtml
        .replace('__LATEST_URL__', data.latest.url)
        .replace('__LATEST_TITLE__', esc(data.latest.title))
        .replace('__LATEST_SUMMARY__', esc(data.latest.summary || ''))
      console.log('[build-portal] ✓ 最新文章卡: ' + data.latest.title)
    }
    if (data && typeof data.count === 'number') {
      indexHtml = indexHtml.replace('data-posts-count>3<', 'data-posts-count>' + data.count + '<')
      console.log('[build-portal] ✓ 文章计数: ' + data.count)
    }
    if (data && Array.isArray(data.posts) && data.posts.length) {
      const listHtml = data.posts.map((p) =>
        '<a class="post-line" href="' + p.url + '"><time>' + esc(p.date || '') + '</time><strong>' + esc(p.title) + '</strong></a>'
      ).join('')
      indexHtml = indexHtml.replace('<!--LATEST_LIST-->', listHtml)
      console.log('[build-portal] ✓ 文章列表: ' + data.posts.length + ' 条')
    }
  } catch { /* keep placeholders replaced with fallback below */ }
}
indexHtml = indexHtml
  .replace(/__LATEST_URL__/g, '/blog/')
  .replace(/__LATEST_TITLE__/g, '博客文章')
  .replace(/__LATEST_SUMMARY__/g, '记录学习与探索的过程')
  .replace(/(href|src)="\/(?!\/)/g, '$1="./')
writeFileSync(join(dist, 'index.html'), indexHtml)
cpSync(join(portal, 'portal.css'), join(dist, 'portal.css'))

// 2b. 音乐馆页
mkdirSync(join(dist, 'music'), { recursive: true })
cpSync(join(portal, 'music.html'), join(dist, 'music', 'index.html'))

// 3. 校验三个入口齐全
const checks = [
  ['门户根页', join(dist, 'index.html')],
  ['介绍页', join(about, 'index.html')],
  ['地图页', join(dist, 'map', 'index.html')],
  ['音乐馆', join(dist, 'music', 'index.html')],
  ['音乐馆样式可达', join(dist, 'portal.css')],
]
for (const [label, path] of checks) {
  if (!existsSync(path)) fail(label + ' 缺失: ' + path)
  console.log('[build-portal] ✓ ' + label + ' -> ' + path)
}
console.log('[build-portal] 合并完成')
