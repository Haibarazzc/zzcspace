// 校园 3D 沙盘场景：42 个地点按类别着色的积木校园 + 樱花树 + 狮小新守门。
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as T from 'three'
import { PLACES, CATEGORIES, type Place } from './places'
import { buildSakuraGrove } from '../shizi/sakuraGrove'
import LionModel from '../shizi/LionModel'

const K = 0.2 // 地图像素 → 世界单位
const CX = 1228, CZ = 2153
export const toWorld = (x: number, y: number): [number, number] => [(x - CX) * K, (y - CZ) * K]


function hash(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

const SIZE: Record<string, [number, number]> = {
  academic: [14, 13], life: [11, 16], dining: [9, 6], sports: [16, 5], admin: [12, 9], other: [8, 4],
}

function useLabelTexture(text: string, color = '#28323c') {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.font = '900 38px "PingFang SC","Microsoft YaHei",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 8
    ctx.strokeStyle = 'rgba(255,253,245,0.9)'
    ctx.strokeText(text, 128, 34)
    ctx.fillStyle = color
    ctx.fillText(text, 128, 34)
    const texture = new T.CanvasTexture(canvas)
    texture.colorSpace = T.SRGBColorSpace
    return texture
  }, [text, color])
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
  const [footprint, height] = SIZE[place.category] ?? SIZE.other
  const tall = isMetro ? 26 : height + (h % 5) * 1.6
  const wide = footprint + (h % 3) * 2
  const label = useLabelTexture(place.name)
  const color = active ? '#ffffff' : meta.color
  const labelY = tall + 7

  return (
    <group position={[wx, 0, wz]}>
      {isGate ? (
        // 校门：双柱 + 顶梁
        <group onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(index) }}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(index) }}
          onPointerOut={() => onHover(null)}>
          {[-8, 8].map(sx => (
            <mesh key={sx} position={[sx, 7, 0]} castShadow>
              <boxGeometry args={[2.2, 14, 2.2]} />
              <meshStandardMaterial color="#8f6f52" roughness={0.75} />
            </mesh>
          ))}
          <mesh position={[0, 14.5, 0]} castShadow>
            <boxGeometry args={[21, 2.4, 3]} />
            <meshStandardMaterial color="#a8402f" roughness={0.7} />
          </mesh>
          <mesh position={[0, 17.4, 0]} castShadow>
            <boxGeometry args={[16, 3.4, 0.6]} />
            <meshStandardMaterial color="#28323c" roughness={0.6} />
          </mesh>
        </group>
      ) : isMetro ? (
        // 地铁站：细高牌
        <mesh castShadow onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(index) }}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(index) }} onPointerOut={() => onHover(null)}>
          <cylinderGeometry args={[2.4, 2.8, tall, 8]} />
          <meshStandardMaterial color="#3f6fb5" roughness={0.5} />
        </mesh>
      ) : (
        <group onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(index) }}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(index) }}
          onPointerOut={() => onHover(null)}>
          <mesh position={[0, tall / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[wide, tall, wide * 0.82]} />
            <meshStandardMaterial
              color={color}
              roughness={0.68}
              emissive={hovered || active ? meta.color : '#000000'}
              emissiveIntensity={hovered ? 0.45 : active ? 0.6 : 0}
            />
          </mesh>
          <mesh position={[0, tall + 0.5, 0]} castShadow>
            <boxGeometry args={[wide + 1.6, 1.2, wide * 0.82 + 1.6]} />
            <meshStandardMaterial color="#fdf6e8" roughness={0.55} />
          </mesh>
          {/* 窗带 */}
          <mesh position={[0, tall * 0.55, wide * 0.82 / 2 + 0.05]}>
            <planeGeometry args={[wide * 0.7, tall * 0.5]} />
            <meshStandardMaterial color="#fdf6e8" roughness={0.3} transparent opacity={0.85} />
          </mesh>
        </group>
      )}
      <sprite position={[0, isGate ? 21 : labelY, 0]} scale={[15, 3.75, 1]}>
        <spriteMaterial map={label} transparent depthTest={false} />
      </sprite>
    </group>
  )
}

