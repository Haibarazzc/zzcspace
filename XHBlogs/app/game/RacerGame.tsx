'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Flag, Gauge, Maximize2, Minimize2, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX, Zap } from 'lucide-react';
import { CARS, EMPTY_INPUT, Race, TRACK_INFO, formatTime, type Input, type Mode, type Phase, type RaceConfig, type TrackId } from './race-model';
import type { RaceAudio, RaceWorld } from './race-world';
import styles from './racer.module.css';

const DEFAULT_CONFIG: RaceConfig = { track: 'sakura', car: 0, difficulty: 1, laps: 3, mode: 'race', autoAccelerate: true };
const MODE_NAMES = { race: '竞速赛', time: '计时赛', practice: '自由练习' };
const DIFFICULTIES = ['休闲', '标准', '挑战'];
interface Result { place: number; total: number; time: number; laps: number[]; drift: number; boosts: number; topSpeed: number; rows: { name: string; color: string; time: number | null; player: boolean }[]; record: boolean }
interface Hud { phase: Phase; speed: number; lap: number; time: number; lapTime: number; place: number; tanks: number; charge: number; drift: number; boosting: boolean; message: string; countdown: number; order: { name: string; color: string; player: boolean; gap: string }[] }
const EMPTY_HUD: Hud = { phase: 'garage', speed: 0, lap: 1, time: 0, lapTime: 0, place: 7, tanks: 1, charge: 0, drift: 0, boosting: false, message: '', countdown: 4, order: [] };
function recordKey(config: RaceConfig) { return `sakura-racing-v2:${config.track}:${config.car}:${config.mode}:${config.laps}:${config.difficulty}`; }
function readRecord(config: RaceConfig) {
  try { const v = Number(localStorage.getItem(recordKey(config))); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; }
}

