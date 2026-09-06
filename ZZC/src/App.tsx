import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowDown, ArrowUpRight, Aperture, ChevronLeft, ChevronRight, CircleDot, Mail, Map, Moon, Mountain, Palette, Pause, Play, Route, Sun, Video, X } from 'lucide-react'
import { profile } from './data/profile'
import { translations, type Language } from './data/translations'
import SpecularButton from './components/SpecularButton'
import { initTracker } from './tracker'

gsap.registerPlugin(ScrollTrigger)

const InteractiveCube = lazy(() => import('./components/InteractiveCube'))
const SunsetColorLab = lazy(() => import('./components/SunsetColorLab'))

const photos = [
  { src: '../photos/gallery-01.webp', title: 'Observation / 01', note: '光影记录' },
  { src: '../photos/gallery-02.webp', title: 'Observation / 02', note: '光影记录' },
  { src: '../photos/gallery-03.webp', title: 'Observation / 03', note: '光影记录' },
  { src: '../photos/gallery-04.webp', title: 'Observation / 04', note: '光影记录' },
  { src: '../photos/gallery-05.webp', title: 'Observation / 05', note: '光影记录' },
  { src: '../photos/gallery-06.webp', title: 'Observation / 06', note: '光影记录' },
]

const campusWork = [
  { tag: '摄影比赛 · 总分前三', title: '“光淬红岭，影铸鹏城”摄影大赛', desc: '作品《夕影漫染的都市乐章》获大赛总分前三（2025）。', url: 'https://mp.weixin.qq.com/s/Jb8kLfPaz9t3srgd1eAB0Q' },
  { tag: '活动摄影组', title: '“岭听风吟”十大歌手 & 五佳组合', desc: '担任摄影组成员，负责活动现场视频与照片拍摄（2024）。', url: 'https://mp.weixin.qq.com/s/ddaR3TVb_6fpV5GJ0Z3b6g' },
  { tag: '校园拍摄', title: '第十三届创意运动会开幕式', desc: '参与校园大型活动拍摄：194 个班级、上万名师生的开幕式盛况（2024.10）。', url: 'https://mp.weixin.qq.com/s/FxZqLbzQD4clTi2JhBRrPA' },
  { tag: '校园拍摄', title: '第十三届创意运动会 · 高中部特别报道', desc: '高中部视角：79 个代表队、1368 名运动员的开幕式记录（2024.10）。', url: 'https://mp.weixin.qq.com/s/z0obXOPgHxKU9-thKMRLnQ' },
  { tag: '校园拍摄', title: '第十四届创意运动会开幕式', desc: '参与“民族共荣，科技同辉”主题运动会开幕式拍摄（2025.10）。', url: 'https://mp.weixin.qq.com/s/CzVyDkQf5wbJdb4nTlu0AQ' },
  { tag: '校园拍摄', title: '高中部社团招新展', desc: '参与 2024-2025 学年度开学季社团招新展演拍摄。', url: 'https://mp.weixin.qq.com/s/yuSI0utHtsamxSpH1f5-BQ' },
]

const interestDetails = {  go: { label: 'GO · AMATEUR 2 DAN', title: '围棋：在局部之外看全局', text: '围棋训练我在复杂局面中计算与判断：什么时候继续争取，什么时候接受取舍，又如何让局部选择服务于全局。业余二段并不意味着职业水平，它更像一段长期练习的记录。它提醒我，耐心和复盘往往比一时的得失更重要。' },
  hiking: { label: 'HIKING · SHORT DISTANCE', title: '徒步：跟随步伐建立节奏', text: '目前我的徒步主要是日常短途运动，并没有丰富的长线或高难度经历。我喜欢步行时稳定的节奏，也喜欢在城市之外感受更开阔的自然空间。未来，希望在能力和条件允许时，逐渐拓展体验，但不急于把它包装成一场远征。' },
  cycling: { label: 'CYCLING · DAILY RHYTHM', title: '骑行：让日常多一点流动', text: '骑行目前也是短途与日常运动的一部分。速度不必很快，距离也不必很远；移动的节奏、道路的变化，以及风经过身边的感觉，本身就足以让普通的一天变得更清醒、更开阔。' },
  cube: { label: 'CUBE · SPATIAL THINKING', title: '魔方：在转动中寻找秩序', text: '魔方吸引我的，是有限规则下不断变化的空间关系。观察、拆解并尝试复原的过程，需要记住局部变化，也要理解每一步对整体结构的影响。它更像一种轻松的思维练习，让抽象的步骤变成可以触摸和验证的过程。' },
}
function ReadingProgress() {
  const bar=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const el=bar.current
    if(!el)return
    const update=()=>{const d=document.documentElement,m=d.scrollHeight-d.clientHeight;el.style.transform=`scaleX(${m>0?d.scrollTop/m:0})`}
    update()
    addEventListener('scroll',update,{passive:true})
    addEventListener('resize',update)
    return()=>{removeEventListener('scroll',update);removeEventListener('resize',update)}
  },[])
  return <div className="reading-progress" ref={bar} aria-hidden="true"/>
}

