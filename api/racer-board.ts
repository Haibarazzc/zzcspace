// Vercel /api/racer-board：樱花公路全网排行榜。
// 服务端用与游戏完全相同的确定性模拟重放对局输入，验证通过才入库。
// No npm dependencies; Redis credentials stay on the server.
import { createHash, randomUUID } from 'node:crypto';

// ==== BEGIN race-model（由 scripts/sync-game-model.mjs 同步，勿手改）====
// Deterministic arcade simulation. Rendering and browser APIs live elsewhere.
export type TrackId = 'sakura' | 'coast';
export type Mode = 'race' | 'time' | 'practice';
export type Phase = 'garage' | 'countdown' | 'racing' | 'paused' | 'finished';
export interface RaceConfig { track: TrackId; car: number; difficulty: number; laps: number; mode: Mode; autoAccelerate: boolean }
export interface Input { steer: number; accelerate: boolean; brake: boolean; drift: boolean; boost: boolean }
export const EMPTY_INPUT: Input = { steer: 0, accelerate: false, brake: false, drift: false, boost: false };
export const CARS = [
  { name: '樱色流星', label: '均衡型', color: '#f05d86', maxSpeed: 62, acceleration: 23, handling: 1, boost: 1 },
  { name: '海盐闪电', label: '操控型', color: '#28b5ca', maxSpeed: 59, acceleration: 25, handling: 1.18, boost: 1 },
  { name: '落日疾风', label: '极速型', color: '#f4af43', maxSpeed: 66, acceleration: 20, handling: .89, boost: 1.1 },
] as const;
export const TRACK_INFO = {
  sakura: { name: '樱花公路', subtitle: '山间的风，和一场粉色追逐。', difficulty: '舒展长弯 · 新手友好', width: 30 },
  coast: { name: '晴海环线', subtitle: '沿着海岸，把风留在身后。', difficulty: '连续 S 弯 · 进阶挑战', width: 28 },
} as const;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const wrap = (n: number, length: number) => ((n % length) + length) % length;
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--.---';
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(3).padStart(6, '0')}`;
}
export interface TrackPoint { x: number; z: number; tx: number; tz: number; nx: number; nz: number; curvature: number }
export interface Track { id: TrackId; points: TrackPoint[]; length: number; width: number; pads: number[]; sample: (distance: number, offset?: number) => TrackPoint }

export function makeTrack(id: TrackId): Track {
  const anchors = id === 'sakura'
    ? [[0, 0], [0, 155], [82, 267], [242, 277], [330, 176], [300, 65], [375, -65], [262, -197], [90, -191], [-66, -95]]
    : [[0, 0], [0, 145], [88, 247], [215, 234], [279, 148], [192, 57], [274, -40], [370, -129], [287, -256], [100, -220], [-68, -114]];
  const dense: { x: number; z: number; distance: number }[] = [];
  const cubic = (a: number, b: number, c: number, d: number, t: number) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  let length = 0;
  for (let j = 0; j <= anchors.length * 100; j++) {
    const segment = Math.floor(j / 100), t = j % 100 / 100;
    const p = [-1, 0, 1, 2].map(n => anchors[wrap(segment + n, anchors.length)]);
    const x = cubic(p[0][0], p[1][0], p[2][0], p[3][0], t);
    const z = cubic(p[0][1], p[1][1], p[2][1], p[3][1], t);
    if (dense.length) length += Math.hypot(x - dense[dense.length - 1].x, z - dense[dense.length - 1].z);
    dense.push({ x, z, distance: length });
  }
  const count = 1200;
  let cursor = 1;
  const points: TrackPoint[] = Array.from({ length: count }, (_, i) => {
    const distance = i / count * length;
    while (cursor < dense.length - 1 && dense[cursor].distance < distance) cursor++;
    const a = dense[cursor - 1], b = dense[cursor];
    const t = (distance - a.distance) / (b.distance - a.distance || 1);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, tx: 0, tz: 1, nx: 1, nz: 0, curvature: 0 };
  });
  points.forEach((p, i) => {
    const a = points[wrap(i - 2, count)], b = points[(i + 2) % count];
    const size = Math.hypot(b.x - a.x, b.z - a.z);
    p.tx = (b.x - a.x) / size; p.tz = (b.z - a.z) / size;
    p.nx = p.tz; p.nz = -p.tx;
  });
  points.forEach((p, i) => {
    const a = points[wrap(i - 3, count)], b = points[(i + 3) % count];
    const angle = Math.atan2(b.tx, b.tz) - Math.atan2(a.tx, a.tz);
    p.curvature = Math.atan2(Math.sin(angle), Math.cos(angle)) / (6 * length / count);
  });
  return {
    id, points, length, width: TRACK_INFO[id].width, pads: [.15, .47, .79].map(t => t * length),
    sample(distance, offset = 0) {
      const v = wrap(distance, length) / length * count;
      const a = points[Math.floor(v)], b = points[(Math.floor(v) + 1) % count], t = v % 1;
      const tx = a.tx + (b.tx - a.tx) * t, tz = a.tz + (b.tz - a.tz) * t;
      const size = Math.hypot(tx, tz);
      return { x: a.x + (b.x - a.x) * t + tz / size * offset, z: a.z + (b.z - a.z) * t - tx / size * offset,
        tx: tx / size, tz: tz / size, nx: tz / size, nz: -tx / size, curvature: a.curvature + (b.curvature - a.curvature) * t };
    },
  };
}

export interface Racer {
  id: number; name: string; color: string; distance: number; offset: number; speed: number; lateral: number;
  yaw: number; drifting: boolean; driftTime: number; driftCharge: number; charge: number; tanks: number;
  boostTime: number; miniTime: number; collisionTime: number; padCooldown: number; finishedAt: number | null;
  lap: number; lapStart: number; lapTimes: number[]; targetLane: number; aiDecision: number;
}
const AI_NAMES = ['晚风', '小橘', '白夜', '星野', '汽水', '山雀', '青柠'];
const AI_COLORS = ['#329ccf', '#edaa37', '#9975d1', '#f5f3e8', '#45bfa1', '#ea7358', '#a9bd46'];
export class Race {
  config: RaceConfig;
  track: Track;
  racers: Racer[] = [];
  phase: Phase = 'garage';
  resumePhase: 'countdown' | 'racing' = 'racing';
  countdown = 3.5;
  time = 0;
  message = '';
  messageTime = 0;
  totalDrift = 0;
  boostsUsed = 0;
  topSpeed = 0;
  recoveryTime = 0;
  private accumulator = 0;
  private boostHeld = false;
  constructor(config: RaceConfig) {
    this.config = { ...config };
    this.track = makeTrack(config.track);
    this.reset();
  }
  get player() { return this.racers[0]; }
  get order() {
    return [...this.racers].sort((a, b) => {
      if (a.finishedAt !== null || b.finishedAt !== null) return (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity);
      return b.distance - a.distance;
    });
  }
  get place() { return this.order.findIndex(r => r.id === 0) + 1; }
  reset() {
    this.phase = 'garage'; this.time = 0; this.countdown = 3.5; this.accumulator = 0;
    this.totalDrift = 0; this.boostsUsed = 0; this.topSpeed = 0; this.recoveryTime = 0; this.message = ''; this.messageTime = 0; this.boostHeld = false;
    this.racers = Array.from({ length: this.config.mode === 'race' ? 8 : 1 }, (_, i) => {
      // All racers must cross the start line before completing a full lap.
      const grid = i === 0 ? 6 : i <= 6 ? i - 1 : 7;
      return { id: i, name: i === 0 ? '你' : AI_NAMES[i - 1], color: i === 0 ? CARS[this.config.car].color : AI_COLORS[i - 1],
        distance: -12 - Math.floor(grid / 2) * 9, offset: (grid % 2 === 0 ? -1 : 1) * 4,
        speed: 0, lateral: 0, yaw: 0, drifting: false, driftTime: 0, driftCharge: 0, charge: 0, tanks: 1,
        boostTime: 0, miniTime: 0, collisionTime: 0, padCooldown: 0, finishedAt: null, lap: 0, lapStart: 0, lapTimes: [],
        targetLane: (grid % 2 === 0 ? -1 : 1) * 4, aiDecision: i * .16 };
    });
  }
  start() { this.reset(); this.phase = 'countdown'; }
  pause() {
    if (this.phase === 'countdown' || this.phase === 'racing') { this.resumePhase = this.phase; this.phase = 'paused'; }
  }
  resume() { if (this.phase === 'paused') this.phase = this.resumePhase; }
  notify(text: string) { this.message = text; this.messageTime = 1.8; }
  recover() {
    if (this.phase !== 'racing') return;
    this.player.offset = 0; this.player.lateral = 0; this.player.speed = 0;
    this.player.drifting = false; this.player.driftTime = 0; this.player.driftCharge = 0;
    this.player.boostTime = 0; this.player.miniTime = 0;
    this.recoveryTime = 2; this.notify('已回到赛道 · 等待 2 秒');
  }
  update(dt: number, input: Input) {
    if (this.phase === 'garage' || this.phase === 'paused' || this.phase === 'finished') return;
    // Fixed steps prevent tunneling, and preserve the same handling on 30/60/120 Hz displays.
    this.accumulator += clamp(dt, 0, .1);
    while (this.accumulator >= 1 / 120) { this.step(1 / 120, input); this.accumulator -= 1 / 120; }
  }
  private step(dt: number, input: Input) {
    if (this.phase === 'finished') return;
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.phase = 'racing'; this.notify('出发！'); }
      return;
    }
    this.time += dt; this.messageTime = Math.max(0, this.messageTime - dt);
    const p = this.player, car = CARS[this.config.car];
    const boostPressed = input.boost && !this.boostHeld;
    this.boostHeld = input.boost;
    if (boostPressed && p.tanks > 0 && p.boostTime <= 0 && p.speed > 8) {
      p.tanks--; p.boostTime = 2.7 * car.boost; this.boostsUsed++; this.notify('氮气加速');
    }
    for (const r of this.racers) {
      if (r.finishedAt !== null) continue;
      if (r.id === 0 && this.recoveryTime > 0) { this.recoveryTime = Math.max(0, this.recoveryTime - dt); continue; }
      r.collisionTime = Math.max(0, r.collisionTime - dt);
      r.padCooldown = Math.max(0, r.padCooldown - dt);
      r.boostTime = Math.max(0, r.boostTime - dt); r.miniTime = Math.max(0, r.miniTime - dt);
      const road = this.track.sample(r.distance + 8);
      let steer = input.steer, brake = input.brake, accelerate = input.accelerate || this.config.autoAccelerate;
      let drift = input.drift && Math.abs(steer) > .1 && r.speed > 16;
      let limit = car.maxSpeed, acceleration = car.acceleration, handling = car.handling;
      if (r.id > 0) {
        const skill = [.79, .94, 1.065][this.config.difficulty];
        const curve = Math.max(Math.abs(road.curvature), Math.abs(this.track.sample(r.distance + 45).curvature));
        limit = (58 + r.id * .9) * skill * clamp(1 - curve * 10, .66, 1);
        acceleration = 19 + r.id % 3 * 2; handling = 1;
        // Bounded catch-up changes speed, never position or lap progress.
        limit += clamp((p.distance - r.distance) * .007, -2, 3);
        r.aiDecision -= dt;
        if (r.aiDecision <= 0) {
          r.aiDecision = .35 + (r.id % 3) * .1;
          const lanes = [-8, -4, 0, 4, 8];
          let best = Infinity;
          for (const lane of lanes) {
            let cost = Math.abs(lane - r.offset) * .2 + Math.abs(lane - Math.sign(road.curvature) * 3) * .09;
            for (const other of this.racers) {
              if (other === r || other.finishedAt !== null) continue;
              const gap = wrap(other.distance - r.distance + this.track.length / 2, this.track.length) - this.track.length / 2;
              if (gap > -7 && gap < 38) cost += Math.max(0, 5 - Math.abs(other.offset - lane)) * (gap < 15 ? 3 : 1);
            }
            if (cost < best) { best = cost; r.targetLane = lane; }
          }
          if (r.tanks > 0 && r.boostTime <= 0 && curve < .007 && r.speed > 30) { r.tanks--; r.boostTime = 2.3; }
        }
        steer = clamp((r.targetLane - r.offset) * .12 + road.curvature * r.speed * .8, -.7, .7);
        accelerate = true; brake = false; drift = curve > .007 && r.speed > 26;
      }
      const boosted = r.boostTime > 0 || r.miniTime > 0;
      const cap = limit + (r.boostTime > 0 ? 23 : r.miniTime > 0 ? 12 : 0);
      if (brake) r.speed -= 44 * dt;
      else if (accelerate) { if (r.speed < cap) r.speed = Math.min(cap, r.speed + acceleration * (boosted ? 1.75 : 1) * dt); }
      else r.speed -= 10 * dt;
      if (r.speed > cap) r.speed = Math.max(cap, r.speed - 18 * dt);
      r.speed = clamp(r.speed, 0, 94);
      if (drift) {
        r.driftTime += dt;
        // Steer + speed are required: holding Shift while parked cannot generate nitro.
        const charge = dt * (24 + Math.abs(steer) * 12);
        r.driftCharge += charge; this.addCharge(r, charge);
        r.speed = Math.max(0, r.speed - dt * 4);
        if (r.id === 0) this.totalDrift += dt;
      } else if (r.drifting) {
        if (r.driftTime > .48 && r.driftCharge > 12) {
          r.miniTime = r.driftTime > 1.35 ? 1.05 : .62;
          if (r.id === 0) this.notify(r.driftTime > 1.35 ? '完美漂移 · 强力小喷' : '漂移小喷');
        }
        r.driftTime = 0; r.driftCharge = 0;
      }
      r.drifting = drift;
      const lateralTarget = steer * r.speed * (drift ? .37 : .25) * handling - road.curvature * r.speed * r.speed * .22;
      r.lateral += (lateralTarget - r.lateral) * Math.min(1, dt * (drift ? 3.7 : 9));
      r.offset += r.lateral * dt;
      r.yaw += ((steer * (drift ? .58 : .19) - r.lateral * .005) - r.yaw) * dt * 8;
      const edge = this.track.width / 2 - 1.3;
      if (Math.abs(r.offset) > edge) {
        r.offset = clamp(r.offset, -edge, edge);
        r.lateral *= -.22;
        if (r.collisionTime <= 0) {
          r.speed *= .72; r.collisionTime = .7;
          if (r.id === 0) this.notify('擦碰护栏');
        }
      } else if (Math.abs(r.offset) > edge - 1) r.speed = Math.max(0, r.speed - 12 * dt);
      const before = r.distance;
      r.distance += r.speed * dt;
      for (const pad of this.track.pads) {
        const d = wrap(r.distance - pad, this.track.length);
        if (d < 10 && Math.abs(r.offset) < 6 && r.padCooldown <= 0) {
          r.miniTime = 1.25; r.padCooldown = 2; this.addCharge(r, 24);
          if (r.id === 0) this.notify('加速带 · 集气 +24');
        }
      }
      const oldLap = Math.floor(before / this.track.length), newLap = Math.floor(r.distance / this.track.length);
      if (newLap > oldLap) {
        if (oldLap >= 0) {
          r.lapTimes.push(this.time - r.lapStart);
          if (r.id === 0) this.notify(newLap === this.config.laps - 1 ? '最后一圈！' : `第 ${newLap + 1} 圈`);
        }
        r.lap = newLap;
        if (oldLap >= 0) r.lapStart = this.time;
        if (newLap >= this.config.laps && this.config.mode !== 'practice') {
          r.finishedAt = this.time;
        }
      }
    }
    // Resolve each pair once; wrapped distance also catches contact across the finish line.
    for (let i = 0; i < this.racers.length; i++) for (let j = i + 1; j < this.racers.length; j++) {
      const a = this.racers[i], b = this.racers[j];
      if (a.finishedAt !== null || b.finishedAt !== null) continue;
      const gap = wrap(b.distance - a.distance + this.track.length / 2, this.track.length) - this.track.length / 2;
      if (Math.abs(gap) < 4.2 && Math.abs(a.offset - b.offset) < 2.5) {
        const rear = gap > 0 ? a : b, front = gap > 0 ? b : a;
        const impact = a.collisionTime <= 0 && b.collisionTime <= 0;
        if (impact) { rear.speed = Math.min(rear.speed, front.speed * .86); front.speed *= .98; }
        const direction = a.offset >= b.offset ? 1 : -1;
        const edge = this.track.width / 2 - 1.3;
        const separation = (2.55 - Math.abs(a.offset - b.offset)) / 2;
        a.offset = clamp(a.offset + direction * separation, -edge, edge);
        b.offset = clamp(b.offset - direction * separation, -edge, edge);
        if (Math.abs(a.offset - b.offset) < 2.5) {
          if (Math.abs(a.offset) > Math.abs(b.offset)) b.offset = a.offset - direction * 2.55;
          else a.offset = b.offset + direction * 2.55;
        }
        if (impact) { a.collisionTime = b.collisionTime = .65; if (i === 0) this.notify('发生碰撞 · 调整路线'); }
      }
    }
    this.topSpeed = Math.max(this.topSpeed, p.speed * 3.6);
    if (p.finishedAt !== null) { this.phase = 'finished'; this.notify('冲线！'); }
  }
  private addCharge(r: Racer, amount: number) {
    if (r.tanks >= 2) return;
    r.charge += amount;
    if (r.charge >= 100) { r.charge -= 100; r.tanks++; if (r.id === 0) this.notify('氮气已就绪'); }
  }
}

// ==== END race-model ====

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
export function verifyReplay(config: BoardConfig, events: unknown): Promise<{ time: number; place: number } | null> {
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
  } catch {
    return json(res, 503, { error: '排行榜暂时连接不上，请稍后重试。' });
  }
}
