// Vercel serverless function: /api/stats?key=...&days=14
// JSON 聚合接口，供博客 /stats 统计面板使用。
// 与 /api/logs 同一把 LOGS_KEY；按北京日期逐天 LRANGE 后在服务端聚合。

function beijingDate(offsetDays = 0): string {
  return new Date(Date.now() + (8 + offsetDays * 24) * 3600 * 1000).toISOString().slice(0, 10)
}
function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
// 兼容正确的存储形态（{...}）与旧的包裹形态（["{...}"]）
function parseEvent(s: string): any {
  try {
    const v = JSON.parse(s)
    if (v && typeof v === 'object' && !Array.isArray(v)) return v
    if (Array.isArray(v) && v.length >= 1) {
      const inner = typeof v[0] === 'string' ? JSON.parse(v[0]) : v[0]
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) return inner
    }
    return null
  } catch { return null }
}
function deviceOf(ua: string): 'mobile' | 'desktop' | 'other' {
  if (!ua) return 'other'
  if (/bot|crawler|spider|curl|wget|headless/i.test(ua)) return 'other'
  if (/mobile|iphone|android.*mobile|ipad|tablet/i.test(ua)) return 'mobile'
  return 'desktop'
}
function topN(counter: Map<string, number>, n: number) {
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }))
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '/', 'http://localhost')
  const key = url.searchParams.get('key') || ''
  const days = Math.min(30, Math.max(1, Number(url.searchParams.get('days')) || 14))

  const logsKey = process.env.LOGS_KEY
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  res.setHeader('Cache-Control', 'no-store')
  if (!logsKey || key !== logsKey) { res.statusCode = 403; res.end('403 Forbidden'); return }
  if (!redisUrl || !redisToken) { res.statusCode = 503; res.end('503 Redis not configured'); return }

  const today = beijingDate()
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) dates.push(addDays(today, -i))

  // 逐天并行取整日事件列表（个人站量级小；单日上限 1000 防御）
  const perDay = await Promise.all(dates.map(async (date) => {
    try {
      const resp = await fetch(redisUrl.replace(/\/$/, ''), {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + redisToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(['LRANGE', 'track:' + date, '-1000', '-1']),
      })
      const data = await resp.json().catch(() => null)
      const list: any[] = Array.isArray(data && data.result)
        ? data.result.map((s: string) => parseEvent(s)).filter(Boolean)
        : []
      // LRANGE 天然按时间正序（RPUSH 尾插），聚合保持正序
      return { date, events: list }
    } catch {
      return { date, events: [] }
    }
  }))

  // 聚合
  const daysOut: Array<{ date: string; views: number; uniques: number; events: number }> = []
  const pageCounter = new Map<string, number>()
  const refCounter = new Map<string, number>()
  const devices = { mobile: 0, desktop: 0, other: 0 }
  const allVids = new Set<string>()
  const recent: any[] = []
  let totalViews = 0
  let totalDepthReached = 0 // depth>=50 的会话数（粗略阅读完成度）

  const depthByVid = new Map<string, number>()

  for (const { date, events } of perDay) {
    const dayVids = new Set<string>()
    let views = 0
    for (const e of events) {
      const type = String(e.type || 'view')
      if (type === 'view') {
        views++
        const page = String(e.page || '/').split('#')[0]
        pageCounter.set(page, (pageCounter.get(page) || 0) + 1)
        if (e.vid) { dayVids.add(String(e.vid)); allVids.add(String(e.vid)) }
        devices[deviceOf(String(e.ua || ''))]++
        if (e.t) recent.push({ t: e.t, page, ref: e.ref || '', ua: String(e.ua || '').slice(0, 120) })
      } else if (type === 'depth' && e.vid) {
        const d = Number(e.depth) || 0
        if (d > (depthByVid.get(String(e.vid)) || 0)) depthByVid.set(String(e.vid), d)
      }
    }
    totalViews += views
    daysOut.push({ date, views, uniques: dayVids.size, events: events.length })
  }
  for (const d of depthByVid.values()) { if (d >= 50) totalDepthReached++ }

  // 来源：取 ref / referer 的主机名，去掉空值与站内来源
  const ownHosts = new Set(['zzcspace.com', 'www.zzcspace.com', ''])
  for (const { events } of perDay) {
    for (const e of events) {
      if (String(e.type || 'view') !== 'view') continue
      const raw = String(e.ref || e.referer || '')
      if (!raw) continue
      try {
        const host = new URL(raw, 'https://x.invalid').hostname
        if (!ownHosts.has(host)) refCounter.set(host, (refCounter.get(host) || 0) + 1)
      } catch { /* 非法 URL 忽略 */ }
    }
  }

  recent.reverse() // 最新在前
  recent.length = Math.min(recent.length, 60)

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({
    generatedAt: new Date().toISOString(),
    days: daysOut,
    totalViews,
    totalUniques: allVids.size,
    totalVisits: allVids.size, // vid 按访问生成，独立 vid 数即访问次数
    readSessions: totalDepthReached,
    devices,
    topPages: topN(pageCounter, 10),
    topRefs: topN(refCounter, 8),
    recent,
  }))
}
