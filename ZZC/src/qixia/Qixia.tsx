import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowUpRight, Box, ChevronLeft, ChevronRight, Compass, HelpCircle, Layers, Maximize2, Minimize2, Moon, Mouse, MoveHorizontal, Pause, RotateCcw, RotateCw, Sunrise, Sunset, Volume2, VolumeX, X } from 'lucide-react'
import { destinations, landmarks, times, type CameraShot, type TimeOfDay, type ViewMode } from './data'
import './Qixia.css'

const World=lazy(()=>import('./World'))
const viewItems=[{id:'overview',label:'全景',Icon:Box},{id:'axis',label:'中轴',Icon:MoveHorizontal},{id:'top',label:'俯瞰',Icon:Layers}] as const
const timeItems=[{id:'dawn',Icon:Sunrise},{id:'dusk',Icon:Sunset},{id:'night',Icon:Moon}] as const

class SceneBoundary extends Component<{children:ReactNode;onError:()=>void},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(){this.props.onError()}
  render(){return this.state.failed?<div className="qx-unavailable"><Compass size={34}/><h2>此刻，山河暂歇。</h2><p>三维场景未能启动，请启用浏览器硬件加速后重试。你仍可通过左侧目录探索各处内容。</p><button onClick={()=>location.reload()}>重新载入</button></div>:this.props.children}
}

