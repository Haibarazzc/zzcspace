// 校园 3D 沙盘 v2：官方地图铺成桌面，建筑模型从真实坐标长出来。
// 树用低密度档只做点缀，不再淹没校园。
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as T from 'three'
import { PLACES, CATEGORIES, type Place } from './places'
import { buildSakuraGrove } from './grove'
import LionModel from '../shizi/LionModel'

const IMG_W = 2381, IMG_H = 3367 // 官方地图画布尺寸（地点坐标即其像素坐标）
const K = 0.2
export const toWorld = (px: number, py: number): [number, number] => [(px - IMG_W / 2) * K, (py - IMG_H / 2) * K]
const MAP_URL = '../map/map-v2.webp'

function hash(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

const HEIGHT: Record<string, number> = {
  academic: 8.5, life: 7, dining: 4.5, sports: 4, admin: 6, other: 3.5,
}

function MapGround() {
  const texture = useMemo(() => {
    const loader = new T.TextureLoader()
    const map = loader.load(MAP_URL)
    map.colorSpace = T.SRGBColorSpace
    map.anisotropy = 8
    return map
  }, [])
  const w = IMG_W * K, h = IMG_H * K
  return (
    <group>
      {/* 沙盘桌沿 */}
      <mesh position={[0, -1.6, 0]} receiveShadow>
        <boxGeometry args={[w + 26, 3, h + 26]} />
        <meshStandardMaterial color="#f4ecdc" roughness={0.85} />
      </mesh>
      {/* 官方地图 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={texture} roughness={0.95} />
      </mesh>
    </group>
  )
}

function useLabelTexture(text: string) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 56
    const ctx = canvas.getContext('2d')!
    ctx.font = '900 34px "PingFang SC","Microsoft YaHei",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 7
    ctx.strokeStyle = 'rgba(255,253,245,0.95)'
    ctx.strokeText(text, 128, 30)
    ctx.fillStyle = '#26333c'
    ctx.fillText(text, 128, 30)
    const texture = new T.CanvasTexture(canvas)
    texture.colorSpace = T.SRGBColorSpace
    return texture
  }, [text])
}

function Building({ place, index, active, hovered, onHover, onSelect }: {
  place: Place; index: number; active: boolean; hovered: boolean
  onHover: (i: number | null) => void; onSelect: (i: number) => void
}) {
  const meta = CATEGORIES[place.category] ?? CATEGORIES.other
  const [wx, wz] = toWorld(place.x, place.y)
  const h = hash(place.name)
  const isGate = place.name.includes('门')
  const isMetro = place.name === '长岭陂' || place.name === '塘朗'
  const baseH = (HEIGHT[place.category] ?? 3.5) + (h % 4) * 1.1
  const tall = isMetro ? 16 : baseH
  const wide = (place.category === 'sports' ? 13 : 7.5) + (h % 3) * 1.8
  const label = useLabelTexture(place.name)
  const showLabel = hovered || active

  const pick = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(index) }
  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(index) }
  const out = () => onHover(null)

  return (
    <group position={[wx, 0, wz]}>
      {isGate ? (
        <group onClick={pick} onPointerOver={over} onPointerOut={out}>
          {[-6, 6].map(sx => (
            <mesh key={sx} position={[sx, 5.5, 0]} castShadow>
              <boxGeometry args={[1.8, 11, 1.8]} />
              <meshStandardMaterial color="#8f6f52" roughness={0.75} />
            </mesh>
          ))}
          <mesh position={[0, 11.6, 0]} castShadow>
            <boxGeometry args={[16, 1.9, 2.4]} />
            <meshStandardMaterial color="#a8402f" roughness={0.7} />
          </mesh>
        </group>
      ) : isMetro ? (
        <mesh castShadow onClick={pick} onPointerOver={over} onPointerOut={out}>
          <cylinderGeometry args={[1.8, 2.1, tall, 8]} />
          <meshStandardMaterial color="#3f6fb5" roughness={0.5} />
        </mesh>
      ) : (
        <group onClick={pick} onPointerOver={over} onPointerOut={out}>
          {/* 奶油色墙体 + 分类色屋顶：建筑模型质感，颜色信息集中在屋顶 */}
          <mesh position={[0, tall / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[wide, tall, wide * 0.85]} />
            <meshStandardMaterial color="#fdf6e8" roughness={0.72} />
          </mesh>
          <mesh position={[0, tall + 0.4, 0]} castShadow>
            <boxGeometry args={[wide + 1.2, 1, wide * 0.85 + 1.2]} />
            <meshStandardMaterial
              color={meta.color}
              roughness={0.6}
              emissive={hovered || active ? meta.color : '#000000'}
              emissiveIntensity={hovered ? 0.55 : active ? 0.7 : 0}
            />
          </mesh>
          {place.category === 'academic' && (
            <mesh position={[0, tall + 1.5, 0]} castShadow>
              <boxGeometry args={[wide * 0.5, 1.6, wide * 0.4]} />
              <meshStandardMaterial color="#fdf6e8" roughness={0.72} />
            </mesh>
          )}
        </group>
      )}
      {showLabel && (
        <sprite position={[0, tall + 6.5, 0]} scale={[16, 3.5, 1]}>
          <spriteMaterial map={label} transparent depthTest={false} />
        </sprite>
      )}
    </group>
  )
}

