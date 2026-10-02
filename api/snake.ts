// Vercel /api/snake：贪吃蛇排行榜（总榜 + 日榜）。成绩由客户端申报，只做范围校验。
// No npm dependencies; Redis credentials stay on the server.
import { createHash, randomBytes, randomUUID } from 'node:crypto';

type Request = { method?: string; url?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { setHeader: (key: string, value: string) => void; status: (code: number) => Response; send: (body: string) => void };
type Session = { seed: number; player: string; startedAt: number; saved?: Record<string, unknown> };
const PREFIX = 'snake:v1:';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function json(res: Response, status: number, data: Record<string, unknown>) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(data));
}

async function redis(command: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Storage unavailable');
  const response = await fetch(url.replace(/\/$/, ''), {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(6000),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error('Storage unavailable');
  return body.result;
}

const READ_BOARD = `
local ids = redis.call('ZREVRANGE', KEYS[1], 0, 19)
local rows = {}
for _, id in ipairs(ids) do
  local row = redis.call('HGET', KEYS[2], id)
  if row then table.insert(rows, row) end
end
return rows`;

const RATE_LIMIT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 60) end
return count`;

// One atomic operation makes retries safe and keeps both boards bounded.
const SAVE_SCORE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local session = cjson.decode(raw)
if session.saved then return cjson.encode(session.saved) end
local player = session.player
local score = tonumber(ARGV[1])
for i = 2, 4, 2 do
  local best = tonumber(redis.call('ZSCORE', KEYS[i], player) or '-1')
  if score > best then
    redis.call('ZADD', KEYS[i], score, player)
    redis.call('HSET', KEYS[i+1], player, ARGV[2])
  end
  local extra = redis.call('ZCARD', KEYS[i]) - 100
  if extra > 0 then
    local removed = redis.call('ZRANGE', KEYS[i], 0, extra - 1)
    for _, id in ipairs(removed) do redis.call('HDEL', KEYS[i+1], id) end
    redis.call('ZREMRANGEBYRANK', KEYS[i], 0, extra - 1)
  end
end
redis.call('EXPIRE', KEYS[4], 259200)
redis.call('EXPIRE', KEYS[5], 259200)
local rank = redis.call('ZREVRANK', KEYS[2], player)
session.saved = { saved = true, score = score, rank = rank and rank + 1 or cjson.null }
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', 7200)
return cjson.encode(session.saved)`;

function beijingDate() { return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10); }

export default async function handler(req: Request, res: Response) {
  const url = new URL(req.url || '/api/snake', 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: '不支持的请求方式。' });
  }
  try {
    if (req.method === 'GET') {
      const period = url.searchParams.get('period') || 'all';
      if (period !== 'all' && period !== 'today') return json(res, 400, { error: '榜单不存在。' });
      const board = PREFIX + (period === 'today' ? beijingDate() : 'all');
      const rows = await redis(['EVAL', READ_BOARD, 2, board, board + ':players']);
      if (!Array.isArray(rows)) throw new Error('Invalid leaderboard');
      return json(res, 200, { entries: rows.map((row, index) => ({ ...JSON.parse(row), rank: index + 1 })), period });
    }

    let body: Record<string, unknown>;
    try {
      if (Number(req.headers?.['content-length'] || 0) > 500_000) return json(res, 413, { error: '对局记录过大。' });
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!raw || raw.length > 500_000) return json(res, 413, { error: '对局记录过大。' });
      body = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid JSON');
    } catch { return json(res, 400, { error: '请求格式有误。' }); }

    const ip = String(req.headers?.['x-vercel-forwarded-for'] || req.headers?.['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 24);
    if (Number(await redis(['EVAL', RATE_LIMIT, 1, PREFIX + 'rate:' + ipHash])) > 40) {
      res.setHeader('Retry-After', '60');
      return json(res, 429, { error: '操作太频繁，请稍等一分钟。' });
    }

    if (body.action === 'start') {
      if (typeof body.playerId !== 'string' || !UUID.test(body.playerId)) return json(res, 400, { error: '玩家标识有误。' });
      const sessionId = randomUUID();
      const seed = randomBytes(4).readUInt32BE() || 1;
      const session: Session = {
        seed, player: createHash('sha256').update(body.playerId).digest('hex'), startedAt: Date.now(),
      };
      if (await redis(['SET', PREFIX + 'session:' + sessionId, JSON.stringify(session), 'EX', 7200]) !== 'OK') throw new Error('Save failed');
      return json(res, 200, { sessionId, seed });
    }

    if (body.action !== 'finish' || typeof body.sessionId !== 'string' || !UUID.test(body.sessionId)) {
      return json(res, 400, { error: '对局标识有误，请开始新一局。' });
    }
    const name = typeof body.name === 'string' ? body.name.normalize('NFKC').trim() : '';
    if (!name || [...name].length > 12 || /[\p{C}<>]/u.test(name)) return json(res, 400, { error: '昵称请使用 1～12 个可见字符，不能包含尖括号。' });
    const sessionKey = PREFIX + 'session:' + body.sessionId;
    const raw = await redis(['GET', sessionKey]);
    if (typeof raw !== 'string') return json(res, 410, { error: '对局已过期，请开始新一局。' });
    const session: Session = JSON.parse(raw);
    if (session.saved) return json(res, 200, session.saved);
    // 信任客户端申报：只做分数范围检查（至少吃到一颗食物）
    const score = Number(body.score);
    if (!Number.isInteger(score) || score < 10 || score > 500) return json(res, 400, { error: '成绩数值有误。' });
    const entry = { id: session.player, name, score, date: new Date().toISOString() };
    const all = PREFIX + 'all';
    const today = PREFIX + beijingDate();
    const saved = await redis(['EVAL', SAVE_SCORE, 5, sessionKey, all, all + ':players', today, today + ':players', score, JSON.stringify(entry)]);
    if (typeof saved !== 'string') return json(res, 410, { error: '对局已过期，请开始新一局。' });
    return json(res, 200, JSON.parse(saved));
  } catch {
    return json(res, 503, { error: '排行榜暂时连接不上，请稍后重试。' });
  }
}