function VisitCounter() {
  useEffect(()=>{
    const win=window as any
    if(win.__bszLoaded)return
    win.__bszLoaded=true
    const s=document.createElement('script')
    s.src='https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'
    s.async=true
    document.head.appendChild(s)
  },[])
  return <span id="busuanzi_container_site_pv" className="visit-count">访问次数 <span id="busuanzi_value_site_pv">0</span></span>
}

type Theme = 'dark' | 'light'

function HeroCube({theme}:{theme:Theme}) {
  return (
    <Suspense fallback={<div className="cube-loading" aria-hidden="true" />}>
      <InteractiveCube theme={theme}/>
    </Suspense>
  )
}

function IntroOverlay() {
  const [visible,setVisible]=useState(true)
  const [progress,setProgress]=useState(0)
  useEffect(()=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
    const start=performance.now(),duration=reduced?180:3000
    let frame=0
    const tick=(now:number)=>{const p=Math.min(100,Math.round((now-start)/duration*100));setProgress(p);if(p<100)frame=requestAnimationFrame(tick)}
    frame=requestAnimationFrame(tick)
    const timer=window.setTimeout(()=>setVisible(false),reduced?260:3600)
    return()=>{cancelAnimationFrame(frame);clearTimeout(timer)}
  },[])
  if(!visible)return null
  return <div className="arkon-intro" aria-hidden="true"><div className="intro-curtain top"/><div className="intro-curtain bottom"/><div className="intro-interface"><span>{profile.name}</span><small>INITIALIZING EXPLORATION</small><div><i style={{width:`${progress}%`}}/><b>{String(progress).padStart(3,'0')}</b></div></div></div>
}

function InterestCard({kind,label,title,text,onOpen}:{kind:keyof typeof interestDetails,label:string,title:string,text:string,onOpen:()=>void}) {
  const visual=kind==='go'?<div className="go-board"><i/><i/></div>:kind==='hiking'?<div className="mountain-mark"><Mountain/></div>:kind==='cycling'?<div className="cycle-mark"><Route/></div>:<div className="mini-cube-mark">{Array.from({length:9},(_,i)=><i key={i}/>)}</div>
  return <article className="old-interest-card interest-playing-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={e=>{if(e.key==='Enter')onOpen()}}><div className="interest-card-inner"><div className="interest-card-front"><div className="interest-visual">{visual}</div><span>{label}</span><h3>{title}</h3><p>{text}</p></div><div className="interest-card-back" aria-hidden="true"><img className="card-back-emblem" src="./assets/kid-emblem-cutout.webp" alt=""/><span>探索</span><small>逻辑 / 运动 / 自然</small></div></div></article>
}

