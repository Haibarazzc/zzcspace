// Vercel serverless function: /api/logs?key=...&date=YYYY-MM-DD
// Protected on-site viewer for the tracking logs stored in Upstash Redis.
// Requires LOGS_KEY env var to match the ?key= param.

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function short(s: string, n: number): string {
  const t = String(s ?? '')
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}
function beijingDate(offsetDays = 0): string {
  return new Date(Date.now() + (8 + offsetDays * 24) * 3600 * 1000).toISOString().slice(0, 10)
}
function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
// Tolerate both the correct stored shape ({...}) and the old wrapped shape (["{...}"]).
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
// Display stored UTC timestamps in Beijing time (UTC+8), matching the date buckets.
function bjTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return esc(iso)
  const b = new Date(d.getTime() + 8 * 3600 * 1000)
  return b.toISOString().slice(0, 10) + ' ' + b.toISOString().slice(11, 19)
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '/', 'http://localhost')
  const key = url.searchParams.get('key') || ''
  const dateParam = (url.searchParams.get('date') || '').trim()

  const logsKey = process.env.LOGS_KEY
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!logsKey || key !== logsKey) { res.statusCode = 403; res.end('403 Forbidden'); return }
  if (!redisUrl || !redisToken) { res.statusCode = 503; res.end('503 Redis not configured'); return }

  const day = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : beijingDate()
  const limit = 200

  let events: any[] = []
  let diag = 'date=' + day
  try {
    // Upstash REST expects a command array: ["LRANGE", key, start, stop]
    const resp = await fetch(redisUrl.replace(/\/$/, ''), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + redisToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(['LRANGE', 'track:' + day, '-' + limit, '-1']),
    })
    const raw = await resp.text().catch(() => '')
    diag += ' status=' + resp.status + ' raw=' + raw.slice(0, 600)
    console.log('[logs][redis] lrange status=' + resp.status + ' raw=' + raw.slice(0, 800))
    let data: any = null
    try { data = JSON.parse(raw) } catch { /* non-JSON */ }
    events = Array.isArray(data && data.result)
      ? data.result.map((s: string) => parseEvent(s)).filter(Boolean)
      : []
    if (events.length === 0) diag += ' result=' + JSON.stringify((data && data.result) || null)
  } catch (err) {
    diag += ' error=' + String(err)
    console.log('[logs][redis] lrange error: ' + String(err))
    events = []
  }
  events.reverse() // newest first

  const rows = events.map((e, i) => `<tr>
    <td class="dim">${events.length - i}</td>
    <td>${bjTime(e.t || '')}</td>
    <td><span class="tag t-${esc(e.type || 'view')}">${esc(e.type || '')}</span></td>
    <td class="mono">${esc(e.ip || '')}</td>
    <td title="${esc(e.ua || '')}">${esc(short(e.ua || '', 42))}</td>
    <td class="mono">${esc(e.page || '')}</td>
    <td title="${esc(e.ref || '')}">${esc(short(e.ref || '—', 40))}</td>
    <td>${e.depth ?? ''}</td>
    <td class="dim mono">${esc((e.vid || '').slice(0, 8))}</td>
  </tr>`).join('')

  const prev = addDays(day, -1), next = addDays(day, 1)
  const base = `/api/logs?key=${encodeURIComponent(key)}&date=`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>访问日志 · ${day}</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#080a09;color:#dfe3e8;font:13px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
  .wrap{max-width:1180px;margin:0 auto;padding:28px 20px 60px}
  h1{font-size:20px;font-weight:600;margin:0 0 4px;letter-spacing:.02em}
  .sub{color:#8b919c;font-size:12px;margin-bottom:18px}
  .nav{display:flex;align-items:center;gap:10px;margin:14px 0 18px;font-size:13px}
  .nav a{color:#72bb8f;text-decoration:none;border:1px solid rgba(114,187,143,.28);border-radius:8px;padding:4px 12px}
  .nav a:hover{background:rgba(114,187,143,.1)}
  .nav .cur{color:#c6cdd6;border:1px solid rgba(255,255,255,.14);padding:4px 12px;border-radius:8px}
  .table-wrap{overflow-x:auto;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.015)}
  table{border-collapse:collapse;width:100%;min-width:980px;font-size:12px}
  th,td{padding:8px 12px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;vertical-align:top}
  th{color:#8b919c;font-weight:500;font-size:11px;letter-spacing:.08em;background:rgba(255,255,255,.02);position:sticky;top:0}
  tr:last-child td{border-bottom:0}
  td.mono,.mono{font-family:ui-monospace,Consolas,monospace}
  td.dim,.dim{color:#7a818b}
  .tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;line-height:1.5;border:1px solid}
  .t-view{color:#72bb8f;border-color:rgba(114,187,143,.3);background:rgba(114,187,143,.08)}
  .t-depth{color:#8aa0ff;border-color:rgba(138,160,255,.3);background:rgba(138,160,255,.08)}
  .empty{color:#7a818b;text-align:center;padding:40px 0}
  .count{color:#72bb8f;font-weight:600}
  footer{margin-top:24px;color:#5b626d;font-size:12px}
  .diag{margin-top:12px;color:#c98b8b;font:11px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap;word-break:break-all}
</style></head><body><div class="wrap">
  <h1>访问日志</h1>
  <div class="sub">${day}（北京时间）· 最近 ${events.length} 条事件（如需更早日期，改 URL 里的 date=YYYY-MM-DD）</div>
  <div class="nav"><a href="${base}${prev}">← ${prev}</a><span class="cur">${day}</span><a href="${base}${next}">${next} →</a></div>
  <div class="table-wrap"><table>
    <thead><tr><th>#</th><th>时间</th><th>类型</th><th>IP</th><th>User-Agent</th><th>页面</th><th>Referrer</th><th>深度%</th><th>会话</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="9" class="empty">${day} 暂无记录</td></tr>`}</tbody>
  </table></div>
  <footer>追踪端点 /api/track 已写入 console 日志与 Redis；本页仅对持有密钥的人可见。${events.length === 0 ? `<pre class="diag">${esc(diag)}</pre>` : ''}</footer>
</div></body></html>`)
}