export default function Qixia() {
  const [time,setTime]=useState<TimeOfDay>('dawn')
  const [selected,setSelected]=useState(0)
  const [shot,setShot]=useState<CameraShot>({mode:'overview',focus:null,revision:0})
  const [auto,setAuto]=useState(false)
  const [ready,setReady]=useState(false)
  const [bearing,setBearing]=useState(0)
  const [fullscreen,setFullscreen]=useState(false)
  const [sound,setSound]=useState(false)
  const [notice,setNotice]=useState('')
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)
  const dialog=useRef<HTMLDialogElement>(null),helpButton=useRef<HTMLButtonElement>(null),audio=useRef<AudioContext|null>(null)
  const building=landmarks[selected],destination=destinations[selected]
  const select=useCallback((id:number)=>{setSelected(id);setAuto(false);setShot(s=>({mode:s.mode,focus:id,revision:s.revision+1}))},[])
  const view=useCallback((mode:ViewMode)=>{setAuto(false);setShot(s=>({mode,focus:null,revision:s.revision+1}))},[])
  const reset=useCallback(()=>{setSelected(0);view('overview')},[view])
  const onReady=useCallback(()=>setReady(true),[])
  const manual=useCallback(()=>setAuto(false),[])
  const toggleOrbit=()=>{if(!auto){setShot(s=>({mode:'overview',focus:null,revision:s.revision+1}))}setAuto(!auto)}
  useEffect(()=>{
    const previousTitle=document.title;document.title='樱花古境 · 曾子丞的立体庭院'
    document.documentElement.classList.add('qx-document');document.documentElement.lang='zh-CN'
    const sync=()=>setFullscreen(Boolean(document.fullscreenElement))
    const preference=matchMedia('(prefers-reduced-motion: reduce)'),syncMotion=()=>{setReduced(preference.matches);if(preference.matches)setAuto(false)}
    document.addEventListener('fullscreenchange',sync);preference.addEventListener('change',syncMotion)
    return()=>{document.title=previousTitle;document.documentElement.classList.remove('qx-document');document.removeEventListener('fullscreenchange',sync);preference.removeEventListener('change',syncMotion);void audio.current?.close()}
  },[])
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(dialog.current?.open)return
      if(event.target instanceof HTMLElement&&event.target.closest('button,a,input,select,textarea'))return
      if(event.key==='ArrowRight'){event.preventDefault();select((selected+1)%9)}
      if(event.key==='ArrowLeft'){event.preventDefault();select((selected+8)%9)}
      if(event.key==='1')view('overview');if(event.key==='2')view('axis');if(event.key==='3')view('top')
      if(event.key.toLowerCase()==='r')reset()
      if(event.key.toLowerCase()==='t')setTime(t=>t==='dawn'?'dusk':t==='dusk'?'night':'dawn')
    }
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
  },[selected,select,view,reset])
  useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(id)},[notice])
  async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{setNotice('当前浏览器不支持全屏，可直接在页面中游览。')}}
  async function toggleSound(){
    if(sound){await audio.current?.close();audio.current=null;setSound(false);return}
    try{
      const context=new AudioContext();audio.current=context;await context.resume()
      const buffer=context.createBuffer(1,context.sampleRate*4,context.sampleRate),data=buffer.getChannelData(0)
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.45
      const wind=context.createBufferSource();wind.buffer=buffer;wind.loop=true
      const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=320
      const gain=context.createGain();gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(.065,context.currentTime+2)
      wind.connect(filter).connect(gain).connect(context.destination);wind.start();setSound(true)
    }catch{await audio.current?.close();audio.current=null;setNotice('环境音暂时无法播放，请稍后重试。')}
  }
  return <div className={`qx-scene qx-${time}`} data-ready={ready}>
    <div className="qx-world" aria-label="可拖拽旋转、滚轮缩放的樱花古建三维庭院"><SceneBoundary onError={onReady}><Suspense fallback={null}><World time={time} shot={shot} selected={selected} auto={auto} reduced={reduced} onSelect={select} onManual={manual} onBearing={setBearing} onReady={onReady}/></Suspense></SceneBoundary></div>
    <div className="qx-atmosphere" aria-hidden="true"/>
    {!ready&&<div className="qx-loading" role="status"><span className="qx-loading-seal">樱</span><p>等一阵风，赴一场花期</p></div>}
    <header className="qx-header">
      <a className="qx-brand" href="/" aria-label="樱花古境，返回博客"><span className="qx-seal">樱</span><span><strong>樱花古境</strong><small>SAKURA · A PERSONAL WORLD</small></span></a>
      <div className="qx-header-right"><div className="qx-time-switch" role="group" aria-label="场景时段">{timeItems.map(({id,Icon})=><button key={id} aria-pressed={time===id} onClick={()=>setTime(id)}><Icon size={15}/><span>{times[id].label}</span></button>)}</div><button ref={helpButton} className="qx-icon" aria-label="操作指南" onClick={e=>{helpButton.current=e.currentTarget;dialog.current?.showModal()}}><HelpCircle size={18}/></button></div>
    </header>
    <aside className="qx-story">
      <div className="qx-intro"><span className="qx-edition"><i/> 曾子丞的数字庭院</span><h1>一庭樱雨，<br/>半卷春风。</h1><p>循着花香，走进自己的春日。</p><div className="qx-intro-line"/></div>
      <section className="qx-chapter" aria-label="当前建筑" aria-live="polite">
        <div key={selected} className="qx-chapter-content"><div className="qx-chapter-title"><span>{String(selected+1).padStart(2,'0')} <i>/</i></span><h2>{building.name}</h2></div><span className="qx-chapter-english">{building.en}</span><p className="qx-poem">{building.copy}</p><p className="qx-description">{building.detail}</p><a className="qx-destination" href={destination.url}>{destination.label}<ArrowUpRight size={14}/></a></div>
        <div className="qx-pagination"><button className="qx-icon" aria-label="上一处建筑" onClick={()=>select((selected+8)%9)}><ChevronLeft size={18}/></button><span>{String(selected+1).padStart(2,'0')} <i>—</i> 09</span><button className="qx-icon" aria-label="下一处建筑" onClick={()=>select((selected+1)%9)}><ChevronRight size={18}/></button><span className="qx-chapter-type">{destination.note}</span></div>
      </section>
      <div className="qx-building-index" role="group" aria-label="九境目录">{landmarks.map((b,i)=><button key={b.name} aria-label={b.name} aria-pressed={selected===i} title={b.name} onClick={()=>select(i)}><span>{String(i+1).padStart(2,'0')}</span><i/></button>)}</div>
    </aside>
    <div className="qx-world-caption" aria-hidden="true"><span>{times[time].sub}</span><i/><small>樱落有声 · 春意无尽</small></div>
    <div className="qx-compass" aria-hidden="true"><span>北</span><div><i style={{transform:`rotate(${-bearing}deg)`}}/><b>西</b><b>东</b></div><span>南</span></div>
    <nav className="qx-dock" aria-label="镜头控制"><div className="qx-view-controls">{viewItems.map(({id,label,Icon})=><button key={id} aria-pressed={shot.mode===id&&shot.focus===null} onClick={()=>view(id)}><Icon size={20}/><span>{label}</span></button>)}<span className="qx-dock-divider"/><button onClick={toggleOrbit} aria-pressed={auto} disabled={reduced} title={reduced?'已遵循减少动态效果设置':'自动环绕庭院'}>{auto?<Pause size={19}/>:<RotateCw size={21}/>}<span>自动环绕</span></button></div><button className="qx-reset" onClick={reset} aria-label="重置视角" title="重置视角 · R"><RotateCcw size={22}/></button></nav>
    <div className="qx-footer"><a href="/" className="qx-back"><ArrowLeft size={13}/><span>返回博客</span></a><span className="qx-instructions"><Mouse size={18}/>拖拽旋转<span>·</span>滚轮缩放<span>·</span>点击建筑探索</span><span className="qx-signature">花开成境 · 风过成诗</span><div className="qx-utility"><button className="qx-icon qx-mobile-help" aria-label="操作指南" onClick={e=>{helpButton.current=e.currentTarget;dialog.current?.showModal()}}><HelpCircle size={18}/></button><button className="qx-icon" onClick={toggleSound} aria-label={sound?'关闭环境音':'开启环境音'} aria-pressed={sound}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button className="qx-icon" onClick={toggleFullscreen} aria-label={fullscreen?'退出全屏':'进入全屏'}>{fullscreen?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button></div></div>
    {notice&&<p className="qx-notice" role="status">{notice}</p>}
    <dialog ref={dialog} className="qx-help" onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}} onClose={()=>helpButton.current?.focus()}><div><button className="qx-icon qx-help-close" aria-label="关闭操作指南" onClick={()=>dialog.current?.close()}><X size={20}/></button><Compass size={32}/><h2>游园有径，探索无界。</h2><p>这是一座为曾子丞构想的樱花庭院。粉白花树环抱古建，花瓣随风落向石径与池水。九处建筑，九条通往个人世界的路径。</p><dl><div><dt>转动与靠近</dt><dd>鼠标拖拽 / 单指滑动旋转，滚轮 / 双指捏合缩放。</dd></div><div><dt>走进一处建筑</dt><dd>点击建筑或九境目录；← → 切换上一处、下一处。</dd></div><div><dt>换一个角度</dt><dd>1 全景 · 2 中轴 · 3 俯瞰 · R 回到起点 · T 切换时段。</dd></div></dl><small>艺术化三维场景 · 非历史建筑测绘复原</small><button className="qx-help-enter" onClick={()=>dialog.current?.close()}>继续游览<ArrowUpRight size={16}/></button></div></dialog>
  </div>
}
