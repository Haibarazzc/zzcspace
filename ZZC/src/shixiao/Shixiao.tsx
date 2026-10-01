import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as T from 'three'
import './Shixiao.css'

type PartId = 'mane' | 'forehead' | 'eyes' | 'shirt' | 'gloves' | 'tail'
type Part = { id: PartId; label: string; short: string; copy: string; point: [number, number, number]; camera: [number, number, number] }

const parts: Part[] = [
  { id: 'mane', label: '狮子之形', short: '鬃毛与勇气', copy: '取狮子之形，保留鬃毛向外舒展的轮廓。它象征勇气、担当与引领力，鼓励每个致新学子向前一步。', point: [0, 3.75, 0], camera: [0, 3.6, 5.8] },
  { id: 'forehead', label: '融入“新”字', short: '额前金色毛束', copy: '额前的金色毛束提炼出“新”的形态，回应致新书院的初心，也呼应南科大的创新基因。', point: [0, 4.32, .35], camera: [0, 4.2, 4.7] },
  { id: 'eyes', label: '朝气的表情', short: '明亮眼神', copy: '圆润的眼睛、上扬的嘴角和张开的笑容，让狮小新保持亲近、乐观和朝气蓬勃的第一印象。', point: [-.58, 3.35, 1.08], camera: [-.72, 3.32, 4.1] },
  { id: 'shirt', label: '色彩的精神密码', short: '阳光橙色', copy: '整体以阳光向上的橙色为主，与南科大标志互相呼应，象征书院学子乐观昂扬的精神风貌。', point: [0, 2.25, .62], camera: [0, 2.25, 3.7] },
  { id: 'gloves', label: '细节设计的精神内涵', short: '白色手套', copy: '白色手套以温润细腻的设计传递友善、礼貌和包容，给勇敢的狮子形象添上一点人文温度。', point: [-1.08, 2.45, .68], camera: [-1.45, 2.55, 3.85] },
  { id: 'tail', label: '活力的尾巴', short: '小小狮尾', copy: '弯曲的尾巴和心形尾尖让整体轮廓更有动感，也为吉祥物增加轻松、活泼的识别点。', point: [1.2, 1.45, -.22], camera: [2.1, 1.8, 4.1] },
]

function Mane({ selected }: { selected: PartId | null }) {
  const nodes = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const a = i / 14 * Math.PI * 2
    return { a, p: [Math.sin(a) * 1.18, 3.25 + Math.cos(a) * 1.1, Math.cos(a) * .22 - .03] as [number, number, number] }
  }), [])
  return <group>{nodes.map((n, i) => <mesh key={i} position={n.p} rotation={[0, n.a, 0]} castShadow><sphereGeometry args={[.72, 24, 16]} /><meshStandardMaterial color={selected === 'mane' ? '#ffb81f' : i % 2 ? '#ec8212' : '#f59b12'} roughness={.46} /></mesh>)}</group>
}

function Emblem() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#fff7df'; ctx.textAlign = 'center'
    ctx.font = 'bold 78px PingFang SC, Microsoft YaHei, sans-serif'; ctx.fillText('致新书院', 256, 112)
    ctx.font = '22px Arial, sans-serif'; ctx.fillText('ZHIXIN COLLEGE · SUSTECH', 256, 155)
    const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace; return map
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={[0, 2.23, 1.055]}><planeGeometry args={[.62, .31]} /><meshBasicMaterial map={texture} transparent depthWrite={false} /></mesh>
}

