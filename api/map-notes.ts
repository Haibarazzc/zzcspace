// Vercel serverless function: /api/map-notes
// 地图备注的云端存储（Upstash Redis）。
// 读取公开（所有访客可看备注）；写入需要管理密码（Vercel 环境变量 MAP_ADMIN_PASSWORD）。
// Upstash 未配置时优雅降级：GET 返回 { places: null }，POST 返回 503。

const REDIS_KEY = 'sustech-map-notes'

function ok(res: any, data: Record<string, unknown>, status = 200) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).send(JSON.stringify(data))
}

async function redisCmd(cmd: string, key: string, value?: string): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const args = value ? [cmd, key, value] : [cmd, key]
  const resp = await fetch(url.replace(/\/$/, ''), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const data = await resp.json()
  if (!resp.ok || data.error) throw new Error('Redis request failed')
  return data?.result ?? null
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method === 'GET') {
    // 公开读：返回云端备注列表（无数据时 places 为 null）
    try {
      const raw = await redisCmd('GET', REDIS_KEY)
      ok(res, { places: typeof raw === 'string' ? JSON.parse(raw || 'null') : null })
    } catch {
      ok(res, { error: 'cloud storage unavailable' }, 503)
    }
    return
  }

  if (req.method === 'POST') {
    let body
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body')
    } catch {
      ok(res, { error: 'invalid JSON body' }, 400)
      return
    }
    const password = String(body.password ?? '')
    const adminPassword = process.env.MAP_ADMIN_PASSWORD
    // 未配置密码 → 锁定写入（只读模式）
    if (!adminPassword) {
      ok(res, { error: 'MAP_ADMIN_PASSWORD not configured' }, 503)
      return
    }
    if (password !== adminPassword) {
      ok(res, { error: 'unauthorized' }, 401)
      return
    }
    // 验证通过：body.places 存在则写入，否则仅校验（解锁用）
    if (body.places !== undefined) {
      if (!Array.isArray(body.places)) {
        ok(res, { error: 'places must be an array' }, 400)
        return
      }
      const places = JSON.stringify(body.places)
      if (places.length > 200_000) {
        ok(res, { error: 'payload too large' }, 413)
        return
      }
      try {
        const setResult = await redisCmd('SET', REDIS_KEY, places)
        if (setResult !== 'OK') throw new Error('Save failed')
      } catch {
        ok(res, { error: 'cloud storage unavailable' }, 503)
        return
      }
      ok(res, { saved: true, places: body.places })
      return
    }
    ok(res, { verified: true })
    return
  }

  ok(res, { error: 'method not allowed' }, 405)
}
