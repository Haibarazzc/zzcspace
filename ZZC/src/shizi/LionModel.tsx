import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { PoseId } from './data'
import markUrl from './zhixin-mark.jpg'

type Euler3 = readonly [number, number, number]
type PoseSpec = {
  yaw: number; head: Euler3; hop: number; tail: Euler3
  armL: Euler3; armR: Euler3; gloveL: Euler3; gloveR: Euler3
  legL: Euler3; legR: Euler3; kneeL: Euler3; kneeR: Euler3
  look: Euler3; brow: number; browTilt: number; mouth: number
}

const POSE: Record<PoseId, PoseSpec> = {
  stand: {
    yaw: 0, head: [0, 0, 0], hop: 0, look: [0, 0, 0], brow: 0.08, browTilt: 0, mouth: 1, tail: [0, 0, 0],
    armL: [-0.18, 0.04, -0.36], armR: [-0.18, -0.04, 0.36], gloveL: [0.4, 0.25, 0.12], gloveR: [0.4, -0.25, -0.12],
    legL: [0.05, 0, -0.05], legR: [0.05, 0, 0.05], kneeL: [0.16, 0, 0], kneeR: [0.16, 0, 0],
  },
  cheer: {
    yaw: 0, head: [-0.08, 0, 0], hop: 1, look: [-0.1, 0, 0], brow: -0.32, browTilt: 0, mouth: 1.24, tail: [-0.25, 0.25, 0.2],
    armL: [-0.22, 0.12, -2.42], armR: [-0.22, -0.12, 2.42], gloveL: [-0.25, 0.85, 0.4], gloveR: [-0.25, -0.85, -0.4],
    legL: [-1.2, 0.06, -0.16], legR: [0.1, 0, 0.05], kneeL: [1.45, 0, 0.08], kneeR: [0.32, 0, 0],
  },
  glance: {
    yaw: -0.8, head: [0.05, 0.95, 0.05], hop: 0, look: [0.04, 0.32, 0], brow: 0.02, browTilt: 0.38, mouth: 0.94, tail: [0.1, 0.85, 0.35],
    armL: [-0.16, 0, -0.26], armR: [-0.28, -0.08, 2.12], gloveL: [0.32, 0.2, 0.08], gloveR: [-0.2, -0.55, -0.18],
    legL: [0.04, 0, -0.04], legR: [0.16, 0, 0.07], kneeL: [0.18, 0, 0], kneeR: [0.38, 0, 0],
  },
}

const ORANGE = '#f6a01a'
const ORANGE_DEEP = '#ee8a16'
const CREAM = '#fff6ea'

function Glossy({ color, roughness = 0.36, vertexColors = false, emissive, emissiveIntensity = 0 }: { color: string; roughness?: number; vertexColors?: boolean; emissive?: string; emissiveIntensity?: number }) {
  return <meshPhysicalMaterial color={color} vertexColors={vertexColors} roughness={roughness} metalness={0} clearcoat={0.45} clearcoatRoughness={0.32} emissive={emissive ?? '#000000'} emissiveIntensity={emissiveIntensity} />
}

function paintGradient(geometry: T.BufferGeometry, bottom: string, top: string, yMin: number, yMax: number) {
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  const a = new T.Color(bottom), b = new T.Color(top), c = new T.Color()
  for (let i = 0; i < position.count; i++) {
    const t = T.MathUtils.smoothstep(position.getY(i), yMin, yMax)
    c.copy(a).lerp(b, t)
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3))
  return geometry
}

function dampEuler(group: T.Object3D | null, target: Euler3, speed: number, dt: number) {
  if (!group) return
  group.rotation.x = T.MathUtils.damp(group.rotation.x, target[0], speed, dt)
  group.rotation.y = T.MathUtils.damp(group.rotation.y, target[1], speed, dt)
  group.rotation.z = T.MathUtils.damp(group.rotation.z, target[2], speed, dt)
}

