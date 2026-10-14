import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Camera, Download, Eye, LoaderCircle, MoveHorizontal, RotateCcw, Scan, Smile, Sparkles, Trees } from 'lucide-react'
import { poses, type PoseId, type ViewMode } from './data'
import { DEFAULT_BLESSING, makePostcard } from './postcard'
import './PostcardStudio.css'

export type PostcardStudioProps = {
  pose: PoseId
  viewMode: ViewMode
  reduced: boolean
  ready: boolean
  onPose: (pose: PoseId) => void
  onView: (mode: ViewMode) => void
  onCapture: () => Promise<HTMLCanvasElement>
  onClose: () => void
}

const poseChoices = [{ id: 'stand', Icon: Smile }, { id: 'cheer', Icon: Sparkles }, { id: 'glance', Icon: Eye }] as const
const viewChoices = [{ id: 'overview', label: '全景', Icon: Trees }, { id: 'front', label: '正面', Icon: Scan }, { id: 'side', label: '侧面', Icon: MoveHorizontal }] as const
const blessings = [{ label: '向光而生', text: DEFAULT_BLESSING }, { label: '一路向新', text: '一路向新，未来可期' }, { label: '心有热爱', text: '把热爱写进每一天' }]

export default function PostcardStudio({ pose, viewMode, reduced, ready, onPose, onView, onCapture, onClose }: PostcardStudioProps) {
  const [blessing, setBlessing] = useState(DEFAULT_BLESSING)
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const title = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)
  const resultUrl = useRef<string | null>(null)
  const inFlight = useRef(false)
  const request = useRef(0)
  const currentSettings = useRef('')
  currentSettings.current = `${pose}\n${viewMode}\n${blessing}`

  function discardResult() {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
    resultUrl.current = null
    setResult(null)
  }

  useEffect(() => {
    mounted.current = true
    title.current?.focus()
    return () => {
      mounted.current = false
      request.current += 1
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
      resultUrl.current = null
    }
  }, [])

  useEffect(() => {
    discardResult()
    setError('')
  }, [pose, viewMode, blessing])

  async function capture() {
    if (!ready || inFlight.current) return
    inFlight.current = true
    const id = ++request.current
    const settings = currentSettings.current
    setBusy(true)
    setError('')
    discardResult()
    try {
      const scene = await onCapture()
      const blob = await makePostcard(scene, blessing)
      if (!mounted.current || request.current !== id || currentSettings.current !== settings) return
      const url = URL.createObjectURL(blob)
      resultUrl.current = url
      setResult(url)
    } catch (reason) {
      if (mounted.current && request.current === id) setError(reason instanceof Error ? reason.message : '这一刻没有拍好，请再试一次。')
    } finally {
      if (mounted.current && request.current === id) {
        inFlight.current = false
        setBusy(false)
      }
    }
  }

  return <>
    <header className="sz-postcard-header">
      <div><span>SHIXIAOXIN · POSTCARD</span><h1 ref={title} tabIndex={-1}>庭院明信片</h1></div>
      <button className="sz-postcard-exit" onClick={onClose}><ArrowLeft size={16} />退出拍照</button>
    </header>

    <aside className="sz-postcard-editor" aria-label="明信片设置" aria-busy={busy}>
      <p className="sz-postcard-intro">选一个姿态，写一句祝福。<br />把狮小新和此刻的光一起留下。</p>
      <fieldset disabled={busy}>
        <legend><span>01</span>狮小新的姿态</legend>
        <div className="sz-postcard-choices">{poseChoices.map(({ id, Icon }) => <button key={id} type="button" aria-pressed={pose === id} onClick={() => { discardResult(); onPose(id) }}><Icon size={17} />{poses[id].label}</button>)}</div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend><span>02</span>取景角度</legend>
        <div className="sz-postcard-choices">{viewChoices.map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={viewMode === id} onClick={() => { discardResult(); onView(id) }}><Icon size={17} />{label}</button>)}</div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend><span>03</span>送给此刻的祝福</legend>
        <div className="sz-postcard-choices sz-postcard-blessings">{blessings.map(item => <button key={item.label} type="button" aria-pressed={blessing === item.text} onClick={() => setBlessing(item.text)}>{item.label}</button>)}</div>
        <label className="sz-postcard-input-label" htmlFor="sz-postcard-blessing">写一句祝福<span>{blessing.length}/24</span></label>
        <input id="sz-postcard-blessing" value={blessing} onChange={event => setBlessing(event.target.value)} maxLength={24} placeholder={DEFAULT_BLESSING} autoComplete="off" />
        <p className="sz-postcard-input-hint">这句话会印在明信片下方。</p>
      </fieldset>
    </aside>

    {result && <figure className="sz-postcard-result">
      <img src={result} alt={`狮小新庭院明信片，祝福：${blessing.trim() || DEFAULT_BLESSING}`} />
      <figcaption>明信片已生成，可以保存到设备。</figcaption>
    </figure>}

    <footer className="sz-postcard-footer" data-reduced={reduced} aria-busy={busy}>
      <div className={`sz-postcard-feedback${error ? ' sz-postcard-error' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite">{error || (result ? '这一刻，已经装进明信片。' : ready ? '拖动调整构图，留下这一刻。' : '庭院载入中，请稍候。')}</div>
      <div className="sz-postcard-actions">{result ? <>
        <button className="sz-postcard-secondary" onClick={discardResult}><RotateCcw size={17} />重拍</button>
        <a className="sz-postcard-primary" href={result} download="狮小新-庭院明信片.png"><Download size={18} />保存明信片</a>
      </> : <button className="sz-postcard-primary sz-postcard-shutter" onClick={() => void capture()} disabled={!ready || busy}>{busy ? <LoaderCircle className="sz-postcard-spinner" size={19} /> : <Camera size={19} />}{busy ? '正在制作…' : '拍下这一刻'}</button>}</div>
    </footer>
  </>
}
