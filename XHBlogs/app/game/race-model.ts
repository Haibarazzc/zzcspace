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