function Lion({ selected, onSelect }: { selected: PartId | null; onSelect: (id: PartId) => void }) {
  const group = useRef<T.Group>(null)
  const material = (color: string, roughness = .55) => <meshStandardMaterial color={color} roughness={roughness} />
  const hit = (id: PartId, position: [number, number, number], scale: [number, number, number]) => <mesh position={position} scale={scale} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(id) }}><sphereGeometry args={[1, 16, 12]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
  useFrame((_, dt) => { if (group.current) { group.current.rotation.y = T.MathUtils.damp(group.current.rotation.y, 0, 3, dt); group.current.position.y = Math.sin(performance.now() * .0012) * .035 } })
  return <group ref={group}>
    <Mane selected={selected} />
    <mesh position={[0, 3.27, .32]} scale={[1.08, .92, .65]} castShadow>{<sphereGeometry args={[1, 32, 24]} />}{material('#fff0df', .68)}</mesh>
    <mesh position={[0, 2.02, .4]} scale={[.9, 1.05, .64]} castShadow>{<capsuleGeometry args={[.58, .82, 16, 24]} />}{material(selected === 'shirt' ? '#ffb61d' : '#f49b0e', .5)}</mesh>
    <mesh position={[0, 3.93, .45]} scale={[.48, .7, .22]} rotation={[.08, 0, 0]} castShadow>{<sphereGeometry args={[1, 24, 16]} />}{material('#ffc215', .4)}</mesh>
    <mesh position={[0, 2.36, 1.02]} scale={[.52, .3, .13]}>{<sphereGeometry args={[1, 24, 16]} />}{material('#813827', .58)}</mesh>
    <mesh position={[0, 2.46, 1.1]} scale={[.3, .1, .05]}>{<sphereGeometry args={[1, 18, 10]} />}{material('#ffd0bf', .5)}</mesh>
    <mesh position={[0, 2.23, 1.08]} scale={[.42, .19, .08]}>{<torusGeometry args={[.8, .2, 12, 28, Math.PI]} />}{material('#6e2b26', .5)}</mesh>
    <mesh position={[0, 2.2, 1.17]} scale={[.26, .12, .05]}>{<sphereGeometry args={[1, 18, 10]} />}{material('#f28d83', .48)}</mesh>
    {[-.36, .36].map(x => <mesh key={x} position={[x, 3.02, 1.02]} scale={[.19, .1, .06]}>{<sphereGeometry args={[1, 16, 10]} />}{material('#f6b4a0', .6)}</mesh>)}
    {[-.44, .44].map(x => <group key={x}><mesh position={[x, 3.52, 1.0]} scale={[.24, .34, .13]} castShadow>{<sphereGeometry args={[1, 28, 18]} />}{material('#6d2c25', .38)}</mesh><mesh position={[x + .07, 3.64, 1.11]} scale={[.06, .09, .025]}>{<sphereGeometry args={[1, 12, 8]} />}{material('#fff7ec', .3)}</mesh></group>)}
    {[-.82, .82].map(x => <group key={x}><mesh position={[x, 3.43, .38]} scale={[.28, .34, .16]} castShadow>{<sphereGeometry args={[1, 24, 16]} />}{material('#ffe9d8', .55)}</mesh><mesh position={[x, 3.43, .55]} scale={[.13, .18, .045]}>{<sphereGeometry args={[1, 16, 10]} />}{material('#e79883', .5)}</mesh></group>)}
    <Emblem />
    {[-1, 1].map(side => <group key={side}><mesh position={[side * 1.08, 2.45, .38]} rotation={[0, 0, side * -.25]} castShadow><capsuleGeometry args={[.22, .72, 14, 20]} />{material('#f29a0c', .48)}</mesh><mesh position={[side * 1.1, 2.08, .48]} scale={[.37, .28, .34]} castShadow>{<sphereGeometry args={[1, 24, 16]} />}{material(selected === 'gloves' ? '#fffdf7' : '#f7f3ee', .35)}</mesh>{[-.1, 0, .1].map(offset => <mesh key={offset} position={[side * 1.1 + offset, 2.0, .79]} scale={[.05, .08, .04]}>{<sphereGeometry args={[1, 12, 8]} />}{material('#dedbd5', .45)}</mesh>)}</group>)}
    {[-.4, .4].map(x => <group key={x}><mesh position={[x, 1.12, .52]} scale={[.28, .6, .34]} castShadow>{<capsuleGeometry args={[.21, .45, 14, 18]} />}{material('#f19a0c', .52)}</mesh>{[-.1, 0, .1].map(offset => <mesh key={offset} position={[x + offset, .81, .72]} scale={[.06, .1, .05]}>{<sphereGeometry args={[1, 12, 8]} />}{material('#d87312', .5)}</mesh>)}</group>)}
    <group position={[1.05, 1.45, -.1]} rotation={[0, 0, -.18]}><mesh rotation={[0, .25, 0]} castShadow><tubeGeometry args={[new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(.5, .15, 0), new T.Vector3(.9, .62, .05)]), 20, .1, 10, false]} />{material('#d87312', .5)}</mesh><mesh position={[.95, .65, .05]} rotation={[0, 0, -.4]} castShadow>{<sphereGeometry args={[.25, 18, 12]} />}{material('#b65445', .5)}</mesh></group>
    {hit('mane', [0, 3.85, 0], [1.9, 1.6, .8])}{hit('forehead', [0, 4.15, .7], [.65, .8, .42])}{hit('eyes', [0, 3.35, 1.03], [1.15, .52, .28])}{hit('shirt', [0, 2.05, .75], [1.25, 1.25, .7])}{hit('gloves', [-1.08, 2.08, .5], [.5, .55, .45])}{hit('tail', [1.45, 1.62, -.02], [.8, .8, .55])}
  </group>
}

function Camera({ selected, auto, reduced }: { selected: PartId | null; auto: boolean; reduced: boolean }) {
  const controls = useRef<any>(null); const { camera } = useThree(); const target = useRef(new T.Vector3(0, 2.6, 0)); const position = useRef(new T.Vector3(0, 2.8, 10))
  useEffect(() => { const p = selected ? parts.find(x => x.id === selected)! : null; const nextPosition = (p ? p.camera : [0, 2.8, 10]) as [number, number, number]; const nextTarget = (p ? p.point : [0, 2.6, 0]) as [number, number, number]; position.current.set(...nextPosition); target.current.set(...nextTarget); if (reduced) { camera.position.copy(position.current); controls.current?.target.copy(target.current); controls.current?.update() } }, [selected, camera, reduced])
  useFrame((_, dt) => { if (!controls.current) return; camera.position.lerp(position.current, 1 - Math.exp(-dt * 3.2)); controls.current.target.lerp(target.current, 1 - Math.exp(-dt * 3.2)); controls.current.autoRotate = auto && !selected && !reduced; controls.current.update() })
  return <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={.08} minDistance={3.1} maxDistance={12} minPolarAngle={.35} maxPolarAngle={Math.PI / 2 + .1} rotateSpeed={.6} />
}