// ===== 全网排行榜 =====
interface BoardEntry { name: string; time: number; date: string; rank?: number }
function loadPlayerId() {
  try {
    let id = localStorage.getItem('racer-player-id');
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) { id = crypto.randomUUID(); localStorage.setItem('racer-player-id', id); }
    return id;
  } catch { return crypto.randomUUID(); }
}
async function apiBoard(body: Record<string, unknown>) {
  const res = await fetch('/api/racer-board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as Record<string, unknown>;
}
async function fetchBoard(config: RaceConfig): Promise<{ entries: BoardEntry[]; total: number }> {
  const q = new URLSearchParams({ track: config.track, car: String(config.car), mode: config.mode, laps: String(config.laps), difficulty: String(config.difficulty) });
  const res = await fetch('/api/racer-board?' + q);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data as { entries: BoardEntry[]; total: number };
}

export default function RacerGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const raceRef = useRef<Race | null>(null);
  const worldRef = useRef<RaceWorld | null>(null);
  const audioRef = useRef<RaceAudio | null>(null);
  const keys = useRef(new Set<string>());
  const touches = useRef(new Map<number, string>());
  const boostQueued = useRef(false);
  const [config, setConfig] = useState<RaceConfig>(DEFAULT_CONFIG);
  const configRef = useRef(config);
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [sound, setSound] = useState(false);
  const [quality, setQuality] = useState<'high' | 'low'>('high');
  const [full, setFull] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [help, setHelp] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  const resultSaved = useRef(false);
  // 排行榜相关
  const sessionRef = useRef<string | null>(null);
  const [board, setBoard] = useState<{ entries: BoardEntry[]; total: number } | null>(null);
  const [boardNote, setBoardNote] = useState('');
  const [boardBusy, setBoardBusy] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [submitState, setSubmitState] = useState<'hidden' | 'idle' | 'busy' | 'done' | 'error'>('hidden');
  const [submitNote, setSubmitNote] = useState('');
  const [garageBoard, setGarageBoard] = useState<{ entries: BoardEntry[]; total: number } | null>(null);
  const [garageBoardNote, setGarageBoardNote] = useState('');
  const clearInput = useCallback(() => { keys.current.clear(); touches.current.clear(); boostQueued.current = false; }, []);

  useEffect(() => {
    let cancelled = false, raf = 0, world: RaceWorld | null = null, audio: RaceAudio | null = null;
    const canvas = canvasRef.current, host = hostRef.current;
    if (!canvas || !host) return;
    setReady(false); setError('');
    const loseContext = (event: Event) => {
      event.preventDefault(); raceRef.current?.pause(); clearInput();
      setReady(false); setError('3D 画面暂时中断，请重新载入赛道。');
    };
    const pause = () => { raceRef.current?.pause(); clearInput(); };
    const visibility = () => { if (document.hidden) pause(); };
    canvas.addEventListener('webglcontextlost', loseContext);
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', visibility);
    void import('./race-world').then(({ RaceWorld, RaceAudio }) => {
      if (cancelled) return;
      const race = new Race(configRef.current); raceRef.current = race;
      world = new RaceWorld(canvas, host, race, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      audio = new RaceAudio(); audioRef.current = audio; worldRef.current = world;
      setReady(true); setSound(false); setHud(EMPTY_HUD); setResult(null); setBest(readRecord(configRef.current));
      refreshGarageBoard(configRef.current);
      let last = performance.now(), lastUi = 0, previousCount = 4, previousPhase: Phase = 'garage';
      const frame = (now: number) => {
        if (cancelled) return;
        const dt = Math.min(.1, (now - last) / 1000); last = now;
        const race = raceRef.current!;
        const pressed = (key: string) => keys.current.has(key) || [...touches.current.values()].includes(key);
        const input: Input = { ...EMPTY_INPUT, steer: Number(pressed('ArrowLeft') || pressed('KeyA')) - Number(pressed('ArrowRight') || pressed('KeyD')),
          accelerate: pressed('ArrowUp') || pressed('KeyW'), brake: pressed('ArrowDown') || pressed('KeyS'),
          drift: pressed('ShiftLeft') || pressed('ShiftRight'), boost: pressed('Space') || boostQueued.current };
        boostQueued.current = false;
        race.update(dt, input); world!.render(race, dt, pressed('KeyQ')); audio!.update(race);
        const countdown = Math.ceil(race.countdown);
        if (race.phase === 'countdown' && countdown !== previousCount) { audio!.beep(countdown === 0 ? 880 : 440); previousCount = countdown; }
        if (race.phase === 'racing' && previousPhase === 'countdown') audio!.beep(880);
        if (race.phase === 'finished' && !resultSaved.current) {
          resultSaved.current = true;
          const old = readRecord(race.config), newBest = old === null || race.time < old;
          if (newBest) { try { localStorage.setItem(recordKey(race.config), String(race.time)); } catch { /* Storage is optional. */ } setBest(race.time); }
          setResult({ place: race.place, total: race.racers.length, time: race.time, laps: [...race.player.lapTimes], drift: race.totalDrift,
            boosts: race.boostsUsed, topSpeed: race.topSpeed, record: newBest,
            rows: race.order.map(r => ({ name: r.name, color: r.color, time: r.finishedAt, player: r.id === 0 })) });
          clearInput(); audio!.beep(1047);
        }
        // 结算后拉取当前配置的全网排行（练习模式除外）
        if (race.phase === 'finished' && race.config.mode !== 'practice') {
          const cfg = race.config;
          setBoard(null); setBoardNote(''); setSubmitState(sessionRef.current ? 'idle' : 'hidden');
          setSubmitNote(sessionRef.current ? '' : '本局缺少有效会话，无法上榜');
          fetchBoard(cfg).then(b => setBoard(b)).catch(() => setBoardNote('排行榜暂时拿不到，稍后再试'));
        }
        if (now - lastUi > 70 || race.phase !== previousPhase) {
          const p = race.player, leader = race.order[0];
          setHud({ phase: race.phase, speed: Math.round(p.speed * 3.6), lap: Math.max(1, p.lap + 1), time: race.time, lapTime: race.time - p.lapStart,
            place: race.place, tanks: p.tanks, charge: p.charge, drift: p.drifting ? p.driftTime : 0, boosting: p.boostTime > 0 || p.miniTime > 0,
            message: race.messageTime > 0 ? race.message : '', countdown,
            order: race.order.map(r => ({ name: r.name, color: r.color, player: r.id === 0, gap: r.finishedAt !== null ? '已冲线' : r.id === leader.id ? '领跑' : `+${Math.round(leader.distance - r.distance)}m` })) });
          if (mapRef.current) world!.drawMap(mapRef.current, race);
          lastUi = now;
        }
        previousPhase = race.phase;
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }).catch(() => { if (!cancelled) { setError('无法启动 3D 赛道。请开启浏览器硬件加速，或换一个支持 WebGL 2 的浏览器。'); setReady(false); } });
    return () => {
      cancelled = true; cancelAnimationFrame(raf); world?.dispose(); audio?.dispose(); worldRef.current = null; audioRef.current = null;
      canvas.removeEventListener('webglcontextlost', loseContext); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); clearInput();
    };
  }, [retry, clearInput]);

  const configure = (patch: Partial<RaceConfig>) => {
    const next = { ...configRef.current, ...patch }; configRef.current = next; setConfig(next);
    const race = new Race(next); raceRef.current = race; worldRef.current?.rebuild(race); setBest(readRecord(next));
    refreshGarageBoard(next);
  };
  const refreshGarageBoard = (cfg: RaceConfig) => {
    if (cfg.mode === 'practice') { setGarageBoard(null); setGarageBoardNote(''); return; }
    setGarageBoardNote('');
    fetchBoard(cfg).then(setGarageBoard).catch(() => { setGarageBoard(null); setGarageBoardNote('排行榜暂时拿不到'); });
  };
  const submitScore = async () => {
    const race = raceRef.current;
    if (!race || !sessionRef.current || submitState === 'busy' || submitState === 'done') return;
    const name = playerName.trim();
    if (!name || [...name].length > 12) { setSubmitState('error'); setSubmitNote('昵称请填 1～12 个字符'); return; }
    setSubmitState('busy'); setSubmitNote('校验中…');
    try {
      const data = await apiBoard({ action: 'finish', sessionId: sessionRef.current, name,
        config: race.config, time: race.player.finishedAt ?? race.time });
      try { localStorage.setItem('racer-name', name); } catch { /* 可选 */ }
      setSubmitState('done');
      setSubmitNote(data.rank ? `已上榜 · 当前第 ${data.rank} 名` : '已上榜');
      fetchBoard(race.config).then(setBoard).catch(() => {});
    } catch (err) {
      setSubmitState('error');
      setSubmitNote(err instanceof Error ? err.message : '提交失败，请稍后再试');
    }
  };
  const start = () => {
    if (!ready) return;
    clearInput(); resultSaved.current = false; setResult(null); setHelp(false);
    sessionRef.current = null;
    setBoard(null); setBoardNote(''); setSubmitState('hidden'); setSubmitNote('');
    try { setPlayerName(localStorage.getItem('racer-name') || ''); } catch { /* 可选 */ }
    raceRef.current?.start(); shellRef.current?.focus();
    // 会话在后台异步创建；网络失败时结算页会提示无法上榜
    if (raceRef.current && raceRef.current.config.mode !== 'practice') {
      apiBoard({ action: 'start', playerId: loadPlayerId() })
        .then(data => { sessionRef.current = String(data.sessionId || '') || null; })
        .catch(() => { sessionRef.current = null; });
    }
  };
  const garage = () => { clearInput(); raceRef.current?.reset(); setResult(null); setHelp(false); };
  const pause = () => { clearInput(); raceRef.current?.pause(); };
  const resume = () => { clearInput(); raceRef.current?.resume(); setHelp(false); shellRef.current?.focus(); };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shellRef.current?.requestFullscreen) await shellRef.current.requestFullscreen();
      else setExpanded(v => !v);
    } catch { setExpanded(v => !v); }
  };
  useEffect(() => {
    const update = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update); return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const old = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = old; };
  }, [expanded]);
  useEffect(() => {
    if (hud.phase === 'paused' || hud.phase === 'finished') shellRef.current?.querySelector<HTMLButtonElement>('[role="dialog"] button')?.focus();
    if (hud.phase === 'countdown') shellRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [hud.phase]);
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, key: string) => {
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); touches.current.set(event.pointerId, key);
    if (key === 'Space') boostQueued.current = true;
  };
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => { touches.current.delete(event.pointerId); };
  const touchButton = (key: string) => ({ onPointerDown: (e: PointerEvent<HTMLButtonElement>) => onPointerDown(e, key), onPointerUp, onPointerCancel: onPointerUp, onLostPointerCapture: onPointerUp });
  const active = hud.phase !== 'garage' && hud.phase !== 'finished';
  const paused = hud.phase === 'paused';
  const currentCar = CARS[config.car];

  return (
    <div className={styles.wrapper}>
      <section ref={shellRef} className={`${styles.shell} ${expanded ? styles.expanded : ''} ${hud.boosting && active ? styles.boosting : ''}`} tabIndex={0} aria-label="樱花公路赛车游戏"
        onKeyDown={e => {
          const race = raceRef.current;
          if (!race || e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
          if (e.code === 'Tab' && (race.phase === 'paused' || race.phase === 'finished')) {
            const buttons = shellRef.current?.querySelectorAll<HTMLButtonElement>('[role="dialog"] button');
            if (buttons?.length) {
              if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons[buttons.length - 1].focus(); }
              else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) { e.preventDefault(); buttons[0].focus(); }
            }
          }
          if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); if (race.phase === 'paused') resume(); else pause(); return; }
          if (e.target instanceof HTMLButtonElement) return;
          if (e.code === 'Enter' && (race.phase === 'garage' || race.phase === 'finished')) { e.preventDefault(); start(); return; }
          if (race.phase !== 'racing' && race.phase !== 'countdown') return;
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyR'].includes(e.code)) {
            e.preventDefault(); keys.current.add(e.code);
            if (e.code === 'Space' && !e.repeat) boostQueued.current = true;
            if (e.code === 'KeyR' && !e.repeat) race.recover();
          }
        }} onKeyUp={e => { keys.current.delete(e.code); }}
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { raceRef.current?.pause(); clearInput(); } }}>
        <div ref={hostRef} className={styles.world}><canvas ref={canvasRef} aria-label="3D 赛车画面，比赛信息见屏幕仪表" /></div>
        <div className={styles.vignette} />
        <div className={styles.toolbar}>
          <span className={styles.brand}><Flag size={17} /> SAKURA <span>RACING CLUB</span></span>
          <div className={styles.tools}>
            {active && <button aria-label={paused ? '继续比赛' : '暂停比赛'} onClick={paused ? resume : pause}>{paused ? <Play size={17} /> : <Pause size={17} />}</button>}
            <button aria-label={sound ? '关闭音效' : '开启音效'} aria-pressed={sound} onClick={async () => setSound(await audioRef.current?.toggle() ?? false)} disabled={!ready}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
            <button aria-label={full || expanded ? '退出全屏' : '全屏游戏'} onClick={() => expanded ? setExpanded(false) : void toggleFullscreen()}>{full || expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
          </div>
        </div>

        {!ready && <div className={styles.loading} role={error ? 'alert' : 'status'}>
          <Flag size={30} /><strong>{error ? '赛道未能载入' : '正在准备发车'}</strong><p>{error || '组装赛车，点亮赛道…'}</p>
          {error && <button className={styles.primary} onClick={() => setRetry(v => v + 1)}>重新载入 <RotateCcw size={17} /></button>}
        </div>}

        {ready && hud.phase === 'garage' && <div className={styles.garage}>
          <div className={styles.intro}><span className={styles.eyebrow}>晴空已就位 / 只等你出发</span><h2>把风，<br />留在身后。</h2><p>漂过花海，冲向下一道弯。</p></div>
          <div className={styles.carPicker}>
            <div className={styles.carName}><span><small>你的座驾 / {currentCar.label}</small><strong>{currentCar.name}</strong></span><span className={styles.carNumber}>0{config.car + 1}</span></div>
            <div className={styles.carOptions} aria-label="选择赛车">
              {CARS.map((car, i) => <button key={car.name} aria-label={car.name} aria-pressed={config.car === i} className={config.car === i ? styles.carSelected : ''} onClick={() => configure({ car: i })} style={{ '--car-color': car.color } as CSSProperties}><span />{car.label}</button>)}
            </div>
            <div className={styles.specs}><span>极速 <b>{Math.round(currentCar.maxSpeed * 3.6)}</b> km/h</span><span>操控 <b>{currentCar.handling > 1 ? '灵敏' : currentCar.handling < 1 ? '稳重' : '均衡'}</b></span><span>氮气 <b>{(2.7 * currentCar.boost).toFixed(1)}</b> 秒</span></div>
          </div>
          <div className={styles.setup}>
            <div className={styles.setupTitle}><span>下一站，起跑线。</span><Flag size={21} /></div>
            <div className={styles.field}><span className={styles.label}>选择赛道</span><div className={styles.trackOptions}>
              {(Object.keys(TRACK_INFO) as TrackId[]).map(id => <button key={id} onClick={() => configure({ track: id })} aria-pressed={config.track === id} className={config.track === id ? styles.selected : ''}><span className={`${styles.trackThumbnail} ${id === 'coast' ? styles.coast : ''}`}><Flag size={25} /></span><strong>{TRACK_INFO[id].name}</strong><small>{id === 'sakura' ? '樱林 · 宽阔长弯' : '海岸 · 连续 S 弯'}</small></button>)}
            </div></div>
            <div className={styles.field}><label className={styles.label} htmlFor="race-mode">比赛模式</label><div className={styles.segmented} id="race-mode" role="group" aria-label="比赛模式">{(['race', 'time', 'practice'] as Mode[]).map(mode => <button key={mode} aria-pressed={config.mode === mode} onClick={() => configure({ mode })}>{MODE_NAMES[mode]}</button>)}</div></div>
            <div className={styles.selectRow}>
              <label><span className={styles.label}>{config.mode === 'race' ? '对手难度' : '赛道环境'}</span><select aria-label="对手难度" value={config.difficulty} onChange={e => configure({ difficulty: Number(e.target.value) })} disabled={config.mode !== 'race'}>{DIFFICULTIES.map((name, i) => <option key={name} value={i}>{name}{config.mode === 'race' ? ' · 7 位对手' : ''}</option>)}</select></label>
              <label><span className={styles.label}>圈数</span><select aria-label="圈数" value={config.laps} disabled={config.mode === 'practice'} onChange={e => configure({ laps: Number(e.target.value) })}>{[1, 2, 3].map(n => <option key={n} value={n}>{n} 圈</option>)}</select></label>
            </div>
            <label className={styles.auto}><input type="checkbox" checked={config.autoAccelerate} onChange={e => configure({ autoAccelerate: e.target.checked })} /><span>自动油门 <small>专注转向和漂移</small></span></label>
            <button className={styles.primary} onClick={start}>{config.mode === 'practice' ? '进入练习' : '开始比赛'}<ArrowUpRight size={22} /></button>
            <div className={styles.record}><Trophy size={14} />{config.mode === 'practice' ? '不限圈数，自由熟悉赛道' : best ? `本机纪录 ${formatTime(best)}` : '第一场纪录，等你来写。'}</div>
            {config.mode !== 'practice' && (garageBoard ? <div className={styles.garageBoard}>
              <div className={styles.boardHead}><h3><Trophy size={14} /> 全网 TOP {Math.min(5, garageBoard.entries.length)}</h3>
                <button className={styles.boardRefresh} onClick={() => refreshGarageBoard(configRef.current)} aria-label="刷新排行榜">刷新</button></div>
              <ol className={styles.boardList}>
                {garageBoard.entries.slice(0, 5).map(e => <li key={e.rank}><b>{e.rank}</b><span>{e.name}</span><em>{formatTime(e.time)}</em></li>)}
                {garageBoard.entries.length === 0 && <li className={styles.boardEmpty}>还没有人上榜。</li>}
              </ol>
            </div> : garageBoardNote ? <div className={styles.garageBoard}><p className={styles.boardNote}>{garageBoardNote}</p></div> : null)}
          </div>
        </div>}

        {ready && active && <div className={styles.hud}>
          <div className={styles.raceTop}><div className={styles.position}><strong>{String(hud.place).padStart(2, '0')}</strong><span>/ {config.mode === 'race' ? '08' : '01'}<small>当前名次</small></span></div><div className={styles.lap}><small>{config.mode === 'practice' ? '自由练习' : 'LAP / 圈数'}</small><strong>{Math.min(hud.lap, config.mode === 'practice' ? Infinity : config.laps)}<span> / {config.mode === 'practice' ? '∞' : config.laps}</span></strong></div><div className={styles.timer}><small>总用时</small><strong>{formatTime(hud.time)}</strong><span>本圈 {formatTime(hud.lapTime)}</span></div></div>
          {config.mode === 'race' && <ol className={styles.standings} aria-label="实时排名">{hud.order.map((r, i) => <li key={r.name} className={r.player ? styles.you : ''}><b>{i + 1}</b><i style={{ backgroundColor: r.color }} /><span>{r.name}{r.player && <small> YOU</small>}</span><em>{r.gap}</em></li>)}</ol>}
          <div className={styles.courseLabel}>{TRACK_INFO[config.track].name}<span>{MODE_NAMES[config.mode]}</span></div>
          <div className={styles.miniMap}><canvas ref={mapRef} width={240} height={240} aria-label="赛道小地图，白边大圆点为玩家" /><span>{(raceRef.current!.track.length / 1000).toFixed(2)} km / 圈</span></div>
          <div className={styles.speed}><strong>{hud.speed.toString().padStart(3, '0')}</strong><span>KM/H</span><div className={styles.speedLine}><i style={{ transform: `scaleX(${Math.min(hud.speed / 320, 1)})` }} /></div></div>
          <div className={styles.nitro}><div className={styles.tanks}>{[0, 1].map(i => <span key={i} className={hud.tanks > i ? styles.tankReady : ''}><Zap size={23} fill={hud.tanks > i ? 'currentColor' : 'none'} /></span>)}<div><strong>N₂O</strong><small>空格释放 / {hud.tanks} 次</small></div></div><div className={styles.charge}><i style={{ width: `${hud.charge}%` }} /></div><span>{hud.drift > 0 ? `漂移集气 ${Math.round(hud.charge)}%` : 'Shift + 方向键 漂移集气'}</span></div>
          {hud.drift > .1 && <div className={`${styles.driftNotice} ${hud.drift > 1.35 ? styles.perfect : ''}`}><strong>{hud.drift > 1.35 ? 'PERFECT DRIFT' : 'DRIFT'}</strong><span>{hud.drift > 1.35 ? '松开 Shift · 强力小喷' : '持续漂移 · 充能中'}</span></div>}
          {hud.message && <div className={styles.message} role="status">{hud.message}</div>}
          {hud.phase === 'countdown' && <div className={styles.countdown}><strong>{hud.countdown > 3 ? 'READY' : Math.max(1, hud.countdown)}</strong><span>自动油门{config.autoAccelerate ? '已开启' : '已关闭 · 按住 ↑ 加速'}</span></div>}
          <div className={styles.touchControls} aria-label="触屏驾驶控制">
            <div><button aria-label="向左转向" {...touchButton('ArrowLeft')}><ChevronLeft /></button><button aria-label="向右转向" {...touchButton('ArrowRight')}><ChevronRight /></button></div>
            <div className={styles.touchActions}><button aria-label="刹车" {...touchButton('ArrowDown')}>刹车</button>{!config.autoAccelerate && <button aria-label="油门" {...touchButton('ArrowUp')}>油门</button>}<button className={styles.touchDrift} aria-label="漂移" {...touchButton('ShiftLeft')}>漂移</button><button className={styles.touchBoost} aria-label="释放氮气" {...touchButton('Space')}><Zap size={18} />N₂O</button></div>
          </div>
        </div>}

        {ready && paused && <div className={styles.overlay}><div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="pause-title"><span className={styles.eyebrow}>TAKE A BREATH</span><h2 id="pause-title">风景等你，<br />比赛也是。</h2><p>比赛已暂停，计时与对手都已停止。</p><button className={styles.primary} onClick={resume}>继续比赛 <Play size={18} /></button><div className={styles.dialogActions}><button onClick={start}><RotateCcw size={15} />重新发车</button><button onClick={garage}><ArrowLeft size={15} />返回车库</button></div><button className={styles.textButton} onClick={() => setHelp(v => !v)}>查看操作说明</button>{help && <div className={styles.pauseHelp}>WASD / 方向键驾驶<br />Shift + 方向键漂移，松开小喷<br />空格释放氮气 · R 回正 · Q 后视</div>}</div></div>}

        {ready && hud.phase === 'finished' && result && <div className={styles.overlay}><div className={`${styles.dialog} ${styles.result}`} role="dialog" aria-modal="true" aria-labelledby="result-title"><div className={styles.resultHeading}><Trophy size={34} /><span>{result.record ? '刷新本机纪录' : 'FINISH / 完成比赛'}</span></div><h2 id="result-title">{result.total > 1 ? `第 ${result.place} 名` : '漂亮的一圈。'}</h2><div className={styles.resultTime}>{formatTime(result.time)}</div><p>{TRACK_INFO[config.track].name} · {config.laps} 圈 · {currentCar.name}</p><div className={styles.resultColumns}><div><h3>比赛排名</h3><ol>{result.rows.map((r, i) => <li key={r.name} className={r.player ? styles.resultYou : ''}><b>{i + 1}</b><span>{r.name}</span><em>{r.time !== null ? formatTime(r.time) : '未冲线'}</em></li>)}</ol></div><div><h3>你的表现</h3>{result.laps.map((time, i) => <div className={styles.lapResult} key={i}><span>第 {i + 1} 圈</span><b>{formatTime(time)}</b></div>)}<div className={styles.lapResult}><span>最高时速</span><b>{Math.round(result.topSpeed)} km/h</b></div><div className={styles.lapResult}><span>漂移 / 氮气</span><b>{result.drift.toFixed(1)}s / {result.boosts} 次</b></div></div></div>
              {config.mode !== 'practice' && <div className={styles.board}>
                <div className={styles.boardHead}><h3><Trophy size={15} /> 全网排行</h3>
                  {submitState === 'idle' && <div className={styles.boardSubmit}>
                    <input value={playerName} maxLength={12} placeholder="你的昵称" aria-label="排行榜昵称"
                      onChange={e => setPlayerName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitScore(); e.stopPropagation(); }} />
                    <button onClick={submitScore}>提交成绩</button>
                  </div>}
                  {submitState === 'busy' && <span className={styles.boardNote}>校验中…</span>}
                  {submitState === 'done' && <span className={styles.boardNoteOk}>{submitNote}</span>}
                  {submitState === 'error' && <span className={styles.boardNoteErr}>{submitNote}</span>}
                  {submitState === 'hidden' && <span className={styles.boardNote}>{submitNote}</span>}
                </div>
                {board ? <ol className={styles.boardList}>
                  {board.entries.map(e => <li key={e.rank}><b>{e.rank}</b><span>{e.name}</span><em>{formatTime(e.time)}</em></li>)}
                  {board.entries.length === 0 && <li className={styles.boardEmpty}>虚位以待，第一个上榜的就是你。</li>}
                </ol> : <p className={styles.boardNote}>{boardNote || '正在拉取排行榜…'}</p>}
                {board && board.total > board.entries.length && <p className={styles.boardNote}>共 {board.total} 条成绩</p>}
                <p className={styles.boardHint}>成绩按你的完成时间直接记录</p>
              </div>}
              <button className={styles.primary} onClick={start}>再跑一场 <RotateCcw size={18} /></button><button className={styles.textButton} onClick={garage}>返回车库，换条赛道</button></div></div>}
      </section>
      <div className={styles.bottomBar}><div className={styles.keyboardHelp}><span><kbd>↑</kbd><kbd>↓</kbd> 油门 / 刹车</span><span><kbd>←</kbd><kbd>→</kbd> 转向</span><span><kbd>Shift</kbd> 漂移</span><span><kbd>Space</kbd> 氮气</span><span><kbd>P</kbd> 暂停</span><span><kbd>R</kbd> 回正</span><span><kbd>Q</kbd> 后视</span></div><label className={styles.quality}><Gauge size={14} /><select aria-label="画面质量" value={quality} onChange={e => { const q = e.target.value as 'high' | 'low'; setQuality(q); worldRef.current?.setQuality(q); }}><option value="high">精致画面</option><option value="low">流畅优先</option></select></label></div>
      <div className={styles.notes}><span>弯前转向 + 漂移，出弯松开触发小喷；集满一格获得氮气，最多存两瓶。</span><span>单机竞速 · AI 对手 · 纪录仅存本机</span></div>
    </div>
  );
}
