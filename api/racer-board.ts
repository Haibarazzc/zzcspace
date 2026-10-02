// Vercel /api/racer-board：樱花公路全网排行榜。
// 服务端用与游戏完全相同的确定性模拟重放对局输入，验证通过才入库。
// No npm dependencies; Redis credentials stay on the server.
import { createHash, randomUUID } from 'node:crypto';

type Request = { method?: string; url?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { setHeader: (key: string, value: string) => void; status: (code: number) => Response; send: (body: string) => void };
type Session = { startedAt: number; playerId: string; saved?: unknown };
const PREFIX = 'racer:v1:';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// 与客户端一致的紧凑事件：t=比赛时间，r=回正，s/a/b/d/g=转向/油门/刹车/漂移/氮气
export interface ReplayEvent { t: number; r?: 1; s?: number; a?: 0 | 1; b?: 0 | 1; d?: 0 | 1; g?: 0 | 1 }
export interface BoardConfig { track: string; car: number; mode: string; laps: number; difficulty: number; autoAccelerate: boolean }

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

// requireAuto：回放验证需要 autoAccelerate（影响模拟），榜单查询/键名不需要
function validConfig(c: BoardConfig, requireAuto = false) {
  return !!c && typeof c === 'object'
    && (c.track === 'sakura' || c.track === 'coast')
    && Number.isInteger(c.car) && c.car >= 0 && c.car < CARS.length
    && (c.mode === 'race' || c.mode === 'time')
    && Number.isInteger(c.laps) && c.laps >= 1 && c.laps <= 3
    && Number.isInteger(c.difficulty) && c.difficulty >= 0 && c.difficulty <= 2
    && (!requireAuto || typeof c.autoAccelerate === 'boolean');
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

// 导出给测试：重放并返回验证后的成绩（秒），失败返回 null
let modelPromise: Promise<{ Race: typeof import('../XHBlogs/app/game/race-model').Race }> | null = null;
async function loadModel() {
  if (!modelPromise) modelPromise = import('../XHBlogs/app/game/race-model');
  return modelPromise;
}

export async function verifyReplay(config: BoardConfig, events: unknown): Promise<{ time: number; place: number } | null> {
  if (!validConfig(config, true) || !Array.isArray(events) || events.length === 0 || events.length > 60000) return null;
  for (const event of events) {
    if (!event || typeof event !== 'object') return null;
    const e = event as ReplayEvent;
    if (typeof e.t !== 'number' || !Number.isFinite(e.t) || e.t < 0) return null;
    if (e.s !== undefined && (typeof e.s !== 'number' || e.s < -1 || e.s > 1)) return null;
  }
  // 事件必须按时间不降序
  for (let i = 1; i < events.length; i++) {
    if ((events[i] as ReplayEvent).t < (events[i - 1] as ReplayEvent).t) return null;
  }
  const { Race } = await loadModel();
  const race = new Race({ track: config.track as 'sakura' | 'coast', car: config.car, mode: config.mode as 'race' | 'time',
    laps: config.laps, difficulty: config.difficulty, autoAccelerate: config.autoAccelerate });
  race.start();
  let input = { steer: 0, accelerate: false, brake: false, drift: false, boost: false }, cursor = 0, recoverAt = -1;
  // 倒计时 3.5s + 比赛 25 分钟封顶，防死循环
  const maxSteps = (3.5 + 1500) * 120;
  let steps = 0;
  while (race.phase !== 'finished' && steps < maxSteps) {
    // 游标递增：应用所有 t <= 当前比赛时间的事件（同刻事件按序，最后一个生效）。
    // 与客户端一致：倒计时期间也传入真实输入（倒计时步会忽略它，但过渡帧必须一致）。
    while (cursor < events.length && (events[cursor] as ReplayEvent).t <= race.time) {
      const e = events[cursor++] as ReplayEvent;
      if (e.r === 1) recoverAt = e.t;
      else input = { steer: e.s ?? 0, accelerate: e.a === 1, brake: e.b === 1, drift: e.d === 1, boost: e.g === 1 };
    }
    if (recoverAt >= 0 && race.time >= recoverAt && race.phase === 'racing') { race.recover(); recoverAt = -1; }
    race.update(1 / 30, input);
    steps += 4;
  }
  const time = race.player.finishedAt;
  if (time === null || race.phase !== 'finished') return null;
  return { time: Math.round(time * 1000) / 1000, place: race.place };
}

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
      if (!raw || raw.length > 500_000) return json(res, 413, { error: '对局记录过大。' });
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

    const result = await verifyReplay(body.config as BoardConfig, body.events);
    if (!result) return json(res, 422, { error: '对局校验未通过。' });
    // 不可能比模拟时间更快跑完（留 3 秒余量覆盖倒计时提交间隔）
    if (Date.now() - session.startedAt + 3000 < result.time * 1000) return json(res, 422, { error: '对局校验未通过。' });

    const entry = { id: session.playerId, name, time: result.time, date: new Date().toISOString() };
    const saved = await redis(['EVAL', SAVE_SCORE, 2, sessionKey, boardKey(body.config as BoardConfig), Math.round(result.time * 1000), JSON.stringify(entry)]);
    if (Number(saved) === 0) return json(res, 410, { error: '对局已过期，请开始新一局。' });
    const after = (await redis(['ZRANGE', boardKey(body.config as BoardConfig), 0, -1])) as string[];
    const rank = after.findIndex(row => { try { return JSON.parse(row).id === session.playerId; } catch { return false; } }) + 1;
    const payload = { rank: rank || undefined, time: result.time };
    return json(res, 200, Number(saved) === 2 ? (session.saved as object) : payload);
  } catch (err) {
    return json(res, 500, { error: '排行榜暂时连接不上，请稍后重试。', detail: String((err as Error)?.stack || err) });
  }
}