function Scene({ selected, onSelect, auto, reduced }: { selected: PartId | null; onSelect: (id: PartId) => void; auto: boolean; reduced: boolean }) {
  return <Canvas shadows dpr={[1, 1.6]} camera={{ position: [0, 2.8, 10], fov: 42 }} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.toneMapping = T.ACESFilmicToneMapping; gl.toneMappingExposure = 1.15 }}>
    <color attach="background" args={['#151922']} /><fog attach="fog" args={['#151922', 9, 18]} />
    <ambientLight intensity={1.4} color="#ffecd8" /><directionalLight castShadow position={[-4, 7, 5]} intensity={4.2} color="#ffd29a" shadow-mapSize={[2048, 2048]} /><pointLight position={[3, 2, 4]} intensity={18} distance={10} color="#ff9f30" />
    <Lion selected={selected} onSelect={onSelect} /><ContactShadows position={[0, .42, 0]} opacity={.48} scale={5.5} blur={2.4} far={4} />
    <Camera selected={selected} auto={auto} reduced={reduced} />
  </Canvas>
}

export default function Shixiao() {
  const [selected, setSelected] = useState<PartId | null>(null); const [auto, setAuto] = useState(false); const [reduced, setReduced] = useState(false); const [showOriginal, setShowOriginal] = useState(false)
  const active = parts.find(p => p.id === selected) ?? null
  useEffect(() => { const q = matchMedia('(prefers-reduced-motion: reduce)'); setReduced(q.matches); const fn = () => setReduced(q.matches); q.addEventListener('change', fn); document.title = '狮小新 · 致新书院吉祥物'; return () => q.removeEventListener('change', fn) }, [])
  const choose = (id: PartId) => { setSelected(id); setAuto(false) }
  return <main className="sx-page"><div className="sx-grid" /><header className="sx-header"><a className="sx-mark" href="/">ZZCSPACE <span>/ IP ARCHIVE</span></a><a className="sx-back" href="/">返回主站</a></header><section className="sx-hero"><div className="sx-copy"><p className="sx-kicker">致新书院吉祥物设计</p><h1>狮小新<br /><em>IP 形象</em></h1><p className="sx-lead">点选身体部位，靠近看见一只狮子的勇气、友善和朝气。</p><div className="sx-rule" /><p className="sx-hint">拖拽旋转 · 滚轮缩放 · 点击探索</p></div><div className="sx-canvas"><Scene selected={selected} onSelect={choose} auto={auto} reduced={reduced} /><div className="sx-canvas-label">可交互三维模型 <span>SHIXIAOXIN / 01</span></div>{parts.map(p => <button key={p.id} className={`sx-hotspot sx-hotspot-${p.id}${selected === p.id ? ' is-active' : ''}`} onClick={() => choose(p.id)} aria-label={`查看${p.label}`}><i />{p.short}</button>)}</div></section><aside className={`sx-info${active ? ' is-open' : ''}`}>{active ? <><button className="sx-close" onClick={() => setSelected(null)} aria-label="关闭介绍">×</button><p className="sx-info-index">{String(parts.findIndex(p => p.id === active.id) + 1).padStart(2, '0')} / 06</p><h2>{active.label}</h2><p className="sx-info-copy">{active.copy}</p><button className="sx-next" onClick={() => choose(parts[(parts.findIndex(p => p.id === active.id) + 1) % parts.length].id)}>下一个部位 <span>↗</span></button></> : <><p className="sx-info-index">01 / 06</p><h2>认识狮小新的<br />每一处细节</h2><p className="sx-info-copy">从鬃毛到白手套，六个可点击部位对应 PPT 第 5 页的设计寓意。选择一个标记，让镜头靠近。</p><button className="sx-next" onClick={() => choose('mane')}>从鬃毛开始 <span>↗</span></button></>}</aside><button className="sx-reference-toggle" onClick={() => setShowOriginal(v => !v)} aria-pressed={showOriginal}>原图参考</button>{showOriginal && <aside className="sx-reference"><button className="sx-close" onClick={() => setShowOriginal(false)} aria-label="关闭原图">×</button><p>原图对照</p><img src="/shixiao-board.png" alt="狮小新初始设计、表情设计、三视图和三维立体展示原图" /></aside>}<nav className="sx-controls"><button onClick={() => setAuto(v => !v)} aria-pressed={auto}>{auto ? '暂停环绕' : '自动环绕'}</button><button onClick={() => { setSelected(null); setAuto(false) }}>重置视角</button></nav><footer className="sx-footer"><span>狮小新 IP 形象的建立</span><span>源自《狮小新IP与运营》PPT 第 4-5 页</span></footer></main>
}