function Ground() {
  const spanX = (2173 - 284) * K, spanZ = (3279 - 1027) * K
  return (
    <group>
      <mesh position={[0, -2.2, 0]} receiveShadow>
        <boxGeometry args={[spanX + 90, 4, spanZ + 110]} />
        <meshStandardMaterial color="#6a7f60" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[spanX + 60, 1.6, spanZ + 80]} />
        <meshStandardMaterial color="#7c9274" roughness={0.95} />
      </mesh>
      {/* 两条主干道：南北（一号门→北端）与东西横路 */}
      {([
        { from: toWorld(849, 3050), to: toWorld(770, 1027), width: 14 },
        { from: toWorld(300, 2600), to: toWorld(2100, 2600), width: 12 },
        { from: toWorld(560, 1700), to: toWorld(1800, 1700), width: 10 },
      ] as Array<{ from: [number, number]; to: [number, number]; width: number }>).map((road, i) => {
        const [ax, az] = road.from, [bx, bz] = road.to
        const len = Math.hypot(bx - ax, bz - az), angle = Math.atan2(bx - ax, bz - az)
        return (
          <mesh key={i} position={[(ax + bx) / 2, 0.85, (az + bz) / 2]} rotation={[0, angle, 0]} receiveShadow>
            <boxGeometry args={[road.width, 0.2, len]} />
            <meshStandardMaterial color="#d8d2c2" roughness={0.92} />
          </mesh>
        )
      })}
      {/* 湖：湖畔生活区旁 */}
      <Lake />
    </group>
  )
}

function Lake() {
  const [lx, lz] = toWorld(950, 1991)
  return (
    <group position={[lx, 0, lz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.95, 0]}>
        <circleGeometry args={[22, 40]} />
        <meshStandardMaterial color="#5f8ba0" roughness={0.15} metalness={0.4} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 23, 1.4, Math.sin(a) * 23]} rotation={[i, i * 1.7, 0]} scale={2 + i % 3} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#8b8578" roughness={0.9} flatShading />
          </mesh>
        )
      })}
      {[0, 1, 2].map(i => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[Math.cos(i * 2.1) * 9, 1.05, Math.sin(i * 2.1) * 9]}>
          <circleGeometry args={[2.4, 9]} />
          <meshStandardMaterial color="#5c7d55" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

function Trees() {
  const grove = useMemo(() => {
    const specs: Array<{ x: number; z: number; seed: number; scale?: number }> = []
    const roads = [
      { from: toWorld(849, 3050), to: toWorld(770, 1027) },
      { from: toWorld(300, 2600), to: toWorld(2100, 2600) },
    ]
    let i = 0
    for (const road of roads) {
      const [ax, az] = road.from, [bx, bz] = road.to
      const count = 9
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count
        const px = ax + (bx - ax) * t, pz = az + (bz - az) * t
        const dx = bz - az, dz = -(bx - ax)
        const len = Math.hypot(dx, dz) || 1
        for (const side of [-1, 1]) {
          const x = px + (dx / len) * 13 * side
          const z = pz + (dz / len) * 13 * side
          const tooClose = PLACES.some(p => { const [wx, wz] = toWorld(p.x, p.y); return Math.hypot(wx - x, wz - z) < 22 })
          if (!tooClose) specs.push({ x, z, seed: 31 + i++ * 7, scale: 0.9 + (i % 4) * 0.12 })
        }
      }
    }
    return buildSakuraGrove(specs)
  }, [])
  useEffect(() => () => grove.dispose(), [grove])
  return <primitive object={grove.group} />
}

function GateLion() {
  const [gx, gz] = toWorld(849, 2962)
  return (
    <group position={[gx + 14, 1, gz + 10]} rotation={[0, Math.PI * 0.9, 0]} scale={0.62}>
      <LionModel pose="stand" reduced={false} selected={-1} onSelect={() => {}} />
    </group>
  )
}

function CameraRig({ focus, auto, onManual }: { focus: Place | null; auto: boolean; onManual: () => void }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()
  const target = useRef(new T.Vector3(0, 0, 0))
  const desired = useRef(new T.Vector3(0, 340, 430))
  const moving = useRef(false)
  useEffect(() => {
    if (focus) {
      const [wx, wz] = toWorld(focus.x, focus.y)
      target.current.set(wx, 6, wz)
      desired.current.set(wx + 40, 46, wz + 52)
      moving.current = true
    } else {
      target.current.set(0, 0, 0)
      desired.current.set(0, 340, 430)
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
      if (camera.position.distanceTo(desired.current) < 1.5) moving.current = false
    }
  })
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08}
    minDistance={28} maxDistance={620} maxPolarAngle={1.38} autoRotateSpeed={0.4}
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
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 340, 430], fov: 42, near: 1, far: 2200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { gl.toneMapping = T.ACESFilmicToneMapping; gl.toneMappingExposure = 1.02; gl.shadowMap.type = T.PCFShadowMap }}>
        <color attach="background" args={['#cfe3ea']} />
        <fog attach="fog" args={['#cfe3ea', 500, 1500]} />
        <hemisphereLight args={['#eaf4ff', '#4c5b48', 1.1]} />
        <directionalLight position={[180, 260, 140]} intensity={2.2} color="#fff3dc" castShadow
          shadow-mapSize={[2048, 2048]} shadow-camera-left={-320} shadow-camera-right={320}
          shadow-camera-top={320} shadow-camera-bottom={-320} shadow-camera-far={900} shadow-bias={-0.0004} />
        <Suspense fallback={null}>
          <Ground />
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