function useDisposable<G extends T.BufferGeometry>(factory: () => G, rev = 0) {
  const geometry = useMemo(factory, [rev])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

// One merged geometry: a ring of rounded lobes over a filler disc, tinted yellow at the crown and orange at the jaw.
function useManeGeometry() {
  return useDisposable(() => {
    const parts: T.BufferGeometry[] = []
    const lobes = 11
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2 + Math.PI / 2
      const radius = 0.72 + (i % 2) * 0.03
      const size = 0.36 + (i % 3) * 0.02
      const lobe = new T.SphereGeometry(size, 30, 22)
      lobe.scale(1, 1, 0.62)
      lobe.translate(Math.cos(a) * radius, Math.sin(a) * radius * 0.94, -0.04)
      parts.push(lobe)
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      const lobe = new T.SphereGeometry(0.3, 26, 18)
      lobe.scale(1, 1, 0.56)
      lobe.translate(Math.cos(a) * 0.5, Math.sin(a) * 0.5 * 0.92 + 0.02, -0.12)
      parts.push(lobe)
    }
    const filler = new T.SphereGeometry(0.82, 36, 24)
    filler.scale(1, 0.92, 0.34)
    filler.translate(0, 0, -0.1)
    parts.push(filler)
    const merged = mergeGeometries(parts, false)!
    parts.forEach(p => p.dispose())
    return paintGradient(merged, '#ee7f12', '#ffcc3a', -0.95, 0.75)
  })
}

// Flame-shaped forelock: a lathe profile bent slightly backwards toward the tip.
function useTuftGeometry() {
  return useDisposable(() => {
    const profile = [
      new T.Vector2(0.001, 0), new T.Vector2(0.13, 0.015), new T.Vector2(0.19, 0.1), new T.Vector2(0.2, 0.22),
      new T.Vector2(0.17, 0.36), new T.Vector2(0.11, 0.48), new T.Vector2(0.05, 0.57), new T.Vector2(0.001, 0.64),
    ]
    const geometry = new T.LatheGeometry(profile, 32)
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i), k = (y / 0.64) ** 2
      position.setX(i, position.getX(i) * (1 - k * 0.12) - k * 0.09)
      position.setZ(i, position.getZ(i) * 0.86 - k * 0.12)
    }
    geometry.computeVertexNormals()
    return paintGradient(geometry, '#f4a020', '#ffe34a', 0.02, 0.5)
  })
}

// Torso with a warm gradient: deeper orange at the haunches, brighter at the shoulders.
function useBodyGeometry() {
  return useDisposable(() => paintGradient(new T.SphereGeometry(1, 48, 36), '#e8840f', '#ffb43c', -1, 1))
}

// Slender tail that sweeps outward and up, ending in a spade-shaped tuft.
function useTailCurve() {
  return useMemo(() => new T.CatmullRomCurve3([
    new T.Vector3(0, 0, 0), new T.Vector3(0.18, -0.12, -0.16), new T.Vector3(0.42, -0.18, -0.2),
    new T.Vector3(0.66, -0.06, -0.12), new T.Vector3(0.78, 0.2, -0.02),
  ]), [])
}

function useEmblemTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const map = new T.CanvasTexture(canvas)
    map.colorSpace = T.SRGBColorSpace
    map.anisotropy = 8
    const image = new Image()
    image.onload = () => {
      const src = document.createElement('canvas')
      src.width = image.width
      src.height = image.height
      const source = src.getContext('2d')!
      source.drawImage(image, 0, 0)
      const data = source.getImageData(0, 0, src.width, src.height)
      const px = data.data
      let minX = src.width
      let minY = src.height
      let maxX = 0
      let maxY = 0
      for (let y = 0, i = 0; y < src.height; y++) {
        for (let x = 0; x < src.width; x++, i += 4) {
          const lum = Math.max(px[i], px[i + 1], px[i + 2])
          const t = T.MathUtils.smoothstep(lum, 28, 72)
          px[i] = px[i + 1] = px[i + 2] = 255
          px[i + 3] = Math.round(t * 255)
          if (t > 0.2) {
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
          }
        }
      }
      source.putImageData(data, 0, 0)
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const cropW = Math.max(1, maxX - minX)
      const cropH = Math.max(1, maxY - minY)
      const maxW = canvas.width * 0.96
      const maxH = canvas.height * 0.92
      const aspect = cropW / cropH
      let w = maxW
      let h = w / aspect
      if (h > maxH) {
        h = maxH
        w = h * aspect
      }
      ctx.drawImage(src, minX, minY, cropW, cropH, (canvas.width - w) / 2, (canvas.height - h) / 2 + canvas.height * 0.02, w, h)
      map.needsUpdate = true
    }
    image.src = markUrl
    return map
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function Emblem() {
  const texture = useEmblemTexture()
  return (
    <mesh position={[0, 0.9, 0.01]} scale={[0.53, 0.56, 0.47]}>
      <sphereGeometry args={[1, 64, 24, Math.PI / 2 - 0.78, 1.56, Math.PI / 2 - 0.42, 0.7]} />
      <meshStandardMaterial map={texture} transparent alphaTest={0.08} roughness={0.55} polygonOffset polygonOffsetFactor={-4} depthWrite={false} />
    </mesh>
  )
}

