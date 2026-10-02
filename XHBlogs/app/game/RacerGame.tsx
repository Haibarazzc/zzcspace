"use client";

// 伪 3D 公路赛车小游戏：Canvas 2D 手绘，零依赖零素材。
// 操作：← → 转向，↑ 油门，↓/空格 刹车；手机按住屏幕左右半边转向（自动油门）。
// 无失败状态，拼最长距离，最好成绩存 localStorage。

import { useEffect, useRef, useState } from 'react';

const W = 800, H = 500;              // 逻辑分辨率
const SEG_LEN = 200;                  // 单段长度
const ROAD_W = 2200;                  // 路半宽（世界坐标）
const DRAW_DIST = 70;                 // 绘制段数
const CAM_H = 1000;                   // 相机高度
const FOV = 100;
const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
const MAX_SPEED = SEG_LEN * 60 * 0.9; // 段/秒 * 60fps * 系数
const ACCEL = MAX_SPEED / 4.5;
const BRAKE = -MAX_SPEED / 1.5;
const DECEL = -MAX_SPEED / 6;
const OFFROAD_DECEL = -MAX_SPEED / 2.2;
const CENTRIFUGAL = 0.32;

interface Seg { curve: number; trees: number[] } // trees: 路侧树的世界 x 偏移（倍数）
interface Car { z: number; x: number; speed: number; color: string }

function buildTrack(): Seg[] {
  const segs: Seg[] = [];
  const push = (n: number, curve: number, treeChance = 0.35) => {
    for (let i = 0; i < n; i++) {
      const trees: number[] = [];
      if (Math.random() < treeChance) trees.push(1.6 + Math.random() * 2.4); // 右侧
      if (Math.random() < treeChance) trees.push(-(1.6 + Math.random() * 2.4)); // 左侧
      segs.push({ curve, trees });
    }
  };
  push(60, 0);
  push(60, 3); push(40, 0); push(60, -4); push(50, 0);
  push(80, 5, 0.5); push(40, 0, 0.15); push(70, -5, 0.5); push(60, 0);
  push(50, 2); push(50, -2); push(30, 0, 0.1); push(90, 6, 0.6);
  push(40, 0); push(60, -3); push(40, 3); push(60, 0);
  return segs;
}