function StylePlayer() {
  const audio=useRef<HTMLAudioElement>(null)
  const [playing,setPlaying]=useState(false)
  const [currentTime,setCurrentTime]=useState(0)
  const [duration,setDuration]=useState(0)
  const [error,setError]=useState(false)
  const formatTime=(time:number)=>`${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')}`
  const toggle=()=>{
    const player=audio.current
    if(!player)return
    if(player.paused){setError(false);player.play().catch(()=>setError(true))}
    else player.pause()
  }
  return <section className="nav-music" aria-label="Style 背景音乐" translate="no">
    <div className="nav-music-disc" data-playing={playing}><img src="../music/style-taylor-swift.jpg" alt="1989 专辑封面" width="52" height="52"/></div>
    <div className="nav-music-copy"><span className="nav-music-label">CLOUD MUSIC</span><div><strong>Style</strong><span>Taylor Swift</span></div><p>{error?'播放失败，请点击重试':'We never go out of style'}</p></div>
    <button className="nav-music-toggle" type="button" onClick={toggle} aria-label={playing?'暂停 Style 背景音乐':'播放 Style 背景音乐'} aria-pressed={playing}>{playing?<Pause size={17} fill="currentColor"/>:<Play size={17} fill="currentColor"/>}</button>
    <div className="nav-music-progress"><time>{formatTime(currentTime)}</time><input aria-label="Style 播放进度" type="range" min="0" max={duration||1} step="0.1" value={currentTime} disabled={!duration} onChange={event=>{const time=Number(event.target.value);if(audio.current)audio.current.currentTime=time;setCurrentTime(time)}}/><time>{duration?formatTime(duration):'--:--'}</time></div>
    <audio ref={audio} src="../music/audio/style-taylor-swift.mp3" preload="metadata" loop onLoadedMetadata={event=>{const time=event.currentTarget.duration;setDuration(Number.isFinite(time)?time:0)}} onTimeUpdate={event=>setCurrentTime(event.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>{setError(true);setPlaying(false)}}/>
  </section>
}

function App() {
  const gallery=useRef<HTMLDivElement>(null)
  const track=useRef<HTMLDivElement>(null)
  const [menu,setMenu]=useState(false)
  const [activePhoto,setActivePhoto]=useState<number | null>(null)
  const [activeInterest,setActiveInterest]=useState<keyof typeof interestDetails | null>(null)
  const [language,setLanguage]=useState<Language>(()=>(localStorage.getItem('portfolio-language-v2') as Language)||'en')
  const [theme,setTheme]=useState<Theme>(()=>localStorage.getItem('portfolio-theme-v2')==='light'?'light':'dark')
  const [sunsetLab,setSunsetLab]=useState(()=>new URLSearchParams(location.search).get('lab')==='sunset')
  useEffect(()=>{
    document.documentElement.dataset.theme=theme
    document.documentElement.style.colorScheme=theme
    localStorage.setItem('portfolio-theme-v2',theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#E6F7FF':'#080a09')
  },[theme])
  useEffect(()=>{ initTracker() },[])
  useEffect(()=>{const sync=()=>setSunsetLab(new URLSearchParams(location.search).get('lab')==='sunset');addEventListener('popstate',sync);return()=>removeEventListener('popstate',sync)},[])
  useEffect(()=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
    const followCursor = (event: MouseEvent) => {
      document.documentElement.style.setProperty('--cursor-x', event.clientX + 'px')
      document.documentElement.style.setProperty('--cursor-y', event.clientY + 'px')
    }
    if(!reduced)addEventListener('mousemove', followCursor, { passive: true })
    const ctx=gsap.context(()=>{
      if(reduced)return

      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el,index)=>gsap.fromTo(el,
        {y:64,opacity:0,filter:'blur(8px)'},
        {y:0,opacity:1,filter:'blur(0px)',duration:1.05,delay:(index%3)*.035,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 88%',once:true}}
      ))

      gsap.timeline({scrollTrigger:{trigger:'.old-hero',start:'top top',end:'bottom top',scrub:1.15}})
        .to('.old-hero-copy',{xPercent:-5,yPercent:-18,opacity:.28,ease:'none'},0)
        .to('.hero-cube-column',{xPercent:5,yPercent:16,scale:.84,rotation:3,opacity:.34,ease:'none'},0)

      gsap.utils.toArray<HTMLElement>('.old-section-head h2, .photo-title h2, .future h2').forEach(title=>{
        gsap.fromTo(title,
          {clipPath:'inset(0 0 100% 0)',y:72,opacity:.12},
          {clipPath:'inset(0 0 0% 0)',y:0,opacity:1,duration:1.18,ease:'power4.out',scrollTrigger:{trigger:title,start:'top 86%',once:true}}
        )
      })

      gsap.fromTo('.old-about-copy > p',{x:-48,opacity:0},{x:0,opacity:1,duration:.9,stagger:.13,ease:'power3.out',scrollTrigger:{trigger:'.old-about-copy',start:'top 78%',once:true}})
      gsap.fromTo('.old-trait-list > div',{y:32,opacity:0},{y:0,opacity:1,duration:.72,stagger:.08,ease:'back.out(1.25)',scrollTrigger:{trigger:'.old-trait-list',start:'top 84%',once:true}})
      gsap.fromTo('.old-about-side > *',{x:54,rotationY:-7,opacity:0},{x:0,rotationY:0,opacity:1,duration:1.05,stagger:.15,ease:'power3.out',scrollTrigger:{trigger:'.old-about-side',start:'top 79%',once:true}})

      const achievementGrid=document.querySelector<HTMLElement>('.old-metric-grid')
      const achievementCards=gsap.utils.toArray<HTMLElement>('.old-metric-grid article')
      if(achievementGrid&&achievementCards.length){
        const spread=gsap.timeline({scrollTrigger:{trigger:achievementGrid,start:'top 82%',once:true}})
        spread.fromTo('.achievement-origin',{scale:.2,opacity:0},{scale:1,opacity:1,duration:.48,ease:'back.out(2)'})
          .fromTo(achievementCards,{x:(_,card)=>{const g=achievementGrid.getBoundingClientRect(),r=(card as HTMLElement).getBoundingClientRect();return g.left+g.width/2-r.left-r.width/2},y:(_,card)=>{const g=achievementGrid.getBoundingClientRect(),r=(card as HTMLElement).getBoundingClientRect();return g.top+g.height/2-r.top-r.height/2},rotationY:(i)=>i%2?-112:112,rotationZ:(i)=>(i-1.5)*9,scale:.34,opacity:0},{x:0,y:(i)=>innerWidth<768?0:i===1?30:i===2?-8:0,rotationY:0,rotationZ:0,scale:1,opacity:1,duration:1.18,stagger:.13,ease:'power4.out',clearProps:'transform'},'-=.18')
          .to('.achievement-origin',{scale:2.8,opacity:0,duration:.62,ease:'power2.out'},'-=.5')
      }
      gsap.fromTo('.old-timeline',{'--timeline-progress':0},{'--timeline-progress':1,ease:'none',scrollTrigger:{trigger:'.old-timeline',start:'top 72%',end:'bottom 68%',scrub:.8}})
      gsap.fromTo('.old-timeline article',{x:-34,opacity:.25},{x:0,opacity:1,duration:.85,stagger:.12,ease:'power3.out',scrollTrigger:{trigger:'.old-timeline',start:'top 78%',once:true}})

      gsap.fromTo('.old-explore-note > p, .old-explore-note > div',{x:-42,opacity:0},{x:0,opacity:1,duration:.85,stagger:.11,ease:'power3.out',scrollTrigger:{trigger:'.old-explore-note',start:'top 76%',once:true}})
      gsap.fromTo('.academic-orbits',{scale:.72,rotation:-7,opacity:.18},{scale:1,rotation:0,opacity:1,duration:1.35,ease:'power3.out',scrollTrigger:{trigger:'.academic-orbits',start:'top 80%',once:true}})

      gsap.fromTo('.photo-hero img',{scale:1.16,yPercent:-4},{scale:1.02,yPercent:5,ease:'none',scrollTrigger:{trigger:'.photo-intro',start:'top bottom',end:'bottom top',scrub:1.2}})
      gsap.fromTo('.photo-title',{xPercent:-5,yPercent:18,opacity:.25},{xPercent:0,yPercent:0,opacity:1,ease:'none',scrollTrigger:{trigger:'.photo-intro',start:'top 75%',end:'center 48%',scrub:.9}})

      if(innerWidth>768 && gallery.current && track.current){
        const distance=track.current.scrollWidth-innerWidth
        const galleryTween=gsap.to(track.current,{x:-distance,ease:'none',scrollTrigger:{trigger:gallery.current,start:'top top',end:()=>`+=${distance}`,pin:true,scrub:1.05,invalidateOnRefresh:true}})
        gsap.utils.toArray<HTMLElement>('.photo-card').forEach((card,index)=>{
          gsap.fromTo(card,{y:index%2?70:-38,rotationY:index%2?-5:5,scale:.91,opacity:.5},{y:0,rotationY:0,scale:1,opacity:1,ease:'none',scrollTrigger:{trigger:card,containerAnimation:galleryTween,start:'left 94%',end:'center 68%',scrub:true}})
          const image=card.querySelector('img')
          if(image)gsap.fromTo(image,{scale:1.12,xPercent:index%2?-3:3},{scale:1,xPercent:0,ease:'none',scrollTrigger:{trigger:card,containerAnimation:galleryTween,start:'left 94%',end:'right 28%',scrub:true}})
        })
      }

      const cards=gsap.utils.toArray<HTMLElement>('.interest-playing-card')
      const inners=gsap.utils.toArray<HTMLElement>('.interest-card-inner')
      if(cards.length){
        gsap.set(cards,{x:(i)=>innerWidth<768?0:(1.5-i)*(cards[i].offsetWidth+18),y:(i)=>innerWidth<768?(1.5-i)*(cards[i].offsetHeight+18):0,rotationZ:(i)=>(i-1.5)*-5.5,rotationX:innerWidth<768?0:8,scale:.84,opacity:.35})
        gsap.set(inners,{rotationY:180})
        const deal=gsap.timeline({scrollTrigger:{trigger:'.old-interest-grid',start:'top 82%',once:true}})
        deal.to(cards,{x:0,y:0,rotationZ:0,rotationX:0,scale:1,opacity:1,duration:1.18,stagger:.14,ease:'power4.out'})
          .to(inners,{rotationY:0,duration:1,stagger:.2,ease:'power3.inOut'},'-=.5')
      }

      gsap.fromTo('.future-horizon',{scale:.78,opacity:0},{scale:1,opacity:1,duration:1.65,ease:'power3.out',scrollTrigger:{trigger:'.future',start:'top 74%',once:true}})
      gsap.fromTo('.future>p, .future-copy > p, .contact-links, .future-return',{y:34,opacity:0},{y:0,opacity:1,duration:.95,stagger:.11,ease:'power3.out',scrollTrigger:{trigger:'.future-copy',start:'top 84%',once:true}})
    })
    return()=>{ if(!reduced)removeEventListener('mousemove', followCursor);ctx.revert() }
  },[])
  useEffect(()=>{
    localStorage.setItem('portfolio-language-v2', language)
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    document.title = language === 'zh' ? '曾子丞 - 个人主页' : 'Zeng Zicheng - Exploration Portfolio'
    const reverse = Object.fromEntries(Object.entries(translations).map(([zh,en])=>[en,zh]))
    const map = language === 'en' ? translations : reverse
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while((node=walker.nextNode())) { const raw=node.nodeValue||'', key=raw.trim(); if(key && map[key]) node.nodeValue=raw.replace(key,map[key]) }
  },[language,activeInterest,activePhoto])
  const openSunsetLab=()=>{history.pushState({},'',`${location.pathname}?lab=sunset`);setSunsetLab(true);scrollTo(0,0)}
  const closeSunsetLab=()=>{history.pushState({},'',location.pathname);setSunsetLab(false);scrollTo(0,0)}
  if(sunsetLab)return <Suspense fallback={<div className="cube-loading"/>}><SunsetColorLab language={language} theme={theme} onClose={closeSunsetLab} onToggleLanguage={()=>setLanguage(language==='zh'?'en':'zh')} onToggleTheme={()=>setTheme(theme==='dark'?'light':'dark')}/></Suspense>
  return <main>
    <IntroOverlay/>
    <ReadingProgress/>
    <div className="site-atmosphere" aria-hidden="true"/><div className="cursor-glow"/>
    <header className="nav"><div className="nav-left"><a className="back-home" href="https://zzcspace.com/" aria-label="返回 zzcspace 主页" title="zzcspace.com">{language==='zh'?'← 返回主页':'← Back Home'}</a><a href="#top" className="brand"><CircleDot size={16}/> EXPLORATION / 2026</a></div><div className="nav-controls"><button className="theme-switch" onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label={theme==='dark'?'Switch to daylight mode':'Switch to night mode'} aria-pressed={theme==='light'} title={theme==='dark'?'Daylight mode':'Night mode'}><span className="theme-switch-track"><Sun size={13}/><Moon size={13}/><i/></span></button><button className="language-switch" onClick={()=>setLanguage(language==='zh'?'en':'zh')} aria-label={language==='zh'?'Switch to English':'切换到中文'}>{language==='zh'?'EN':'中文'}</button></div><button className="menu-btn" onClick={()=>setMenu(!menu)} aria-label="切换导航">{menu?'CLOSE':'INDEX'}</button><nav className={menu?'open':''}>{[['about','关于'],['journey','旅程'],['academic','学术'],['photography','摄影'],['beyond','兴趣']].map(([id,label])=><a key={id} href={`#${id}`} onClick={()=>setMenu(false)}>{label}</a>)}<a href="/portfolio/qixia/" onClick={()=>setMenu(false)}>{language==='zh'?'樱花古境':'Sakura Courtyard'}</a></nav><StylePlayer/></header>

    <section className="hero old-hero section" id="top">
      <div className="hero-volumes" aria-hidden="true"><i/><i/><i/></div><div className="hero-curves" aria-hidden="true"><i/><i/><i/></div><div className="hero-math-grid" aria-hidden="true"/>
      <motion.div className="old-hero-grid" initial="hidden" animate="show" variants={{show:{transition:{staggerChildren:.13,delayChildren:.15}}}}>
        <div className="old-hero-copy"><motion.h1 variants={{hidden:{opacity:0,filter:'blur(18px)'},show:{opacity:1,filter:'blur(0px)'}}} transition={{duration:1.2}}>曾子丞</motion.h1><motion.p className="old-hero-identity" variants={{hidden:{opacity:0,y:20},show:{opacity:1,y:0}}}>南科大新生｜数学与科技探索者｜摄影与山野记录者</motion.p><motion.p className="old-hero-statement" variants={{hidden:{opacity:0,y:20},show:{opacity:1,y:0}}}>在理性的秩序中认真思考，也在晚霞与山野之间感受世界。</motion.p><motion.div className="old-hero-actions" variants={{hidden:{opacity:0},show:{opacity:1}}}><SpecularButton className="hero-specular-button" size="lg" radius={999} tint="#ffffff" tintOpacity={.92} textColor="#111218" lineColor="#ffffff" baseColor="#787878" intensity={1.25} shineSize={12} shineFade={34} thickness={1.2} followMouse proximity={280} onClick={()=>document.querySelector('#about')?.scrollIntoView({behavior:'smooth'})}>开始了解 <ArrowDown size={16}/></SpecularButton></motion.div></div>
        <div className="hero-cube-column"><HeroCube theme={theme}/></div>
      </motion.div>
    </section>

    <section className="about old-section" id="about">
      <div className="old-container"><header className="old-section-head reveal"><h2>用逻辑理解问题，<br/>也为感受留下空间。</h2></header><div className="old-about-layout"><div className="old-about-copy reveal"><p>我毕业于深圳红岭中学，现在是南方科技大学的一名本科新生。<strong>数学训练让我习惯拆解问题、寻找秩序</strong>；摄影则提醒我，世界并不只由结论构成，也有光线、情绪与稍纵即逝的瞬间。</p><p>站在大学的起点，我对电子信息、计算机与机器人保持兴趣，但并不急着为自己限定唯一方向。比起过早给出答案，我更愿意先打牢基础，在课程、编程学习和未来的科研实践中认真体验。</p><p>我并非总能立刻找到最好的路径，但愿意投入时间，在判断、修正与继续前进之间保持耐心。</p><div className="old-trait-list"><div>逻辑与分析<span>Logic</span></div><div>观察与感受<span>Observation</span></div><div>专注与耐心<span>Focus</span></div><div>开放与好奇<span>Curiosity</span></div></div></div><div className="old-about-side reveal"><dl className="old-profile-facts"><div><dt>现在</dt><dd>南方科技大学 2026 级本科新生</dd></div><div><dt>来自</dt><dd>深圳红岭中学</dd></div><div><dt>MBTI</dt><dd>INTJ · 建筑师</dd></div><div><dt>关注</dt><dd>数学基础、科技探索与长期成长</dd></div><div><dt>镜头</dt><dd>晚霞、云层与城市边缘</dd></div></dl><a className="mbti-card" href="https://www.16personalities.com/ch/intj-%E4%BA%BA%E6%A0%BC" target="_blank" rel="noopener noreferrer"><span>PERSONALITY · INTJ</span><h3>建筑师人格</h3><p>内向（I）、直觉（N）、思考（T）、判断（J）。它更像一份思维习惯的自白：先理解结构再动手，重视长期积累胜过短期结果，对真正感兴趣的题目可以钻研很久。测试只是参考标签，但"独立思考 + 深度专注"这部分，与我对自己的观察一致。</p><small>了解 INTJ <ArrowUpRight size={13}/></small></a><div className="old-education-path"><div className="old-school"><img src="../hongling-logo-cutout.webp" alt="深圳红岭中学校徽"/><strong>深圳红岭中学</strong><small>Foundations · High School</small></div><div className="old-school-route"><i/><span>A new chapter unfolds</span></div><div className="old-school"><img src="../sustech-logo-cutout.webp" alt="南方科技大学校徽"/><strong>南方科技大学</strong><small>Now · University</small></div><p>从一段扎实的高中积累，走向仍在展开的大学起点。</p></div></div></div></div>
    </section>

    <section className="journey old-section" id="journey"><div className="old-container"><header className="old-section-head reveal"><h2>一些被认真投入<br/>留下的坐标。</h2><span>荣誉不是终点，更像是在不同阶段对专注与积累的记录。</span></header><div className="old-metric-grid reveal"><div className="achievement-origin" aria-hidden="true"><i/></div><article><small>MATHEMATICS</small><strong>TOP</strong><h3>多次数学年级第一</h3><p>深耕数理思维，具备扎实数学功底。</p></article><article><small>HONGLING STAR</small><strong>STAR</strong><h3>“红岭之星”</h3><p>全年级仅四人获得。</p></article><article><small>MATH COMPETITION</small><strong>1st Prize</strong><h3>校长杯数学竞赛一等奖</h3><p>一段关于数学训练的认真记录。</p></article><article><small>GO</small><strong>2 DAN</strong><h3>围棋业余二段</h3><p>在计算、取舍与耐心中学习。</p></article><article><small>GAOKAO 2026</small><strong>130</strong><h3>2026 高考数学</h3><p>以稳定的高考数学成绩，印证多年积累的数理功底。</p></article></div><div className="old-timeline"><article className="reveal"><i/><span>FOUNDATIONS</span><div><h3>红岭阶段：建立学习的基础</h3><p>在深圳红岭中学持续训练数学思维，多次取得数学年级第一，并获得“红岭之星”与校长杯数学竞赛一等奖。</p></div></article><article className="reveal"><i/><span>BEYOND STUDY</span><div><h3>学习之外：观察与耐心</h3><p>风光摄影作品曾在 500px 发布并被平台收录；围棋业余二段，则记录着计算、判断和长期练习。</p></div></article><article className="reveal"><i/><span>NOW</span><div><h3>大学起点：方向仍在展开</h3><p>进入南方科技大学后，继续夯实基础，并在电子信息、计算机与机器人等方向之间保持开放探索。</p></div></article></div></div></section>

    <section className="academic old-section" id="academic"><div className="old-container"><header className="old-section-head reveal"><h2>方向正在展开，<br/>答案不必过早确定。</h2></header><div className="old-explore-layout"><div className="old-explore-note reveal"><p><strong>目前，我处于探索阶段，而不是已经决定唯一方向。</strong></p><p>电子信息让我关注物理世界中的信号与系统；计算机提供理解与创造数字工具的方式；机器人则把感知、计算与行动连接起来。</p><p>目前，我正在学习高等数学、Python 与 C 语言，也在尝试通过 Agent 开发项目理解程序如何把想法转化为可以运行的工具。它们都还处于学习和实践阶段。</p><div><span>高等数学</span><span>Python</span><span>C 语言</span><span>Agent 开发项目</span></div></div><div className="old-path-map reveal academic-orbits"><div className="orbit-glow"/><button className="core">数学基础<span>Foundation</span></button><div className="planet-orbit orbit-a"><button>电子信息<span>Electronics</span></button></div><div className="planet-orbit orbit-b"><button>计算机<span>Computing</span></button></div><div className="planet-orbit orbit-c"><button>机器人<span>Robotics</span></button></div><div className="planet-orbit orbit-d small-orbit"><button>编程学习</button></div><div className="planet-orbit orbit-e small-orbit"><button>科研兴趣</button></div><div className="planet-orbit orbit-f small-orbit"><button>跨学科</button></div></div></div></div></section>

    <section className="photo-intro" id="photography"><div className="photo-hero"><img src={photos[0].src} alt="曾子丞的摄影作品：光影记录" loading="lazy" decoding="async"/><div className="photo-shade"/><div className="photo-title reveal"><span>PHOTOGRAPHY</span><h2>记录光经过<br/>世界的方式</h2><p>Photography, for me, is a practice of observation.</p></div><Aperture className="aperture" size={52}/></div></section>
    <section className="gallery-wrap" ref={gallery}><div className="gallery-track" ref={track}><div className="gallery-lead"><span>个人作品集</span><p>六个瞬间<br/>关于光、时间与空间</p></div>{photos.map((p,i)=><figure key={p.src} className={`photo-card p${i % 3}`} role="button" tabIndex={0} aria-label={`全屏查看 ${p.title}`} onClick={()=>setActivePhoto(i)} onKeyDown={e=>{if(e.key==="Enter")setActivePhoto(i)}}><img src={p.src} alt={`${p.title}，${p.note}`} loading="lazy"/><figcaption><span>{p.title}</span><p>{p.note}</p></figcaption></figure>)}<a className="photo-card video-card" href="https://www.bilibili.com/video/BV1pctMepEaz/" target="_blank" rel="noopener noreferrer" aria-label="延时摄影作品 · 在哔哩哔哩观看"><div className="video-card-media"><Play size={54}/></div><div className="video-card-cap"><span>延时摄影 · TIMELAPSE</span><p>点击观看 · 我的延时摄影作品</p></div></a><a className="photo-card video-card analyzer-card" href="?lab=sunset" onClick={event=>{event.preventDefault();openSunsetLab()}} aria-label="晚霞颜色实验室 · 打开在线颜色分析器"><div className="video-card-media"><Palette size={54}/><i/><i/><i/></div><div className="video-card-cap"><span>晚霞颜色实验室</span><p>打开在线颜色分析器</p></div></a></div></section>

    {activePhoto!==null&&<motion.div className="photo-modal" initial={{opacity:0}} animate={{opacity:1}} role="dialog" aria-modal="true" aria-label="摄影作品全屏预览" onClick={()=>setActivePhoto(null)}><button className="modal-close" onClick={()=>setActivePhoto(null)} aria-label="关闭预览"><X/></button><button className="modal-nav prev" onClick={e=>{e.stopPropagation();setActivePhoto((activePhoto-1+photos.length)%photos.length)}} aria-label="上一张"><ChevronLeft/></button><motion.img key={photos[activePhoto].src} initial={{scale:.96,opacity:0}} animate={{scale:1,opacity:1}} src={photos[activePhoto].src} alt={photos[activePhoto].title} onClick={e=>e.stopPropagation()}/><div className="modal-caption"><span>{photos[activePhoto].title}</span><small>{String(activePhoto+1).padStart(2,"0")} / {String(photos.length).padStart(2,"0")}</small></div><button className="modal-nav next" onClick={e=>{e.stopPropagation();setActivePhoto((activePhoto+1)%photos.length)}} aria-label="下一张"><ChevronRight/></button></motion.div>}
    <section className="campus old-section" id="campus"><div className="old-container"><header className="old-section-head reveal"><h2>镜头之后，<br/>也是现场的记录者。</h2><span>校园大型活动拍摄与摄影比赛记录 —— 每一条都是可查证的现场经历。</span></header><div className="campus-grid">{campusWork.map((w,i)=><a key={w.url} className="campus-card reveal" href={w.url} target="_blank" rel="noopener noreferrer" aria-label={`阅读报道：${w.title}`}><span>{w.tag}</span><h3>{w.title}</h3><p>{w.desc}</p><small>阅读报道 <ArrowUpRight size={14}/></small></a>)}</div></div></section>
    <section className="beyond old-section" id="beyond"><div className="old-container"><header className="old-section-head reveal"><h2>判断、步伐与风，<br/>组成学习之外的节奏。</h2></header><div className="old-interest-grid"><InterestCard kind="go" label="围棋 · 业余二段" title="围棋" text="围棋训练我在复杂局面中计算与判断：什么时候继续争取，什么时候接受取舍，又如何让局部选择服务于全局。业余二段，是耐心、复盘与长期练习留下的一枚坐标。" onOpen={()=>setActiveInterest('go')}/><InterestCard kind="hiking" label="徒步 · 短途" title="徒步" text="目前我的徒步主要是日常短途运动。我喜欢步行时稳定的节奏，也喜欢在城市之外感受更开阔的自然空间；未来希望在条件允许时逐渐拓展体验。" onOpen={()=>setActiveInterest('hiking')}/><InterestCard kind="cycling" label="骑行 · 日常节奏" title="骑行" text="骑行目前是短途与日常运动的一部分。速度不必很快、距离也不必很远；道路的变化、移动的节奏与迎面的风，足以让普通的一天变得更清醒。" onOpen={()=>setActiveInterest('cycling')}/><InterestCard kind="cube" label="魔方 · 空间思维" title="魔方" text="魔方让我在有限规则中观察不断变化的空间关系。拆解和复原既要记住局部变化，也要理解每一步对整体结构的影响，是一种可以触摸和验证的思维练习。" onOpen={()=>setActiveInterest('cube')}/></div></div></section>

    {activeInterest&&<motion.div className="interest-modal" initial={{opacity:0}} animate={{opacity:1}} role="dialog" aria-modal="true" onClick={()=>setActiveInterest(null)}><motion.div initial={{y:25,opacity:0}} animate={{y:0,opacity:1}} onClick={e=>e.stopPropagation()}><button onClick={()=>setActiveInterest(null)} aria-label="关闭"><X/></button><span>{interestDetails[activeInterest].label}</span><h3>{interestDetails[activeInterest].title}</h3><p>{interestDetails[activeInterest].text}</p></motion.div></motion.div>}    <section className="future section" id="future"><div className="future-horizon" aria-hidden="true"><i/><i/></div><p>下一坐标</p><h2>旅程仍在<br/><em>继续。</em></h2><div className="future-copy"><p>继续学习技术，探索科研，建立可靠的能力；也继续拍摄光影，走进自然。</p><p>不急于给未来一个宏大的结论。<br/>先让每一步真实发生。</p></div><div className="contact-links" aria-label="联系方式"><a href={`mailto:${profile.contact.email}`} aria-label={`发送邮件至 ${profile.contact.email}`}><Mail size={17}/><span>{profile.contact.email}</span><ArrowUpRight size={15}/></a><a href={profile.contact.bilibili} target="_blank" rel="noopener noreferrer" aria-label="哔哩哔哩个人主页"><Video size={17}/><span>哔哩哔哩主页</span><ArrowUpRight size={15}/></a><a href="../map/" aria-label="打开校园地图"><Map size={17}/><span>校园地图</span><ArrowUpRight size={15}/></a></div><a className="future-return" href="#top">返回起点 <ArrowUpRight size={15}/></a></section>
    <footer><span>{profile.name} / PORTFOLIO 2026</span><span>SHENZHEN / CHINA</span><VisitCounter/><span>BUILT FOR THE NEXT CHAPTER</span></footer>
  </main>
}

export default App






































