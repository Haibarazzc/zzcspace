import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, ImagePlus, Moon, RefreshCcw, Sun } from 'lucide-react'
import type { Language } from '../data/translations'
import './SunsetColorLab.css'

type Theme = 'dark' | 'light'
type RGB = [number, number, number]
type PaletteColor = { rgb: RGB; hex: string; nameZh: string; nameEn: string }
type Analysis = { colors: PaletteColor[]; warmth: number; brightness: number; saturation: number; contrast: number; gradient: string }

const SAMPLE = '../photos/gallery-03.webp'
const toHex = ([r,g,b]:RGB) => `#${[r,g,b].map(value=>value.toString(16).padStart(2,'0')).join('').toUpperCase()}`
const distance = (a:RGB,b:RGB) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])

function hsv([r8,g8,b8]:RGB) {
  const r=r8/255,g=g8/255,b=b8/255,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min
  let h=0
  if(delta){if(max===r)h=60*(((g-b)/delta)%6);else if(max===g)h=60*((b-r)/delta+2);else h=60*((r-g)/delta+4)}
  if(h<0)h+=360
  return {h,s:max?delta/max:0,v:max}
}

function colorName(rgb:RGB) {
  const {h,s,v}=hsv(rgb)
  if(v<.24)return ['暮夜墨','Night Ink']
  if(s<.16&&v>.82)return ['云隙白','Cloud White']
  if(s<.2)return ['远山灰','Distant Grey']
  if(h<18||h>=345)return ['霞绯','Afterglow Red']
  if(h<43)return ['落日橙','Sunset Orange']
  if(h<72)return ['余晖金','Last-light Gold']
  if(h<165)return ['薄暮青','Twilight Green']
  if(h<215)return ['天际蓝','Horizon Blue']
  if(h<270)return ['深空蓝','Deep-sky Blue']
  if(h<320)return ['暮紫','Dusk Violet']
  return ['晚樱粉','Evening Pink']
}

