import type { RefObject } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import './DesignStory.css'

export type DesignTarget = 'overview' | 'tuft' | 'color' | 'cheer'

const ideas: { title: string; detail: string; link: string; target: DesignTarget }[] = [
  {
    title: '取狮之形',
    detail: '取狮子之形，喻狮子之神。狮子象征勇气、担当与领导力，圆润亲近的造型，让这份精神成为可以陪伴书院生活的日常形象。',
    link: '看完整造型', target: 'overview',
  },
  {
    title: '融入“新”意',
    detail: '形象中融入“新”字，指向“致新书院”的“致新”初心，也与南科大的创新基因相呼应。一个“新”字，寄托不断探索、向新而行的期待。',
    link: '看额前细节', target: 'tuft',
  },
  {
    title: '一身阳光橙',
    detail: '阳光向上的橙色与南科大的视觉标识相呼应，体现朝气蓬勃的精神，也象征书院学子乐观昂扬的风貌。温暖的色彩，让活力一眼可见。',
    link: '看整体配色', target: 'color',
  },
  {
    title: '细节有温度',
    detail: '原画中的白色手套以温润细腻的设计，传达友善、礼貌与包容的性格特质。狮子的勇敢之外，也藏着书院可亲、温暖的人文气质。',
    link: '和狮子打招呼', target: 'cheer',
  },
]

export default function DesignStory({ dialogRef, onExplore, onClose }: {
  dialogRef: RefObject<HTMLDialogElement | null>
  onExplore: (target: DesignTarget) => void
  onClose: () => void
}) {
  return (
    <dialog id="sz-design-dialog" ref={dialogRef} className="sz-design" aria-labelledby="sz-design-title" aria-describedby="sz-design-summary"
      onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close() }} onClose={onClose}>
      <header className="sz-design-header">
        <span>狮小新 IP <i /> 设计理念</span>
        <button autoFocus className="sz-icon" aria-label="关闭设计理念" onClick={() => dialogRef.current?.close()}><X size={20} /></button>
      </header>
      <div className="sz-design-scroll">
        <div className="sz-design-intro">
          <h2 id="sz-design-title">取狮子之形，<br />喻狮子之神。</h2>
          <div>
            <p id="sz-design-summary">以阳光向上的橙色为主，与南科大的视觉标识相呼应。狮子的勇敢、“致新”的初心与友善的细节，共同塑造一份朝气蓬勃的书院精神。</p>
            <div className="sz-design-palette" aria-label="原画主色：阳光橙与手套白"><span /><span /><small>阳光橙 · 手套白</small></div>
          </div>
        </div>
        <ol className="sz-design-ideas">
          {ideas.map((idea, index) => <li key={idea.target}>
            <span className="sz-design-number">0{index + 1}</span>
            <h3>{idea.title}</h3>
            <div><p>{idea.detail}</p><button onClick={() => onExplore(idea.target)}>{idea.link}<ArrowUpRight size={15} /></button></div>
          </li>)}
        </ol>
      </div>
      <footer className="sz-design-footer"><span>南方科技大学 · 致新书院</span><button onClick={() => dialogRef.current?.close()}>回到庭院<ArrowUpRight size={16} /></button></footer>
    </dialog>
  )
}
