// 博客构建脚本：把 blog/*.md 转成 dist/blog/ 的静态页面
// 由 package.json 的 build 在 build-portal 之后调用
import { marked } from 'marked'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const blogDir = join(root, 'blog')
const distBlog = join(root, 'dist', 'blog')
const blogCss = join(root, 'portal', 'blog.css')

function fail(msg) {
  console.error('[build-blog] 错误: ' + msg)
  process.exit(1)
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// 解析 frontmatter + 正文
function parsePost(file) {
  // 兼容 CRLF：git autocrlf 可能把工作区文件写成 \r\n
  const raw = readFileSync(join(blogDir, file), 'utf8').replace(/\r\n/g, '\n')
  const meta = {}
  let body = raw
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
      if (kv) {
        let v = kv[2].trim()
        // 去掉包裹引号（支持 \" 转义）
        if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
          v = v.slice(1, -1).replace(/\\"/g, '"')
        }
        meta[kv[1]] = v
      }
    }
    body = raw.slice(m[0].length)
  }
  if (!meta.title) fail(file + ' 缺少 title 元数据')
  return {
    slug: file.replace(/\.md$/, ''),
    title: meta.title,
    date: meta.date || '',
    summary: meta.summary || '',
    html: marked.parse(body),
  }
}

function layout(title, inner, opts = {}) {
  const breadcrumb = opts.back === 'portal'
    ? '<a href="/">← 返回门户</a>'
    : '<a href="/">门户</a><span>/</span><a href="/blog/">博客</a>' + (opts.current ? '<span>/</span><span>' + esc(opts.current) + '</span>' : '')
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} · 曾子丞的博客</title>
  <meta name="description" content="${esc(opts.desc || title)}" />
  <meta name="theme-color" content="#080a09" />
  <link rel="icon" href="/favicon.png" type="image/png" />
  <link rel="stylesheet" href="${opts.cssBase || ''}blog.css" />
</head>
<body>
  <main class="page">
    <nav class="breadcrumb">${breadcrumb}</nav>
    ${inner}
  </main>
</body>
</html>`
}

// 主流程
if (!existsSync(blogDir)) fail('blog 目录不存在')

const files = readdirSync(blogDir).filter((f) => f.endsWith('.md'))
const posts = files.map(parsePost).sort((a, b) => (b.date || '').localeCompare(a.date || ''))

rmSync(distBlog, { recursive: true, force: true })
mkdirSync(distBlog, { recursive: true })
copyFileSync(blogCss, join(distBlog, 'blog.css'))

// 列表页
const listItems = posts.map((p) => `
  <a class="post-card" href="/blog/${encodeURIComponent(p.slug)}/">
    <time>${esc(p.date)}</time>
    <h2>${esc(p.title)}</h2>
    ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
  </a>`).join('')

writeFileSync(join(distBlog, 'index.html'), layout('博客', `
  <header class="blog-head">
    <p>BLOG</p>
    <h1>博客文章</h1>
    <div class="sub">记录学习与探索的过程。</div>
  </header>
  <div class="post-list">${listItems || '<p class="post-empty">还没有文章，敬请期待。</p>'}</div>
`, { desc: '曾子丞的博客 —— 记录学习与探索的过程' }))
console.log('[build-blog] ✓ 列表页 dist/blog/index.html (' + posts.length + ' 篇)')

// 文章页
for (const p of posts) {
  const dir = join(distBlog, p.slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), layout(p.title, `
    <article class="article-head">
      <time>${esc(p.date)}</time>
      <h1>${esc(p.title)}</h1>
    </article>
    <div class="article-body">${p.html}</div>
  `, { back: 'blog', current: p.title, desc: p.summary || p.title, cssBase: '../' }))
  console.log('[build-blog] ✓ 文章页 dist/blog/' + p.slug + '/')
}
console.log('[build-blog] 完成')

// 输出文章数据，供 build-portal 注入门户首页（计数 + 最新文章卡 + 文章列表）
writeFileSync(
  join(root, 'dist', 'blog-latest.json'),
  JSON.stringify({
    count: posts.length,
    latest: posts.length ? { title: posts[0].title, date: posts[0].date, summary: posts[0].summary, url: '/blog/' + encodeURIComponent(posts[0].slug) + '/' } : null,
    posts: posts.slice(0, 5).map((p) => ({ title: p.title, date: p.date, url: '/blog/' + encodeURIComponent(p.slug) + '/' })),
  }),
)
console.log('[build-blog] ✓ latest.json (count=' + posts.length + ')')
