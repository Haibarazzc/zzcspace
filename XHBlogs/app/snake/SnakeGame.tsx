"use client";

// 20×20 经典贪吃蛇：确定性引擎见 lib/snake-engine.ts，
// 渲染与交互在此。键盘（方向键/WASD）+ 触屏（滑动或方向盘）。

import { useCallback, useEffect, useRef, useState } from 'react';
import { BOARD_SIZE, createGame, stepGame, tickDuration, canTurn, type Direction, type SnakeState } from '@/lib/snake-engine';

interface BoardEntry { name: string; score: number; date: string; rank?: number }
type Phase = 'ready' | 'playing' | 'paused' | 'over';

function loadPlayerId() {
  try {
    let id = localStorage.getItem('snake-player-id');
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) { id = crypto.randomUUID(); localStorage.setItem('snake-player-id', id); }
    return id;
  } catch { return crypto.randomUUID(); }
}

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnakeState>(createGame(1));
  const phaseRef = useRef<Phase>('ready');
  const pendingDir = useRef<Direction | undefined>(undefined);
  const sessionRef = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [reason, setReason] = useState('');
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [boardPeriod, setBoardPeriod] = useState<'all' | 'today'>('all');
  const [boardNote, setBoardNote] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [submitState, setSubmitState] = useState<'hidden' | 'idle' | 'busy' | 'done' | 'error'>('hidden');
  const [submitNote, setSubmitNote] = useState('');

  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  const fetchBoard = useCallback((period: 'all' | 'today') => {
    setBoardNote('');
    fetch('/api/snake?period=' + period)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setBoard(d.entries || []))
      .catch(() => { setBoard([]); setBoardNote('排行榜暂时拿不到'); });
  }, []);

  useEffect(() => {
    setBest(Number(localStorage.getItem('snake-best') || 0));
    try { setPlayerName(localStorage.getItem('snake-name') || ''); } catch { /* 可选 */ }
    fetchBoard('all');
  }, [fetchBoard]);

  useEffect(() => { fetchBoard(boardPeriod); }, [boardPeriod, fetchBoard]);

  const begin = () => {
    gameRef.current = createGame(Math.floor(Math.random() * 0xffffffff) || 1);
    pendingDir.current = undefined;
    setScore(0); setReason(''); setSubmitState('hidden'); setSubmitNote('');
    sessionRef.current = null;
    setPhaseBoth('playing');
    fetch('/api/snake', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', playerId: loadPlayerId() }) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { sessionRef.current = String(d.sessionId || '') || null; })
      .catch(() => { sessionRef.current = null; });
  };

  // 主循环：固定节奏 tick，随分数加速
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const metrics = { size: canvas.clientWidth || 420, cell: 0 };
    const resize = () => {
      metrics.size = canvas.clientWidth || metrics.size;
      metrics.cell = metrics.size / BOARD_SIZE;
      canvas.width = metrics.size * dpr;
      canvas.height = metrics.size * dpr;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let raf = 0, last = performance.now(), acc = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (phaseRef.current === 'playing') {
        const game = gameRef.current;
        acc += dt * 1000;
        const interval = tickDuration(game.score);
        while (acc >= interval && phaseRef.current === 'playing') {
          acc -= interval;
          gameRef.current = stepGame(gameRef.current, pendingDir.current);
          pendingDir.current = undefined;
          if (gameRef.current.over) {
            setScore(gameRef.current.score);
            setReason({ wall: '撞到边界了', self: '咬到自己了', filled: '棋盘被你填满了！', limit: '到达回合上限' }[gameRef.current.reason ?? 'wall']);
            const newBest = Math.max(best, gameRef.current.score);
            if (gameRef.current.score > best) { try { localStorage.setItem('snake-best', String(newBest)); } catch { /* 可选 */ } setBest(newBest); }
            setSubmitState(sessionRef.current && gameRef.current.score >= 10 ? 'idle' : 'hidden');
            setSubmitNote(sessionRef.current ? '' : (gameRef.current.score >= 10 ? '本局缺少有效会话，无法上榜' : ''));
            setPhaseBoth('over');
          }
        }
        setScore(gameRef.current.score);
      } else acc = 0;

      // ---- 绘制 ----
      const size = metrics.size, cell = metrics.cell;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, size, size);
      bg.addColorStop(0, '#1e293b'); bg.addColorStop(1, '#0f172a');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(148,163,184,0.07)'; ctx.lineWidth = 1;
      for (let i = 1; i < BOARD_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke();
      }
      const game = gameRef.current;
      // 食物：粉色呼吸圆
      if (game.food) {
        const pulse = 0.8 + Math.sin(now / 180) * 0.12;
        ctx.fillStyle = '#f472b6';
        ctx.beginPath(); ctx.arc((game.food.x + .5) * cell, (game.food.y + .5) * cell, cell * .34 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(244,114,182,0.25)';
        ctx.beginPath(); ctx.arc((game.food.x + .5) * cell, (game.food.y + .5) * cell, cell * .55 * pulse, 0, Math.PI * 2); ctx.fill();
      }
      // 蛇：渐变圆角方块，蛇头亮色
      game.body.forEach((p, i) => {
        const t = i / Math.max(1, game.body.length - 1);
        ctx.fillStyle = i === 0 ? '#a5b4fc' : `rgb(${Math.round(99 + t * 40)}, ${Math.round(102 - t * 30)}, ${Math.round(241 - t * 60)})`;
        const pad = cell * 0.08;
        const r = cell * 0.3;
        const x = p.x * cell + pad, y = p.y * cell + pad, w = cell - pad * 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + w, r); ctx.arcTo(x + w, y + w, x, y + w, r);
        ctx.arcTo(x, y + w, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [best]);

  // 键盘：转向 / 暂停 / 开始
  useEffect(() => {
    const KEYS: Record<string, Direction> = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const dir = KEYS[e.code] ?? KEYS[e.key as string];
      if (dir !== undefined) {
        e.preventDefault();
        if (phaseRef.current === 'playing' && canTurn(gameRef.current.direction, dir)) pendingDir.current = dir;
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (phaseRef.current === 'playing') setPhaseBoth('paused');
        else if (phaseRef.current === 'paused') setPhaseBoth('playing');
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        if (phaseRef.current === 'ready' || phaseRef.current === 'over') { e.preventDefault(); begin(); }
      }
    };
    window.addEventListener('keydown', onKey);
    const onBlur = () => { if (phaseRef.current === 'playing') setPhaseBoth('paused'); };
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('blur', onBlur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 触屏滑动
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touchStart.current;
    if (!s || phaseRef.current !== 'playing') return;
    const t = e.touches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    const dir: Direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    if (canTurn(gameRef.current.direction, dir)) pendingDir.current = dir;
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const submitScore = async () => {
    if (!sessionRef.current || submitState === 'busy' || submitState === 'done') return;
    const name = playerName.trim();
    if (!name || [...name].length > 12) { setSubmitState('error'); setSubmitNote('昵称请填 1～12 个字符'); return; }
    setSubmitState('busy'); setSubmitNote('提交中…');
    try {
      const res = await fetch('/api/snake', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finish', sessionId: sessionRef.current, name, score }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      try { localStorage.setItem('snake-name', name); } catch { /* 可选 */ }
      setSubmitState('done');
      setSubmitNote(data.rank ? `已上榜 · 当前第 ${data.rank} 名` : '已上榜');
      fetchBoard(boardPeriod);
    } catch (err) {
      setSubmitState('error'); setSubmitNote(err instanceof Error ? err.message : '提交失败');
    }
  };

  const speedLevel = Math.min(8, Math.floor(score / 50) + 1);
  const dpad = (label: string, dir: Direction, cls: string) => (
    <button aria-label={'转向' + label} onClick={() => { if (phaseRef.current === 'playing' && canTurn(gameRef.current.direction, dir)) pendingDir.current = dir; }}
      className={`w-14 h-14 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-white/50 dark:border-slate-600/60 text-slate-600 dark:text-slate-200 font-black text-xl shadow-sm active:scale-90 transition-transform ${cls}`}>{label}</button>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,620px)_minmax(0,1fr)] gap-5 items-start justify-center">
      <div className="relative mx-auto w-full max-w-[620px]">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex gap-2 text-xs md:text-sm font-black">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">分数 {score}</span>
            <span className="px-3 py-1 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">长度 {gameRef.current.body.length}</span>
            <span className="px-3 py-1 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20">速度 {speedLevel}</span>
          </div>
          <span className="text-[11px] font-black text-slate-400">最高 {best}</span>
        </div>
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl">
          <canvas ref={canvasRef} className="block w-full h-auto touch-none" style={{ aspectRatio: '1 / 1' }}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} />
          {phase === 'ready' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/55 backdrop-blur-[2px] text-center px-6">
              <h2 className="text-2xl md:text-3xl font-black text-white">来一局？</h2>
              <p className="mt-2 text-xs font-bold text-indigo-100 leading-relaxed">方向键 / WASD 转向 · P 暂停<br />手机：滑动画面或用下面的方向盘</p>
              <button onClick={begin} className="mt-5 px-9 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-black shadow-lg shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95">开始</button>
            </div>
          )}
          {phase === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/55 backdrop-blur-[2px] text-center">
              <h2 className="text-xl font-black text-white">已暂停</h2>
              <button onClick={() => setPhaseBoth('playing')} className="mt-4 px-8 py-2 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-black shadow-lg transition-all hover:scale-105">继续</button>
            </div>
          )}
          {phase === 'over' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/65 backdrop-blur-[2px] text-center px-6">
              <h2 className="text-2xl font-black text-white">{reason}</h2>
              <p className="mt-2 text-sm font-black text-indigo-100">
                本局 {score} 分{score >= best && score > 0 ? ' · 新纪录！' : ` · 最高 ${best}`}
              </p>
              {score >= 10 && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  {submitState === 'idle' && (
                    <div className="flex gap-2">
                      <input value={playerName} maxLength={12} placeholder="你的昵称" aria-label="排行榜昵称"
                        onChange={e => setPlayerName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitScore(); e.stopPropagation(); }}
                        className="w-32 px-3.5 py-2 rounded-xl bg-white/85 text-slate-800 text-sm font-bold border border-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      <button onClick={submitScore} className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-black shadow-md transition-all hover:scale-105 active:scale-95">提交成绩</button>
                    </div>
                  )}
                  {submitState === 'busy' && <span className="text-xs font-bold text-indigo-200">提交中…</span>}
                  {submitState === 'done' && <span className="text-xs font-black text-emerald-300">{submitNote}</span>}
                  {submitState === 'error' && <span className="text-xs font-bold text-red-300">{submitNote}</span>}
                  {submitState === 'hidden' && submitNote && <span className="text-xs font-bold text-indigo-200">{submitNote}</span>}
                </div>
              )}
              <button onClick={begin} className="mt-4 px-9 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-black shadow-lg shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95">再来一局</button>
              <p className="mt-2 text-[10px] font-bold text-indigo-300/70">回车或空格也能重开</p>
            </div>
          )}
        </div>
        {/* 手机方向盘 */}
        <div className="md:hidden mt-4 flex flex-col items-center gap-1.5 select-none">
          {dpad('↑', 0, '')}
          <div className="flex gap-1.5">{dpad('←', 3, '')}{dpad('↓', 2, '')}{dpad('→', 1, '')}</div>
        </div>
        <p className="hidden md:block mt-2 text-center text-[11px] font-bold text-slate-400">方向键 / WASD 转向 · P 或失焦自动暂停 · 回车重开</p>
      </div>

      {/* 排行榜 */}
      <div className="w-full max-w-md mx-auto bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-white/40 dark:border-white/10 shadow-xl p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 tracking-widest">全网排行</h2>
          <div className="flex rounded-full overflow-hidden border border-slate-300/40 dark:border-slate-600/50 text-[11px] font-black">
            {(['all', 'today'] as const).map(p => (
              <button key={p} onClick={() => setBoardPeriod(p)}
                className={`px-3.5 py-1 transition-colors ${boardPeriod === p ? 'bg-indigo-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-white/40'}`}>
                {p === 'all' ? '总榜' : '今日'}
              </button>
            ))}
          </div>
        </div>
        {board.length > 0 ? (
          <ol className="space-y-1.5">
            {board.slice(0, 10).map(e => (
              <li key={e.rank} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/40 text-sm font-bold">
                <b className={`w-6 text-center text-xs ${e.rank === 1 ? 'text-amber-500' : e.rank === 2 ? 'text-slate-400' : e.rank === 3 ? 'text-orange-400' : 'text-slate-400'}`}>{e.rank}</b>
                <span className="flex-1 text-slate-700 dark:text-slate-200 truncate">{e.name}</span>
                <em className="not-italic font-black text-indigo-500 tabular-nums">{e.score}</em>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs font-bold text-slate-400 py-6 text-center">{boardNote || '虚位以待，第一条记录就是你。'}</p>
        )}
        <p className="mt-3 text-[10px] font-bold text-slate-400">同一昵称只保留最高分 · 每日榜单隔天清零</p>
      </div>
    </div>
  );
}