function Hit({ part, position, scale, onSelect }: { part: number; position: [number, number, number]; scale: [number, number, number]; onSelect: (id: number) => void }) {
  return (
    <mesh
      position={position}
      scale={scale}
      onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (event.delta < 6) onSelect(part) }}
      onPointerOver={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'grab' }}
    >
      <sphereGeometry args={[1, 10, 8]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function useFaceGeometry() {
  return useDisposable(() => {
    const geo = new T.SphereGeometry(1, 96, 72)
    const pos = geo.attributes.position
    const eyes = [new T.Vector3(-0.36, 0.22, 0.88), new T.Vector3(0.36, 0.22, 0.88)]
    const mouth = new T.Vector3(0, -0.5, 0.74)
    const nosePad = new T.Vector3(0, -0.14, 0.97)
    const cheeks = [new T.Vector3(-0.5, -0.2, 0.8), new T.Vector3(0.5, -0.2, 0.8)]
    const v = new T.Vector3()
    const orig = new T.Vector3()
    const cream = new T.Color('#fff6ea')
    const blush = new T.Color('#ef8582')
    const noseBrown = new T.Color('#7a3424')
    const tint = new T.Color()
    const colors = new Float32Array(pos.count * 3)
    const falloff = (d: number, radius: number) => {
      if (d >= radius) return 0
      const t = 1 - d / radius
      return t * t * (3 - 2 * t)
    }
    for (let i = 0; i < pos.count; i++) {
      orig.fromBufferAttribute(pos, i)
      v.copy(orig)
      let sink = 0
      for (const eye of eyes) sink += falloff(v.distanceTo(eye), 0.27) * 0.9
      const smileY = (v.y - mouth.y - Math.abs(v.x) * 0.2) / 0.4
      const smileX = v.x / 0.4
      sink += falloff(Math.hypot(smileX, smileY, (v.z - mouth.z) * 1.4), 1)
      const keep = Math.max(
        falloff(orig.distanceTo(nosePad), 0.26),
        falloff(orig.distanceTo(cheeks[0]), 0.24) * 0.7,
        falloff(orig.distanceTo(cheeks[1]), 0.24) * 0.7,
      )
      sink *= 1 - keep
      if (sink > 0) {
        v.z -= sink * 0.46
        v.multiplyScalar(Math.max(0.62, 1 - sink * 0.14))
      }
      const puff = Math.max(
        falloff(orig.distanceTo(cheeks[0]), 0.3),
        falloff(orig.distanceTo(cheeks[1]), 0.3),
      )
      if (puff > 0) v.addScaledVector(orig, puff * 0.06)
      const bump = orig.z > 0.55
        ? falloff(Math.hypot(orig.x / 0.14, (orig.y + 0.12) / 0.1), 1)
        : 0
      if (bump > 0) v.z += bump * 0.04
      pos.setXYZ(i, v.x, v.y, v.z)
      let blushAmt = 0
      for (const cheek of cheeks) blushAmt += falloff(orig.distanceTo(cheek), 0.23)
      tint.copy(cream).lerp(blush, Math.min(1, blushAmt * 1.2))
      if (bump > 0) tint.lerp(noseBrown, Math.min(1, bump * 1.6))
      colors[i * 3] = tint.r
      colors[i * 3 + 1] = tint.g
      colors[i * 3 + 2] = tint.b
    }
    geo.setAttribute('color', new T.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, 6)
}

function ToothBand() {
  const curve = useMemo(() => new T.CatmullRomCurve3([
    new T.Vector3(-0.16, 0.018, 0),
    new T.Vector3(-0.08, 0.04, 0),
    new T.Vector3(0, 0.05, 0),
    new T.Vector3(0.08, 0.04, 0),
    new T.Vector3(0.16, 0.018, 0),
  ]), [])
  return (
    <mesh position={[0, 0.01, 0.055]} scale={[1, 1, 0.42]} renderOrder={2}>
      <tubeGeometry args={[curve, 32, 0.016, 10, false]} />
      <meshPhysicalMaterial color="#fffdf8" roughness={0.32} clearcoat={0.35} clearcoatRoughness={0.35} polygonOffset polygonOffsetFactor={-4} depthWrite={false} />
    </mesh>
  )
}

function Eye({ x }: { x: number }) {
  return (
    <group position={[x, 0.1, 0.58]}>
      <mesh scale={[0.11, 0.13, 0.05]} castShadow>
        <sphereGeometry args={[1, 36, 28]} />
        <meshPhysicalMaterial color="#8a4524" roughness={0.18} clearcoat={1} clearcoatRoughness={0.08} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh position={[-0.028, 0.035, 0.04]} scale={[0.038, 0.046, 0.012]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#fffefb" />
      </mesh>
    </group>
  )
}

function Ear({ side }: { side: 1 | -1 }) {
  return (
    <group position={[side * 0.58, 0.28, 0.32]} rotation={[0.05, side * 0.4, side * -0.1]}>
      <mesh scale={[0.18, 0.18, 0.1]} castShadow>
        <sphereGeometry args={[1, 26, 18]} />
        <Glossy color={CREAM} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.005, 0.06]} scale={[0.1, 0.1, 0.04]}>
        <sphereGeometry args={[1, 20, 14]} />
        <Glossy color="#f3a7ad" roughness={0.55} />
      </mesh>
    </group>
  )
}

function Foot() {
  return (
    <group position={[0, -0.1, 0.06]}>
      {/* 脚掌与小腿重叠：掌心顶到腿胶囊底部，消除断缝 */}
      <mesh scale={[0.17, 0.1, 0.22]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <Glossy color={ORANGE_DEEP} roughness={0.4} />
      </mesh>
      {[-0.075, 0, 0.075].map(offset => (
        <mesh key={offset} position={[offset, -0.02, 0.175]} scale={[0.055, 0.05, 0.065]} castShadow>
          <sphereGeometry args={[1, 16, 12]} />
          <Glossy color={ORANGE} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function TailTuft({ hot }: { hot: boolean }) {
  const color = hot ? '#d8654a' : '#b2452f'
  return (
    <group rotation={[0.2, 0, 0.4]}>
      <mesh position={[-0.055, 0.05, 0]} scale={[0.075, 0.075, 0.06]} castShadow>
        <sphereGeometry args={[1, 18, 12]} />
        <Glossy color={color} roughness={0.42} />
      </mesh>
      <mesh position={[0.055, 0.05, 0]} scale={[0.075, 0.075, 0.06]} castShadow>
        <sphereGeometry args={[1, 18, 12]} />
        <Glossy color={color} roughness={0.42} />
      </mesh>
      <mesh position={[0, -0.03, 0]} rotation={[0, 0, Math.PI]} scale={[1, 1, 0.8]} castShadow>
        <coneGeometry args={[0.12, 0.16, 20]} />
        <Glossy color={color} roughness={0.42} />
      </mesh>
    </group>
  )
}

export default function LionModel({ pose, reduced, selected, onSelect }: { pose: PoseId; reduced: boolean; selected: number; onSelect: (id: number) => void }) {
  const root = useRef<T.Group>(null)
  const head = useRef<T.Group>(null)
  const armL = useRef<T.Group>(null)
  const armR = useRef<T.Group>(null)
  const legL = useRef<T.Group>(null)
  const legR = useRef<T.Group>(null)
  const kneeL = useRef<T.Group>(null)
  const kneeR = useRef<T.Group>(null)
  const tail = useRef<T.Group>(null)
  const mouth = useRef<T.Group>(null)
  const clock = useRef(0)
  const hop = useRef(0)
  const mane = useManeGeometry()
  const body = useBodyGeometry()
  const face = useFaceGeometry()
  const tuft = useTuftGeometry()
  const tailCurve = useTailCurve()
  const limb = selected === 4

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05)
    const spec = POSE[pose]
    const speed = reduced ? 18 : 4.4
    dampEuler(armL.current, spec.armL, speed, step)
    dampEuler(armR.current, spec.armR, speed, step)
    dampEuler(legL.current, spec.legL, speed, step)
    dampEuler(legR.current, spec.legR, speed, step)
    dampEuler(kneeL.current, spec.kneeL, speed, step)
    dampEuler(kneeR.current, spec.kneeR, speed, step)
    dampEuler(tail.current, spec.tail, speed, step)
    dampEuler(head.current, spec.head, speed, step)
    if (root.current) root.current.rotation.y = T.MathUtils.damp(root.current.rotation.y, spec.yaw, speed, step)
    hop.current = T.MathUtils.damp(hop.current, !reduced && spec.hop ? 1 : 0, 3, step)
    if (!reduced) clock.current += step
    const t = clock.current
    if (root.current) root.current.position.y = 0.16 + Math.sin(t * 1.6) * 0.006
    if (mouth.current) mouth.current.scale.y = T.MathUtils.damp(mouth.current.scale.y, spec.mouth, speed, step)
    if (tail.current && !reduced) tail.current.rotation.y += Math.sin(t * 2.1) * 0.002
  })

  return (
    <group ref={root} position={[0, 0.16, 0]}>
      <group ref={head} position={[0, 1.84, 0.02]}>
        <mesh geometry={mane} position={[0, 0.06, -0.16]} castShadow receiveShadow>
          <Glossy color={selected === 0 ? '#ffe9a8' : '#ffffff'} vertexColors roughness={0.34} />
        </mesh>
        <mesh geometry={tuft} position={[0, 0.56, 0.16]} rotation={[-0.12, 0, 0.05]} castShadow>
          <Glossy color={selected === 1 ? '#fff6c8' : '#ffffff'} vertexColors roughness={0.28} />
        </mesh>
        <mesh geometry={face} position={[0, -0.02, 0.2]} scale={[0.72, 0.62, 0.55]} castShadow>
          <Glossy color="#ffffff" vertexColors roughness={0.5} emissive={selected === 2 ? '#ffd8bf' : undefined} emissiveIntensity={selected === 2 ? 0.08 : 0} />
        </mesh>
        {([-1, 1] as const).flatMap(side => [-0.06, 0, 0.06].map(dy => (
          <mesh key={side + '' + dy} position={[side * 0.46, -0.16 + dy * 0.5, 0.6]} scale={0.013}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#d99a5e" roughness={0.6} />
          </mesh>
        )))}
        <Ear side={-1} />
        <Ear side={1} />
        <Eye x={-0.24} />
        <Eye x={0.24} />
        <mesh position={[0, -0.094, 0.772]} rotation={[0.14, 0, 0]} scale={[0.056, 0.04, 0.012]} castShadow>
          <sphereGeometry args={[1, 20, 14]} />
          <meshPhysicalMaterial color="#6b2e22" roughness={0.48} clearcoat={0.1} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
        <group ref={mouth} position={[0, -0.3, 0.56]}>
          <mesh position={[0, 0.01, -0.01]} scale={[0.36, 0.13, 0.05]}>
            <sphereGeometry args={[1, 28, 18]} />
            <meshStandardMaterial color="#5c2420" roughness={0.62} polygonOffset polygonOffsetFactor={-1} />
          </mesh>
          <ToothBand />
          <mesh position={[0, -0.035, 0.02]} rotation={[0.35, 0, 0]} scale={[0.24, 0.055, 0.04]} castShadow>
            <sphereGeometry args={[1, 28, 16]} />
            <meshPhysicalMaterial color="#e48b92" roughness={0.22} clearcoat={0.72} clearcoatRoughness={0.16} />
          </mesh>
          <mesh position={[0, -0.032, 0.038]} scale={[0.012, 0.04, 0.008]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#c96b74" roughness={0.4} />
          </mesh>
        </group>
      </group>

      <mesh position={[0, 1.3, 0.02]} scale={[0.34, 0.2, 0.3]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <Glossy color={ORANGE} />
      </mesh>
      <mesh geometry={body} position={[0, 0.86, 0]} scale={[0.52, 0.55, 0.46]} castShadow receiveShadow>
        <Glossy color="#ffffff" vertexColors emissive={selected === 3 ? '#ffcf8a' : undefined} emissiveIntensity={selected === 3 ? 0.1 : 0} />
      </mesh>
      {/* 奶白肚皮，托在院徽下方 */}
      <mesh position={[0, 0.74, 0.235]} scale={[0.34, 0.4, 0.26]} castShadow>
        <sphereGeometry args={[1, 36, 28]} />
        <Glossy color={CREAM} roughness={0.5} />
      </mesh>
      <Emblem />

      {([-1, 1] as const).map(side => (
        <group key={side} ref={side < 0 ? armL : armR} position={[side * 0.5, 1.12, 0.08]} rotation={[-0.18, side * -0.04, side * 0.36]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.105, 0.26, 8, 16]} />
            <Glossy color={limb ? '#ffb83c' : ORANGE} />
          </mesh>
          <mesh position={[0, -0.48, 0.03]} scale={[0.15, 0.13, 0.13]} castShadow>
            <sphereGeometry args={[1, 24, 18]} />
            <Glossy color="#fff7ef" roughness={0.42} />
          </mesh>
          <mesh position={[-side * 0.115, -0.445, 0.05]} scale={0.058} castShadow>
            <sphereGeometry args={[1, 16, 12]} />
            <Glossy color="#fff7ef" roughness={0.42} />
          </mesh>
        </group>
      ))}

      {([-1, 1] as const).map(side => (
        <group key={side} ref={side < 0 ? legL : legR} position={[side * 0.18, 0.42, 0.04]} rotation={[0.05, 0, side * 0.05]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <capsuleGeometry args={[0.115, 0.24, 6, 14]} />
            <Glossy color={limb ? '#ffb83c' : ORANGE} />
          </mesh>
          <mesh position={[0, -0.235, 0.015]} scale={[0.14, 0.08, 0.15]} castShadow>
            <sphereGeometry args={[1, 20, 14]} />
            <Glossy color={ORANGE} />
          </mesh>
          <group ref={side < 0 ? kneeL : kneeR} position={[0, -0.26, 0]}>
            <Foot />
          </group>
        </group>
      ))}

      <group ref={tail} position={[0.28, 0.72, -0.36]}>
        <mesh scale={[0.1, 0.09, 0.09]} castShadow>
          <sphereGeometry args={[1, 18, 14]} />
          <Glossy color={ORANGE_DEEP} />
        </mesh>
        <mesh castShadow>
          <tubeGeometry args={[tailCurve, 36, 0.045, 10, false]} />
          <Glossy color={ORANGE_DEEP} />
        </mesh>
        <group position={[0.8, 0.28, 0]}>
          <TailTuft hot={selected === 5} />
        </group>
        <Hit part={5} position={[0.78, 0.26, 0]} scale={[0.26, 0.28, 0.24]} onSelect={onSelect} />
      </group>

      <Hit part={0} position={[0, 1.9, -0.18]} scale={[1.12, 1.05, 0.5]} onSelect={onSelect} />
      <Hit part={1} position={[0, 2.72, 0.14]} scale={[0.28, 0.42, 0.26]} onSelect={onSelect} />
      <Hit part={2} position={[0, 1.78, 0.68]} scale={[0.58, 0.46, 0.26]} onSelect={onSelect} />
      <Hit part={3} position={[0, 0.98, 0.44]} scale={[0.36, 0.3, 0.18]} onSelect={onSelect} />
      <Hit part={4} position={[-0.72, 0.7, 0.16]} scale={[0.3, 0.5, 0.3]} onSelect={onSelect} />
      <Hit part={4} position={[0.72, 0.7, 0.16]} scale={[0.3, 0.5, 0.3]} onSelect={onSelect} />
      <Hit part={4} position={[0, 0.18, 0.14]} scale={[0.52, 0.26, 0.34]} onSelect={onSelect} />
    </group>
  )
}
