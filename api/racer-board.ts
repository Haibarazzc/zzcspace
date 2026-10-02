// Vercel /api/racer-board：樱花公路全网排行榜。
// 成绩由客户端申报，服务端只做范围校验、限流与榜单维护。
// No npm dependencies; Redis credentials stay on the server.
import { createHash, randomUUID } from 'node:crypto';

type Request = { method?: string; url?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { setHeader: (key: string, value: string) => void; status: (code: number) => Response; send: (body: string) => void };
type Session = { startedAt: number; playerId: string; saved?: unknown };
export interface BoardConfig { track: string; car: number; mode: string; laps: number; difficulty: number; autoAccelerate?: boolean }
const PREFIX = 'racer:v1:';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CAR_COUNT = 3;

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

function validConfig(c: BoardConfig) {
  return !!c && typeof c === 'object'
    && (c.track === 'sakura' || c.track === 'coast')
    && Number.isInteger(c.car) && c.car >= 0 && c.car < CAR_COUNT
    && (c.mode === 'race' || c.mode === 'time')
    && Number.isInteger(c.laps) && c.laps >= 1 && c.laps <= 3
    && Number.isInteger(c.difficulty) && c.difficulty >= 0 && c.difficulty <= 2;
}
function boardKey(c: BoardConfig) {
  return `${PREFIX}board:${c.track}:${c.car}:${c.mode}:${c.laps}:${c.difficulty}`;
}

// 原子写入：同会话幂等 + 榜单只保留前 300 名
const SAVE_SCORE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local session = cjson.decode(raw)
if session.saved then return 2 end
redis.call('SET', KEYS[1], cjson.encode({startedAt = session.startedAt, playerId = session.playerId, saved = ARGV[2]}))
redis.call('ZADD', KEYS[2], ARGV[1], ARGV[2])
local extra = redis.call('ZCARD', KEYS[2]) - 300
if extra > 0 then redis.call('ZREMRANGEBYRANK', KEYS[2], 0, extra - 1) end
return 1`;

const RATE_LIMIT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 60) end
return count`;

export default async function handler(req: Request, res: Response) {
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    // ---- 榜单查询 ----
    if (!req.method || req.method === 'GET') {
      const config: BoardConfig = { track: url.searchParams.get('track') || '', car: Number(url.searchParams.get('car')),
        mode: url.searchParams.get('mode') || '', laps: Number(url.searchParams.get('laps')), difficulty: Number(url.searchParams.get('difficulty')) };
      if (!validConfig(config)) return json(res, 400, { error: '查询参数有误。' });
      const ids = await redis(['ZRANGE', boardKey(config), 0, 19]);
      const entries = (Array.isArray(ids) ? ids : []).map((raw, i) => {
        try { const entry = JSON.parse(String(raw)); return { ...entry, rank: i + 1 }; } catch { return null; }
      }).filter(Boolean);
      const total = await redis(['ZCARD', boardKey(config)]);
      return json(res, 200, { entries, total: Number(total) || 0 });
    }

    // ---- 写入：开始对局 / 提交成绩 ----
    let body: Record<string, unknown>;
    try {
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!raw || raw.length > 500_000) return json(res, 413, { error: '请求过大。' });
      body = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid');
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
      const session: Session = { startedAt: Date.now(), playerId: createHash('sha256').update(body.playerId).digest('hex') };
      if (await redis(['SET', PREFIX + 'session:' + sessionId, JSON.stringify(session), 'EX', 7200]) !== 'OK') throw new Error('Save failed');
      return json(res, 200, { sessionId });
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

    // 成绩信任客户端申报：只做配置与范围检查
    const config = body.config as BoardConfig;
    const time = Number(body.time);
    if (!validConfig(config)) return json(res, 400, { error: '比赛配置有误。' });
    if (!Number.isFinite(time) || time < config.laps * 8 || time > 3600) return json(res, 400, { error: '成绩数值有误。' });

    const entry = { id: session.playerId, name, time: Math.round(time * 1000) / 1000, date: new Date().toISOString() };
    const saved = await redis(['EVAL', SAVE_SCORE, 2, sessionKey, boardKey(config), Math.round(entry.time * 1000), JSON.stringify(entry)]);
    if (Number(saved) === 0) return json(res, 410, { error: '对局已过期，请开始新一局。' });
    const after = (await redis(['ZRANGE', boardKey(config), 0, -1])) as string[];
    const rank = after.findIndex(row => { try { return JSON.parse(row).id === session.playerId; } catch { return false; } }) + 1;
    const payload = { rank: rank || undefined, time: entry.time };
    return json(res, 200, Number(saved) === 2 ? (session.saved as object) : payload);
  } catch {
    return json(res, 503, { error: '排行榜暂时连接不上，请稍后重试。' });
  }
}
