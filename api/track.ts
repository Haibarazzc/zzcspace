// Vercel serverless function: /api/track
// Collects visitor analytics. Always writes one JSON log line to the function log,
// and — when Upstash Redis env vars are configured — also persists the event so the
// on-site viewer (/api/logs) can read it back. Never fails the request if Redis is down.

function parseJSON(s: string): Record<string, unknown> {
  try { return JSON.parse(s) } catch { return {} }
}
function str(v: unknown, max: number): string {
  return String(v ?? '').slice(0, max)
}
function num(v: unknown, lo: number, hi: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : lo
}

async function persistEvent(json: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    console.log('[track][redis] env missing url=' + (url ? 'set' : 'MISSING') + ' token=' + (token ? 'set' : 'MISSING'))
    return
  }
  try {
    // Bucket by Beijing date (UTC+8) so daily views match the owner's local day.
    // Upstash REST expects a command array: ["RPUSH", key, value].
    const bj = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
    const resp = await fetch(url.replace(/\/$/, ''), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(['RPUSH', 'track:' + bj, json]),
    })
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      console.log('[track][redis] rpush failed status=' + resp.status + ' body=' + body.slice(0, 300))
    }
  } catch (err) {
    console.log('[track][redis] rpush error: ' + String(err))
  }
}

export default async function handler(req: any, res: any) {
  // Server-derived fields (headers) — Vercel guarantees the real client IP first
  const ip = str(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '', 64).split(',')[0].trim()
  const ua = str(req.headers['user-agent'], 512)
  const referer = str(req.headers['referer'], 2048)

  // Client-sent fields (body: application/json object, or sendBeacon's text/plain JSON string; query params as fallback)
  const url = new URL(req.url || '/', 'http://localhost')
  const query: Record<string, unknown> = {}
  url.searchParams.forEach((v, k) => { query[k] = v })
  const body = typeof req.body === 'string'
    ? parseJSON(req.body)
    : (req.body && typeof req.body === 'object' ? req.body : {})
  const src = { ...query, ...body }

  const event = {
    t: new Date().toISOString(), // server receipt time is authoritative (client clock is forgeable)
    type: str(src.type, 32) || 'view',
    vid: str(src.vid, 64),
    page: str(src.page, 512),
    ref: str(src.ref, 2048),
    depth: num(src.depth, 0, 100),
    ip,
    ua,
    referer,
  }

  const json = JSON.stringify(event)
  console.log('[track] ' + json)
  await persistEvent(json)
  res.statusCode = 204
  res.end()
}
