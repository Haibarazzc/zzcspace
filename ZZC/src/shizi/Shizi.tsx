import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowUpRight, Box, ChevronLeft, ChevronRight, Compass, Eye, HelpCircle, Layers, Maximize2, Minimize2, Mouse, MoveHorizontal, Pause, RotateCcw, RotateCw, Scan, Smile, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { features, links, poses, type CameraShot, type PoseId, type ViewMode } from './data'
import './Shizi.css'

const World = lazy(() => import('./World'))
const viewItems = [{ id: 'overview', label: '全景', Icon: Box }, { id: 'front', label: '正面', Icon: Scan }, { id: 'side', label: '侧面', Icon: MoveHorizontal }, { id: 'top', label: '俯瞰', Icon: Layers }] as const
const poseItems = [{ id: 'stand', Icon: Smile }, { id: 'cheer', Icon: Sparkles }, { id: 'glance', Icon: Eye }] as const

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? <div className="sz-unavailable"><Compass size={34} /><h2>狮子暂时没有走出来。</h2><p>三维场景未能启动，请启用浏览器硬件加速后重试。你仍可通过左侧目录阅读各处设计。</p><button onClick={() => location.reload()}>重新载入</button></div> : this.props.children }
}

export default function Shizi() {
  const [pose, setPose] = useState<PoseId>('stand')
  const [selected, setSelected] = useState(0)
  const [shot, setShot] = useState<CameraShot>({ mode: 'overview', focus: null, revision: 0 })
  const [auto, setAuto] = useState(false)
  const [ready, setReady] = useState(false)
  const [bearing, setBearing] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [sound, setSound] = useState(false)
  const [notice, setNotice] = useState('')
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const dialog = useRef<HTMLDialogElement>(null)
  const helpButton = useRef<HTMLButtonElement>(null)
  const audio = useRef<AudioContext | null>(null)
  const feature = features[selected]
  const link = links[selected]
  const select = useCallback((id: number) => { setSelected(id); setAuto(false); setShot(s => ({ mode: s.mode, focus: id, revision: s.revision + 1 })) }, [])
  const view = useCallback((mode: ViewMode) => { setAuto(false); setShot(s => ({ mode, focus: null, revision: s.revision + 1 })) }, [])
  const reset = useCallback(() => { setSelected(0); setPose('stand'); view('overview') }, [view])
  const onReady = useCallback(() => setReady(true), [])
  const manual = useCallback(() => setAuto(false), [])
  const toggleOrbit = () => { if (!auto) setShot(s => ({ mode: 'overview', focus: null, revision: s.revision + 1 })); setAuto(!auto) }
  useEffect(() => {
    const previousTitle = document.title
    document.title = '狮小新 · 致新书院吉祥物'
    document.documentElement.classList.add('sz-document')
    document.documentElement.lang = 'zh-CN'
    const sync = () => setFullscreen(Boolean(document.fullscreenElement))
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => { setReduced(preference.matches); if (preference.matches) setAuto(false) }
    document.addEventListener('fullscreenchange', sync)
    preference.addEventListener('change', syncMotion)
    return () => { document.title = previousTitle; document.documentElement.classList.remove('sz-document'); document.removeEventListener('fullscreenchange', sync); preference.removeEventListener('change', syncMotion); void audio.current?.close() }
  }, [])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (dialog.current?.open) return
      if (event.target instanceof HTMLElement && event.target.closest('button,a,input,select,textarea')) return
      if (event.key === 'ArrowRight') { event.preventDefault(); select((selected + 1) % 6) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); select((selected + 5) % 6) }
      if (event.key === '1') view('overview')
      if (event.key === '2') view('front')
      if (event.key === '3') view('side')
      if (event.key === '4') view('top')
      if (event.key.toLowerCase() === 'r') reset()
      if (event.key.toLowerCase() === 't') setPose(p => p === 'stand' ? 'cheer' : p === 'cheer' ? 'glance' : 'stand')
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [selected, select, view, reset])
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(id) }, [notice])
  async function toggleFullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen() } catch { setNotice('当前浏览器不支持全屏，可直接在页面中观看。') } }
  async function toggleSound() {
    if (sound) { await audio.current?.close(); audio.current = null; setSound(false); return }
    try {
      const context = new AudioContext()
      audio.current = context
      await context.resume()
      const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.45
      const wind = context.createBufferSource()
      wind.buffer = buffer
      wind.loop = true
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 280
      const gain = context.createGain()
      gain.gain.setValueAtTime(0, context.currentTime)
      gain.gain.linearRampToValueAtTime(0.05, context.currentTime + 2)
      wind.connect(filter).connect(gain).connect(context.destination)
      wind.start()
      setSound(true)
    } catch { await audio.current?.close(); audio.current = null; setNotice('环境音暂时无法播放，请稍后重试。') }
  }
  return (
    <div className={`sz-scene sz-${pose}`} data-ready={ready}>
      <div className="sz-world" aria-label="可拖拽旋转、滚轮缩放的致新书院狮子吉祥物">
        <SceneBoundary onError={onReady}>
          <Suspense fallback={null}>
            <World pose={pose} shot={shot} selected={selected} auto={auto} reduced={reduced} onSelect={select} onManual={manual} onBearing={setBearing} onReady={onReady} />
          </Suspense>
        </SceneBoundary>
      </div>
      <div className="sz-atmosphere" aria-hidden="true" />
      {!ready && <div className="sz-loading" role="status"><span className="sz-loading-seal">狮</span><p>等一只狮子，走到光里</p></div>}
      <header className="sz-header">
        <a className="sz-brand" href="/" aria-label="狮小新，返回首页"><span className="sz-seal">狮</span><span><strong>狮小新</strong><small>ZHIXIN · MASCOT</small></span></a>
        <div className="sz-header-right">
          <div className="sz-time-switch" role="group" aria-label="狮子姿态">
            {poseItems.map(({ id, Icon }) => <button key={id} aria-pressed={pose === id} onClick={() => setPose(id)}><Icon size={15} /><span>{poses[id].label}</span></button>)}
          </div>
          <button ref={helpButton} className="sz-icon" aria-label="操作指南" onClick={e => { helpButton.current = e.currentTarget; dialog.current?.showModal() }}><HelpCircle size={18} /></button>
        </div>
      </header>
      <aside className="sz-story">
        <div className="sz-intro"><span className="sz-edition"><i /> 南科大 · 致新书院</span><h1>一头小狮，<br />一院朝气。</h1><p>照着六视图，把吉祥物站进光里。</p><div className="sz-intro-line" /></div>
        <section className="sz-chapter" aria-label="当前部位" aria-live="polite">
          <div key={selected} className="sz-chapter-content">
            <div className="sz-chapter-title"><span>{String(selected + 1).padStart(2, '0')} <i>/</i></span><h2>{feature.name}</h2></div>
            <span className="sz-chapter-english">{feature.en}</span>
            <p className="sz-poem">{feature.copy}</p>
            <p className="sz-description">{feature.detail}</p>
            <a className="sz-destination" href={link.url}>{link.label}<ArrowUpRight size={14} /></a>
          </div>
          <div className="sz-pagination">
            <button className="sz-icon" aria-label="上一处" onClick={() => select((selected + 5) % 6)}><ChevronLeft size={18} /></button>
            <span>{String(selected + 1).padStart(2, '0')} <i>—</i> 06</span>
            <button className="sz-icon" aria-label="下一处" onClick={() => select((selected + 1) % 6)}><ChevronRight size={18} /></button>
            <span className="sz-chapter-type">{link.note}</span>
          </div>
        </section>
        <div className="sz-building-index" role="group" aria-label="六处设计">
          {features.map((item, i) => <button key={item.name} aria-label={item.name} aria-pressed={selected === i} title={item.name} onClick={() => select(i)}><span>{String(i + 1).padStart(2, '0')}</span><i /></button>)}
        </div>
      </aside>
      <div className="sz-world-caption" aria-hidden="true"><span>{poses[pose].sub}</span><i /><small>静立可观 · 欢呼可近</small></div>
      <div className="sz-compass" aria-hidden="true"><span>北</span><div><i style={{ transform: `rotate(${-bearing}deg)` }} /><b>西</b><b>东</b></div><span>南</span></div>
      <nav className="sz-dock" aria-label="镜头控制">
        <div className="sz-view-controls">
          {viewItems.map(({ id, label, Icon }) => <button key={id} aria-pressed={shot.mode === id && shot.focus === null} onClick={() => view(id)}><Icon size={20} /><span>{label}</span></button>)}
          <span className="sz-dock-divider" />
          <button onClick={toggleOrbit} aria-pressed={auto} disabled={reduced} title={reduced ? '已遵循减少动态效果设置' : '自动环绕'}>{auto ? <Pause size={19} /> : <RotateCw size={21} />}<span>自动环绕</span></button>
        </div>
        <button className="sz-reset" onClick={reset} aria-label="重置视角" title="重置视角 · R"><RotateCcw size={22} /></button>
      </nav>
      <div className="sz-footer">
        <a href="/" className="sz-back"><ArrowLeft size={13} /><span>返回首页</span></a>
        <span className="sz-instructions"><Mouse size={18} />拖拽旋转<span>·</span>滚轮缩放<span>·</span>点击狮子探索</span>
        <span className="sz-signature">鬃展成轮 · 笑意成光</span>
        <div className="sz-utility">
          <button className="sz-icon sz-mobile-help" aria-label="操作指南" onClick={e => { helpButton.current = e.currentTarget; dialog.current?.showModal() }}><HelpCircle size={18} /></button>
          <button className="sz-icon" onClick={toggleSound} aria-label={sound ? '关闭环境音' : '开启环境音'} aria-pressed={sound}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button className="sz-icon" onClick={toggleFullscreen} aria-label={fullscreen ? '退出全屏' : '进入全屏'}>{fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        </div>
      </div>
      {notice && <p className="sz-notice" role="status">{notice}</p>}
      <dialog ref={dialog} className="sz-help" onClick={e => { if (e.target === e.currentTarget) dialog.current?.close() }} onClose={() => helpButton.current?.focus()}>
        <div>
          <button className="sz-icon sz-help-close" aria-label="关闭操作指南" onClick={() => dialog.current?.close()}><X size={20} /></button>
          <Compass size={32} />
          <h2>六面看狮，姿态可换。</h2>
          <p>这只狮子依照致新书院吉祥物的立体六视图搭建：金黄日轮鬃、白脸笑意、胸口院名，以及静立与举臂两套姿态。回望是在侧视之外补的一个转身分镜。</p>
          <dl>
            <div><dt>转动与靠近</dt><dd>鼠标拖拽 / 单指滑动旋转，滚轮 / 双指捏合缩放。</dd></div>
            <div><dt>看一处设计</dt><dd>点击狮子或六处目录；← → 切换上一处、下一处。</dd></div>
            <div><dt>换一个角度</dt><dd>1 全景 · 2 正面 · 3 侧面 · 4 俯瞰 · R 回到起点 · T 切换姿态。</dd></div>
          </dl>
          <small>艺术化三维形象 · 参照 2018 年吉祥物六视图，不是原工程文件</small>
          <button className="sz-help-enter" onClick={() => dialog.current?.close()}>继续观看<ArrowUpRight size={16} /></button>
        </div>
      </dialog>
    </div>
  )
}