function loadImage(src:string) {return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Unable to read this image'));image.src=src})}

async function analyzeImage(src:string):Promise<Analysis> {
  const image=await loadImage(src)
  const scale=Math.min(1,420/Math.max(image.naturalWidth,image.naturalHeight))
  const width=Math.max(1,Math.round(image.naturalWidth*scale)),height=Math.max(1,Math.round(image.naturalHeight*scale))
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Canvas is unavailable')
  context.drawImage(image,0,0,width,height)
  const pixels=context.getImageData(0,0,width,height).data
  const buckets=new Map<number,{count:number;r:number;g:number;b:number}>()
  let warm=0,total=0,brightness=0,brightnessSq=0,saturation=0
  for(let i=0;i<pixels.length;i+=16){
    if(pixels[i+3]<180)continue
    const rgb:RGB=[pixels[i],pixels[i+1],pixels[i+2]],key=((rgb[0]>>4)<<8)|((rgb[1]>>4)<<4)|(rgb[2]>>4)
    const bucket=buckets.get(key)||{count:0,r:0,g:0,b:0};bucket.count++;bucket.r+=rgb[0];bucket.g+=rgb[1];bucket.b+=rgb[2];buckets.set(key,bucket)
    const tone=hsv(rgb);warm+=((tone.h<=72||tone.h>=335)&&tone.s>.18)?1:0;brightness+=tone.v;brightnessSq+=tone.v*tone.v;saturation+=tone.s;total++
  }
  const selected:RGB[]=[]
  for(const bucket of [...buckets.values()].sort((a,b)=>b.count-a.count)){
    const rgb:RGB=[Math.round(bucket.r/bucket.count),Math.round(bucket.g/bucket.count),Math.round(bucket.b/bucket.count)]
    if(selected.every(color=>distance(color,rgb)>34))selected.push(rgb)
    if(selected.length===6)break
  }
  while(selected.length<6)selected.push(selected[selected.length-1]||[110,120,118])
  const colors=selected.map(rgb=>{const [nameZh,nameEn]=colorName(rgb);return{rgb,hex:toHex(rgb),nameZh,nameEn}})
  const mean=brightness/Math.max(total,1)
  return {colors,warmth:Math.round(warm/Math.max(total,1)*100),brightness:Math.round(mean*100),saturation:Math.round(saturation/Math.max(total,1)*100),contrast:Math.round(Math.sqrt(Math.max(0,brightnessSq/Math.max(total,1)-mean*mean))*100),gradient:`linear-gradient(112deg, ${colors.map(color=>color.hex).join(', ')})`}
}

export default function SunsetColorLab({language,theme,onClose,onToggleLanguage,onToggleTheme}:{language:Language;theme:Theme;onClose:()=>void;onToggleLanguage:()=>void;onToggleTheme:()=>void}) {
  const [source,setSource]=useState(SAMPLE),[filename,setFilename]=useState('gallery-03.webp'),[analysis,setAnalysis]=useState<Analysis|null>(null),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading')
  const objectUrl=useRef<string|null>(null),zh=language==='zh'
  const run=useCallback(async(src:string)=>{setStatus('loading');try{setAnalysis(await analyzeImage(src));setStatus('ready')}catch{setStatus('error')}},[])
  useEffect(()=>{run(source)},[source,run])
  useEffect(()=>()=>{if(objectUrl.current)URL.revokeObjectURL(objectUrl.current)},[])
  const choose=(file?:File)=>{if(!file)return;if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current=URL.createObjectURL(file);setFilename(file.name);setSource(objectUrl.current)}
  const reset=()=>{if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current=null;setFilename('gallery-03.webp');setSource(SAMPLE)}
  const downloadJson=()=>{if(!analysis)return;const blob=new Blob([JSON.stringify({source:filename,...analysis},null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='sunset-color-analysis.json';link.click();URL.revokeObjectURL(link.href)}
  const downloadCard=()=>{if(!analysis)return;const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=900;const context=canvas.getContext('2d');if(!context)return;context.fillStyle='#0B100D';context.fillRect(0,0,1440,900);context.fillStyle='#EEF3EF';context.font='52px sans-serif';context.fillText(zh?'晚霞色彩研究':'SUNSET COLOR STUDY',76,106);analysis.colors.forEach((color,index)=>{const x=76+index*210;context.fillStyle=color.hex;context.beginPath();context.roundRect(x,210,188,470,18);context.fill();context.fillStyle='#CFD9D2';context.font='23px monospace';context.fillText(color.hex,x,730)});context.fillStyle='#718579';context.font='20px monospace';context.fillText('LIGHT / COLOR / MEMORY',76,830);const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download='sunset-palette.png';link.click()}
  const scene=analysis?(analysis.warmth>58?(zh?'燃烧的金色时刻':'A burning golden hour'):analysis.warmth>34?(zh?'冷暖交汇的黄昏':'Where warm and cool meet'):(zh?'蓝调时刻的余光':'The last light of blue hour')):''
  return <main className="sunset-lab">
    <header className="sunset-lab-nav"><button onClick={onClose}><ArrowLeft size={16}/>{zh?'返回作品集':'Back to portfolio'}</button><span>SUNSET COLOR LAB</span><div><button onClick={onToggleTheme} aria-label={zh?'切换明暗模式':'Toggle theme'}>{theme==='dark'?<Sun size={15}/>:<Moon size={15}/>}</button><button onClick={onToggleLanguage}>{zh?'EN':'中文'}</button></div></header>
    <section className="sunset-lab-head"><p>LIGHT / COLOR / MEMORY</p><h1>{zh?'把天空，拆解成颜色。':'Turn the sky into a color language.'}</h1><span>{zh?'选择一张晚霞照片。所有计算都在你的浏览器中完成，图片不会上传。':'Choose a sunset. Every calculation stays inside your browser and the image is never uploaded.'}</span></section>
    <section className="sunset-lab-workspace"><div className="sunset-lab-image"><img src={source} alt={zh?'等待分析的晚霞照片':'Sunset selected for analysis'}/><label><ImagePlus size={18}/>{zh?'选择照片':'Choose image'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>choose(event.target.files?.[0])}/></label><button onClick={reset} aria-label={zh?'恢复示例':'Reset sample'}><RefreshCcw size={17}/></button><small>{filename}</small></div><aside className="sunset-lab-analysis">{status==='loading'&&<div className="sunset-lab-loading"><i/><span>{zh?'正在读取光线…':'Reading the light…'}</span></div>}{status==='error'&&<div className="sunset-lab-error">{zh?'无法读取这张图片，请换一张重试。':'This image could not be read. Please try another one.'}</div>}{analysis&&status==='ready'&&<><p>{zh?'场景判断':'SCENE READING'}</p><h2>{scene}</h2><div className="sunset-lab-metrics">{[[zh?'暖色':'Warmth',analysis.warmth],[zh?'明度':'Light',analysis.brightness],[zh?'饱和':'Saturation',analysis.saturation],[zh?'对比':'Contrast',analysis.contrast]].map(([label,value])=><div key={String(label)}><strong>{value}</strong><span>{label} / 100</span></div>)}</div><p className="sunset-lab-note">{zh?'这不是对照片好坏的评分，而是一张关于色彩倾向的观察记录。':'These values are observations of color, not a score of photographic quality.'}</p></>}</aside></section>
    {analysis&&<section className="sunset-lab-results"><div className="sunset-lab-result-head"><div><p>{zh?'提取色谱':'EXTRACTED PALETTE'}</p><h2>{zh?'六种主要颜色':'Six dominant colors'}</h2></div><div><button onClick={downloadCard}><Download size={15}/>{zh?'下载色卡':'Palette PNG'}</button><button onClick={downloadJson}><Download size={15}/>JSON</button></div></div><div className="sunset-lab-palette">{analysis.colors.map(color=><article key={color.hex} style={{backgroundColor:color.hex}}><b>{zh?color.nameZh:color.nameEn}</b><span>{color.hex}</span></article>)}</div><div className="sunset-lab-gradient"><div style={{background:analysis.gradient}}/><section><p>{zh?'天空渐变':'SKY GRADIENT'}</p><code>background: {analysis.gradient};</code></section></div></section>}
  </main>
}