function Trees() {
  const grove = useMemo(() => {
    // 只在几片绿地做点缀：小尺寸 + 低密度，不淹没校园
    const specs: Array<{ x: number; z: number; seed: number; scale?: number }> = []
    const clusters: Array<{ cx: number; cz: number; r: number; n: number }> = [
      { cx: 350, cz: 2650, r: 130, n: 6 },
      { cx: 860, cz: 2860, r: 90, n: 4 },
      { cx: 700, cz: 1500, r: 110, n: 4 },
    ]
    let i = 0
    for (const c of clusters) {
      for (let j = 0; j < c.n; j++) {
        const a = (j / c.n) * Math.PI * 2 + i
        const px = c.cx + Math.cos(a) * c.r * (0.5 + (j % 3) * 0.25)
        const pz = c.cz + Math.sin(a) * c.r * (0.5 + (j % 2) * 0.3)
        specs.push({ x: (px - IMG_W / 2) * K, z: (pz - IMG_H / 2) * K, seed: 41 + i * 7, scale: 0.5 + (i % 3) * 0.08 })
        i++
      }
    }
    return buildSakuraGrove(specs)
  }, [])
  useEffect(() => () => {
    grove.traverse(obj => {
      if (obj instanceof T.Mesh) obj.geometry.dispose()
      if (obj instanceof T.InstancedMesh) obj.dispose()
    })
  }, [grove])
  return <primitive object={grove} />
}

function GateLion() {
  const [gx, gz] = toWorld(849, 2962)
  return (
    <group position={[gx - 10, 0, gz + 8]} rotation={[0, Math.PI * 0.78, 0]} scale={0.4}>
      <LionModel pose="stand" reduced={false} selected={-1} onSelect={() => {}} />
    </group>
  )
}

function CameraRig({ focus, auto, onManual }: { focus: Place | null; auto: boolean; onManual: () => void }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()
  const target = useRef(new T.Vector3(0, 0, 0))
  const desired = useRef(new T.Vector3(0, 300, 360))
  const moving = useRef(false)
  useEffect(() => {
    if (focus) {
      const [wx, wz] = toWorld(focus.x, focus.y)
      target.current.set(wx, 4, wz)
      desired.current.set(wx + 26, 30, wz + 34)
      moving.current = true
    } else {
      target.current.set(0, 0, 0)
      desired.current.set(0, 300, 360)
      moving.current = true
    }
  }, [focus])
  useFrame((_, dt) => {
    if (!controls.current) return
    controls.current.autoRotate = auto && !moving.current
    if (moving.current) {
      const t = 1 - Math.exp(-dt * 2.6)
      camera.position.lerp(desired.current, t)
      controls.current.target.lerp(target.current, t)
      controls.current.update()
      if (camera.position.distanceTo(desired.current) < 1) moving.current = false
    }
  })
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08}
    minDistance={20} maxDistance={620} maxPolarAngle={1.35} autoRotateSpeed={0.4}
    onStart={() => { moving.current = false; onManual() }} target={[0, 0, 0]} />
}

export default function CampusWorld({ onSelect, onReady }: { onSelect: (p: Place) => void; onReady: () => void }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [auto, setAuto] = useState(false)
  useEffect(() => { onReady() }, [onReady])
  const choose = (i: number) => {
    setSelected(i)
    onSelect(PLACES[i])
  }
  const focus = selected !== null ? PLACES[selected] : null
  return (
    <div className="c3d-canvas" onPointerDown={() => setAuto(false)}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 300, 360], fov: 44, near: 1, far: 2400 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, camera }) => {
          gl.toneMapping = T.ACESFilmicToneMapping; gl.toneMappingExposure = 1.04; gl.shadowMap.type = T.PCFShadowMap
          // 调试钩子：地图像素坐标 → 屏幕坐标
          ;(window as any).__c3dProject = (pxw: number, pyw: number) => {
            const [x, z] = toWorld(pxw, pyw)
            const v = new T.Vector3(x, 6, z).project(camera)
            const r = gl.domElement.getBoundingClientRect()
            return { x: Math.round(r.left + (v.x + 1) / 2 * r.width), y: Math.round(r.top + (1 - v.y) / 2 * r.height), visible: v.z < 1 }
          }
        }}>
        <color attach="background" args={['#d8e7ec']} />
        <fog attach="fog" args={['#d8e7ec', 700, 1600]} />
        <hemisphereLight args={['#f2f8ff', '#58635a', 1.05]} />
        <directionalLight position={[200, 300, 160]} intensity={2.0} color="#fff5e2" castShadow
          shadow-mapSize={[2048, 2048]} shadow-camera-left={-340} shadow-camera-right={340}
          shadow-camera-top={360} shadow-camera-bottom={-360} shadow-camera-far={1000} shadow-bias={-0.0004} />
        <Suspense fallback={null}>
          <MapGround />
          <Trees />
          <GateLion />
          {PLACES.map((place, i) => (
            <Building key={place.name} place={place} index={i} active={selected === i} hovered={hovered === i}
              onHover={setHovered} onSelect={choose} />
          ))}
          <CameraRig focus={focus} auto={auto} onManual={() => setAuto(false)} />
        </Suspense>
      </Canvas>
      <button className={'c3d-orbit' + (auto ? ' on' : '')} onClick={() => setAuto(v => !v)}
        aria-pressed={auto} title="自动环绕">{auto ? '停止环绕' : '自动环绕'}</button>
    </div>
  )
}
