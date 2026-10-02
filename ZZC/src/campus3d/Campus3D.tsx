import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { Compass, MapPin, X } from 'lucide-react'
import { CATEGORY_LIST } from './places'
import { PLACES, type Place } from './places'
import './Campus3D.css'

const World = lazy(() => import('./CampusWorld'))

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    const { children } = this.props
    return this.state.failed
      ? <div className="c3d-failed"><Compass size={34} /><h2>沙盘暂时搭不起来。</h2><p>三维场景未能启动，请启用浏览器硬件加速后重试，或先逛逛 <a href="/portfolio/map/">2D 交互地图</a>。</p><button onClick={() => location.reload()}>重新载入</button></div>
      : children
  }
}

const NOTE_KEY_BY_NAME = (p: Place) => p.name

export default function Campus3D() {
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<Place | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [notesState, setNotesState] = useState<'loading' | 'ready' | 'offline'>('loading')

  useEffect(() => {
    const previousTitle = document.title
    document.title = '南科大 3D 沙盘 · 校园地图'
    document.documentElement.lang = 'zh-CN'
    return () => { document.title = previousTitle }
  }, [])

  useEffect(() => {
    fetch('/api/map-notes')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const map: Record<string, string> = {}
        const places = data?.places
        if (Array.isArray(places)) {
          for (const item of places) {
            if (item && typeof item === 'object' && item.name && item.note) map[String(item.name)] = String(item.note)
          }
        }
        setNotes(map)
        setNotesState('ready')
      })
      .catch(() => setNotesState('offline'))
  }, [])

  const note = selected ? notes[NOTE_KEY_BY_NAME(selected)] : undefined

  return (
    <div className="c3d-page">
      <header className="c3d-header">
        <a className="c3d-back" href="/portfolio/">← 返回门户</a>
        <div className="c3d-title">
          <h1>南方科技大学 <span>3D 沙盘</span></h1>
          <p>42 处校园坐标 · 点击建筑查看与备注 · 拖拽旋转 / 滚轮缩放</p>
        </div>
        <a className="c3d-2d" href="/portfolio/map/">2D 交互地图 →</a>
      </header>

      <div className="c3d-legend">
        {CATEGORY_LIST.map(([key, meta]) => (
          <span key={key} className="c3d-chip"><i style={{ background: meta.color }} />{meta.label}</span>
        ))}
        <span className="c3d-chip subtle">{PLACES.length} 处</span>
      </div>

      <div className="c3d-stage">
        <SceneBoundary>
          <Suspense fallback={<div className="c3d-loading"><Compass size={30} className="spin" /><strong>正在铺设校园…</strong></div>}>
            {ready || true ? null : null}
            <World onReady={() => setReady(true)} onSelect={setSelected} />
          </Suspense>
        </SceneBoundary>
        {!ready && <div className="c3d-loading" aria-hidden="true"><Compass size={30} className="spin" /><strong>正在铺设校园…</strong></div>}

        {selected && (
          <aside className="c3d-card" role="dialog" aria-label={selected.name}>
            <button className="c3d-close" onClick={() => setSelected(null)} aria-label="关闭"><X size={16} /></button>
            <h2><MapPin size={16} />{selected.name}</h2>
            <span className="c3d-cat">{CATEGORY_LIST.find(([k]) => k === selected.category)?.[1].label ?? '其他'}</span>
            <p className="c3d-note">
              {notesState === 'loading' ? '备注加载中…'
                : note ? note
                : notesState === 'offline' ? '云端备注暂时连不上'
                : '还没有备注 —— 去 2D 地图记录一条（管理密码写入）'}
            </p>
            <a className="c3d-map-link" href="/portfolio/map/">在 2D 地图中查看 →</a>
          </aside>
        )}
      </div>

      <footer className="c3d-footer">
        <a href="/portfolio/shizi/">狮小新</a>
        <a href="/portfolio/qixia/">樱花古境</a>
        <a href="/portfolio/about/">认识曾子丞</a>
        <a href="/">返回主页</a>
      </footer>
    </div>
  )
}