const CAR_COLORS = ['#64748b', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#0ea5e9'];

export default function RacerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef<Record<string, boolean>>({});
  const touch = useRef({ left: false, right: false });
  const [best, setBest] = useState(0);
  const [state, setState] = useState<'ready' | 'playing'>('ready');
  const stateRef = useRef<'ready' | 'playing'>('ready');
  stateRef.current = state;

  useEffect(() => { setBest(Number(localStorage.getItem('racer-best') || 0)); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;

    const track = buildTrack();
    const N = track.length;
    const cars: Car[] = Array.from({ length: 22 }, () => ({
      z: Math.floor(Math.random() * N) * SEG_LEN,
      x: (Math.random() * 1.7 - 0.85),
      speed: MAX_SPEED * (0.28 + Math.random() * 0.3),
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    }));

    let pos = 0;            // 相机沿路位置
    let playerX = 0;        // -1..1
    let speed = 0;
    let dist = 0;           // 累计米数
    let shake = 0;
    let petals: Array<{ x: number; y: number; s: number; v: number; drift: number }> = [];
    const initPetals = () => { petals = Array.from({ length: 26 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 2 + Math.random() * 3, v: 0.4 + Math.random() * 1.2, drift: Math.random() * 2 * Math.PI })); };
    initPetals();
    let raf = 0;
    let last = performance.now();
    let hud = { kmh: 0, dist: 0, best: 0 };
    let milestone = 0; // 上次闪过的公里数

    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (stateRef.current === 'ready' && (e.key === ' ' || e.key === 'Enter')) start();
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.key] = false; };
    const start = () => { setState('playing'); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const segmentAt = (z: number) => track[Math.floor(z / SEG_LEN) % N];

    let elapsed = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      const playing = stateRef.current === 'playing';

      // ---- 更新 ----
      if (playing) {
        const left = keys.current['ArrowLeft'] || keys.current['a'] || keys.current['A'] || touch.current.left;
        const right = keys.current['ArrowRight'] || keys.current['d'] || keys.current['D'] || touch.current.right;
        const up = keys.current['ArrowUp'] || keys.current['w'] || keys.current['W'] || 'ontouchstart' in window;
        const down = keys.current['ArrowDown'] || keys.current['s'] || keys.current['S'] || keys.current[' '];

        const seg = segmentAt(pos + CAM_H); // 当前路段曲率
        speed += (up ? ACCEL : 0) * dt;
        speed += (down ? BRAKE : 0) * dt;
        if (!up && !down) speed += DECEL * dt;
        const offroad = Math.abs(playerX) > 1;
        if (offroad && speed > MAX_SPEED * 0.35) { speed += OFFROAD_DECEL * dt; shake = Math.min(8, shake + 30 * dt); }
        speed = Math.max(0, Math.min(speed, MAX_SPEED));

        const dx = dt * 2.4 * (speed / MAX_SPEED);
        if (left) playerX -= dx;
        if (right) playerX += dx;
        playerX -= dx * (speed / MAX_SPEED) * seg.curve * CENTRIFUGAL;
        playerX = Math.max(-2.2, Math.min(2.2, playerX));

        pos += speed * dt;
        dist += (speed * dt) / 22; // 世界单位换算成"米"的观感值

        // 与 NPC 车碰撞
        for (const car of cars) {
          car.z += car.speed * dt;
          if (car.z >= N * SEG_LEN) car.z -= N * SEG_LEN;
          const rel = ((car.z - pos) + N * SEG_LEN) % N * SEG_LEN;
          if (rel < SEG_LEN * 1.2 || rel > N * SEG_LEN - SEG_LEN) {
            if (Math.abs(car.x - playerX) < 0.62 && rel < SEG_LEN * 1.2 && speed > car.speed) {
              speed = car.speed * 0.55;
              shake = 10;
            }
          }
        }

        // 里程碑 & 最好成绩
        const km = Math.floor(dist / 1000);
        if (km > milestone) { milestone = km; shake = Math.max(shake, 4); }
        if (dist > hud.best) {
          hud.best = dist;
          localStorage.setItem('racer-best', String(Math.floor(dist)));
        }
      }
      shake = Math.max(0, shake - 24 * dt);
      hud.kmh = Math.round((speed / MAX_SPEED) * 188);
      hud.dist = dist;

      // ---- 绘制 ----
      const sx = (Math.random() - 0.5) * shake;
      const sy = (Math.random() - 0.5) * shake;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);

      // 天空 + 远山
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      sky.addColorStop(0, '#c7d2fe'); sky.addColorStop(1, '#fdf2f8');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      const horizon = H * 0.42;
      ctx.fillStyle = 'rgba(139,92,246,0.18)';
      ctx.beginPath(); ctx.moveTo(0, horizon);
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, horizon - 46 - 30 * Math.sin(x * 0.011) - 18 * Math.sin(x * 0.031 + 2));
      ctx.lineTo(W, horizon); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(99,102,241,0.14)';
      ctx.beginPath(); ctx.moveTo(0, horizon);
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, horizon - 22 - 20 * Math.sin(x * 0.017 + 1));
      ctx.lineTo(W, horizon); ctx.closePath(); ctx.fill();

      // 路面：从近到远逐段投影
      const camX = playerX * ROAD_W;
      let x = 0, dxCurve = -(segmentAt(pos).curve * ((pos % SEG_LEN) / SEG_LEN));
      const baseSeg = Math.floor(pos / SEG_LEN);
      const maxY = H;
      let drawn: Array<{ seg: number; scale: number; roadX: number; roadW: number; y: number }> = [];
      for (let n = 0; n < DRAW_DIST; n++) {
        const i = (baseSeg + n) % N;
        // 近裁剪保护：第一段过近会导致投影爆炸闪烁
        const segZ = Math.max(SEG_LEN * 0.3, n * SEG_LEN - (pos % SEG_LEN));
        const scale = CAM_DEPTH / (segZ + CAM_DEPTH * 0 + 0.0001);
        // 经典透视：每段 curve 累积进 x
        x += dxCurve; dxCurve += track[i].curve;
        const worldX = x * ROAD_W;
        const pScale = CAM_DEPTH / (segZ + CAM_DEPTH);
        const screenY = horizon + (CAM_H / (segZ + CAM_DEPTH)) * H * 0.5;
        const screenW = (ROAD_W / (segZ + CAM_DEPTH)) * (W / 2) * CAM_DEPTH / 24;
        const screenX = W / 2 + (worldX / (segZ + CAM_DEPTH)) * (W / 2) * CAM_DEPTH / 24 - camX * 0;
        if (screenY >= maxY) continue;
        drawn.push({ seg: i, scale: pScale, roadX: screenX - camX / (segZ + CAM_DEPTH) * 8, roadW: screenW, y: screenY });
      }
      // 远处先画（数组后面是远的）：倒序画草和路
      for (let n = drawn.length - 1; n >= 0; n--) {
        const d = drawn[n];
        const next = drawn[n + 1] || { y: H, roadX: d.roadX, roadW: d.roadW * 1.18 };
        const alt = Math.floor(d.seg / 3) % 2 === 0;
        // 草地
        ctx.fillStyle = alt ? '#a7d8a0' : '#9ccf96';
        ctx.fillRect(0, d.y, W, Math.max(1, next.y - d.y + 1));
        // 路肩
        const rumbleW = d.roadW * 1.15;
        ctx.fillStyle = alt ? '#e2e8f0' : '#f472b6';
        quad(ctx, d.roadX - rumbleW, d.y, d.roadX + rumbleW, d.y, next.roadX + next.roadW * 1.15, next.y, next.roadX - next.roadW * 1.15, next.y);
        // 路面
        ctx.fillStyle = alt ? '#8f9bb3' : '#8893ab';
        quad(ctx, d.roadX - d.roadW, d.y, d.roadX + d.roadW, d.y, next.roadX + next.roadW, next.y, next.roadX - next.roadW, next.y);
        // 中线
        if (alt) {
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          quad(ctx, d.roadX - d.roadW * 0.02, d.y, d.roadX + d.roadW * 0.02, d.y, next.roadX + next.roadW * 0.02, next.y, next.roadX - next.roadW * 0.02, next.y);
          const lane = d.roadW * 0.5;
          for (const off of [-lane, lane]) {
            quad(ctx, d.roadX + off - d.roadW * 0.012, d.y, d.roadX + off + d.roadW * 0.012, d.y,
              next.roadX + off + next.roadW * 0.012, next.y, next.roadX + off - next.roadW * 0.012, next.y);
          }
        }
      }

      // 树（樱花树，随段绘制）
      for (let n = drawn.length - 1; n >= 0; n--) {
        const d = drawn[n];
        for (const tx of track[d.seg].trees) {
          const px = d.roadX + tx * d.roadW;
          const h = Math.max(4, d.roadW * 0.5);
          drawTree(ctx, px, d.y, h);
        }
      }
      // NPC 车
      for (const car of cars) {
        let rel = car.z - (baseSeg * SEG_LEN);
        if (rel < -SEG_LEN * 2 || rel > DRAW_DIST * SEG_LEN) continue;
        for (let n = 1; n < drawn.length; n++) {
          if (drawn[n].seg === Math.floor(car.z / SEG_LEN) % N) {
            const d = drawn[n];
            const px = d.roadX + car.x * d.roadW;
            drawCar(ctx, px, d.y, Math.max(6, d.roadW * 0.34), car.color, false);
            break;
          }
        }
      }

      // 玩家车（底部居中，随转向偏移）
      const steer = ((keys.current['ArrowLeft'] || keys.current['a'] || touch.current.left) ? -1 : 0) +
        ((keys.current['ArrowRight'] || keys.current['d'] || touch.current.right) ? 1 : 0);
      drawCar(ctx, W / 2 + steer * 6, H - 56, 78, '#6366f1', true, steer);

      // 花瓣
      for (const p of petals) {
        p.y += p.v * (1 + speed / MAX_SPEED * 5) * dt * 60 * 0.12;
        p.x += Math.sin(elapsed * 1.5 + p.drift) * 0.6;
        if (p.y > H) { p.y = -6; p.x = Math.random() * W; }
        ctx.fillStyle = 'rgba(244,114,182,0.75)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s, p.s * 0.6, p.drift, 0, Math.PI * 2); ctx.fill();
      }

      // HUD
      ctx.fillStyle = 'rgba(15,23,42,0.55)';
      roundRect(ctx, 14, 14, 170, 64, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 26px ui-monospace,monospace'; ctx.textAlign = 'left';
      ctx.fillText(String(hud.kmh).padStart(3, ' ') + ' km/h', 26, 42);
      ctx.font = '700 14px ui-monospace,monospace'; ctx.fillStyle = '#c7d2fe';
      ctx.fillText((hud.dist / 1000).toFixed(2) + ' km  ·  最长 ' + (hud.best / 1000).toFixed(2) + ' km', 26, 68);

      ctx.restore();
      // 暴露调试状态（自动化验证用）
      (window as any).__racer = { speed, dist, playing };
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // 触摸转向
    const onTouch = (e: TouchEvent) => {
      touch.current.left = false; touch.current.right = false;
      for (const t of Array.from(e.touches)) {
        if (t.clientX < window.innerWidth / 2) touch.current.left = true;
        else touch.current.right = true;
      }
    };
    const onTouchEnd = () => { touch.current.left = false; touch.current.right = false; };
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const begin = () => setState('playing');

  return (
    <div className="relative w-full max-w-4xl mx-auto select-none">
      <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl">
        <canvas ref={canvasRef} className="block w-full h-auto" style={{ aspectRatio: `${W} / ${H}` }} />
        {state === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/45 backdrop-blur-sm text-center px-6">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow">樱花公路</h2>
            <p className="mt-3 text-sm font-bold text-indigo-100 leading-relaxed">
              ← → 转向 · ↑ 油门 · ↓ / 空格 刹车<br />
              <span className="text-indigo-200">手机：按住屏幕左右半边转向（自动油门）</span>
            </p>
            <button onClick={begin} className="mt-6 px-10 py-3 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-black shadow-lg shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95">
              出发
            </button>
            {best > 0 && <p className="mt-4 text-xs font-black text-indigo-200">历史最长 {(best / 1000).toFixed(2)} km</p>}
          </div>
        )}
        {state === 'playing' && (
          <button onClick={() => setState('ready')} className="absolute top-3 right-3 px-4 py-1.5 rounded-full bg-slate-900/50 hover:bg-slate-900/70 text-white text-xs font-black backdrop-blur transition-colors">
            重来
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
        没有终点，只有最长的那一程 · 撞车会掉速，出路会颠簸 · 数据只存在本机
      </p>
    </div>
  );
}

function quad(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(x - h * 0.06, y - h * 0.5, h * 0.12, h * 0.5);
  const r = h * 0.32;
  ctx.fillStyle = '#f9a8d4';
  ctx.beginPath(); ctx.arc(x, y - h * 0.72, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbcfe8';
  ctx.beginPath(); ctx.arc(x - r * 0.5, y - h * 0.85, r * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.55, y - h * 0.62, r * 0.5, 0, Math.PI * 2); ctx.fill();
}

function drawCar(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, color: string, isPlayer: boolean, steer = 0) {
  const h = w * 0.62;
  ctx.save();
  ctx.translate(cx, cy);
  if (steer) ctx.rotate(steer * 0.05);
  // 阴影
  ctx.fillStyle = 'rgba(15,23,42,0.25)';
  ctx.beginPath(); ctx.ellipse(0, h * 0.48, w * 0.55, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  // 轮子
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-w * 0.5, -h * 0.42, w * 0.16, h * 0.5);
  ctx.fillRect(w * 0.34, -h * 0.42, w * 0.16, h * 0.5);
  // 车身
  ctx.fillStyle = color;
  roundRect(ctx, -w * 0.44, -h * 0.5, w * 0.88, h, w * 0.14); ctx.fill();
  // 车顶
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(ctx, -w * 0.3, -h * 0.38, w * 0.6, h * 0.42, w * 0.1); ctx.fill();
  if (isPlayer) {
    // 尾灯
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-w * 0.4, h * 0.28, w * 0.14, h * 0.14);
    ctx.fillRect(w * 0.26, h * 0.28, w * 0.14, h * 0.14);
    // 小尾翼
    ctx.fillStyle = 'rgba(15,23,42,0.8)';
    ctx.fillRect(-w * 0.4, h * 0.42, w * 0.8, h * 0.1);
  }
  ctx.restore();
}
