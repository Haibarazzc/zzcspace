import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, Lightformer, OrbitControls } from '@react-three/drei'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as T from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import LionModel from './LionModel'
import { features, poses, type CameraShot, type PoseId, type ViewMode } from './data'

export type WorldProps = {
  pose: PoseId
  shot: CameraShot
  selected: number
  auto: boolean
  reduced: boolean
  onSelect: (id: number) => void
  onManual: () => void
  onBearing: (degrees: number) => void
  onReady: () => void
}

const shots: Record<ViewMode, { pos: [number, number, number]; at: [number, number, number] }> = {
  overview: { pos: [2.7, 1.75, 6.5], at: [0, 1.55, 0] },
  front: { pos: [0, 1.65, 6.6], at: [0, 1.55, 0] },
  side: { pos: [6.6, 1.6, 0.12], at: [0, 1.55, 0] },
  top: { pos: [0.08, 7.4, 0.3], at: [0, 0.2, 0] },
}

function Cinema({ pose }: { pose: PoseId }) {
  const { gl, scene, camera, size } = useThree()
  const pipeline = useMemo(() => {
    const composer = new EffectComposer(gl)
    const render = new RenderPass(scene, camera)
    const bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.08, 0.4, 0.94)
    const output = new OutputPass()
    composer.addPass(render)
    composer.addPass(bloom)
    composer.addPass(output)
    return { composer, bloom, render, output }
  }, [gl, scene, camera])
  useEffect(() => { pipeline.composer.setSize(size.width, size.height) }, [pipeline, size])
  useEffect(() => () => { pipeline.composer.dispose(); pipeline.bloom.dispose(); pipeline.render.dispose(); pipeline.output.dispose() }, [pipeline])
  useFrame((_, dt) => {
    gl.toneMappingExposure = T.MathUtils.damp(gl.toneMappingExposure, poses[pose].exposure, 2, dt)
    pipeline.bloom.strength = T.MathUtils.damp(pipeline.bloom.strength, pose === 'cheer' ? 0.14 : pose === 'glance' ? 0.1 : 0.07, 2, dt)
    pipeline.composer.render(dt)
  }, 1)
  return null
}

function CameraRig({ shot, auto, reduced, onManual, onBearing }: Pick<WorldProps, 'shot' | 'auto' | 'reduced' | 'onManual' | 'onBearing'>) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size } = useThree()
  const destination = useRef(new T.Vector3(...shots.overview.pos))
  const target = useRef(new T.Vector3(...shots.overview.at))
  const moving = useRef(false)
  const lastBearing = useRef(0)
  useEffect(() => {
    const framed = shot.focus !== null
      ? { pos: features[shot.focus].camera, at: features[shot.focus].point }
      : shots[shot.mode]
    const pos = new T.Vector3(...framed.pos)
    const at = new T.Vector3(...framed.at)
    if (size.width < 900) pos.sub(at).multiplyScalar(1.28).add(at)
    destination.current.copy(pos)
    target.current.copy(at)
    if (reduced) {
      camera.position.copy(pos)
      controls.current?.target.copy(at)
      controls.current?.update()
    } else moving.current = true
  }, [shot, camera, reduced, size.width, size.height])
  useFrame((_, dt) => {
    if (!controls.current) return
    controls.current.autoRotate = auto && !moving.current && !reduced && shot.focus === null
    if (moving.current) {
      const t = 1 - Math.exp(-dt * 3.1)
      camera.position.lerp(destination.current, t)
      controls.current.target.lerp(target.current, t)
      controls.current.update()
      if (camera.position.distanceTo(destination.current) < 0.03) moving.current = false
    }
    const angle = Math.atan2(camera.position.x - controls.current.target.x, camera.position.z - controls.current.target.z) * 180 / Math.PI
    if (Math.abs(angle - lastBearing.current) > 1) { lastBearing.current = angle; onBearing(angle) }
  })
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.075} minDistance={1.7} maxDistance={12} minPolarAngle={0.18} maxPolarAngle={Math.PI / 2 + 0.08} autoRotateSpeed={0.55} rotateSpeed={0.65} zoomSpeed={0.75} onStart={() => { moving.current = false; onManual() }} target={[0, 1.4, 0]} />
}

function Atmosphere({ pose }: { pose: PoseId }) {
  const sun = useRef<T.DirectionalLight>(null)
  const fill = useRef<T.HemisphereLight>(null)
  const { scene } = useThree()
  const settings = poses[pose]
  const targetColor = useMemo(() => new T.Color(settings.background), [settings])
  const sunColor = useMemo(() => new T.Color(settings.sun), [settings])
  const sunPosition = useMemo(() => new T.Vector3(...settings.position), [settings])
  useEffect(() => { scene.background = new T.Color(settings.background); scene.fog = new T.Fog(settings.background, 9, 22); return () => { scene.fog = null } }, [scene])
  useFrame((_, dt) => {
    if (!(scene.background instanceof T.Color)) scene.background = targetColor.clone()
    scene.background.lerp(targetColor, 1 - Math.exp(-dt * 2))
    if (scene.fog) scene.fog.color.copy(scene.background as T.Color)
    if (sun.current) {
      sun.current.color.lerp(sunColor, dt * 2)
      sun.current.position.lerp(sunPosition, 1 - Math.exp(-dt * 1.7))
      sun.current.intensity = T.MathUtils.damp(sun.current.intensity, settings.sunPower, 2, dt)
    }
    if (fill.current) fill.current.intensity = T.MathUtils.damp(fill.current.intensity, settings.ambient, 2, dt)
  })
  return (
    <>
      <hemisphereLight ref={fill} args={['#ffe7c4', '#3a2c22', settings.ambient]} />
      <directionalLight ref={sun} position={settings.position} intensity={settings.sunPower} color={settings.sun} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-camera-near={0.5} shadow-camera-far={24} shadow-bias={-0.00015} shadow-normalBias={0.02} />
      <directionalLight position={[-3, 4, -2]} intensity={0.7} color="#ffd7a4" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#fff3dc" position={[0, 5, 4]} rotation={[-Math.PI / 3, 0, 0]} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#ffe2b8" position={[-6, 2, 1]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={0.7} color="#d8dcf0" position={[6, 1.5, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 3, 1]} />
        <mesh scale={40}><sphereGeometry args={[1, 16, 12]} /><meshBasicMaterial color="#2c241d" side={T.BackSide} /></mesh>
      </Environment>
    </>
  )
}

function Motes({ reduced, pose }: { reduced: boolean; pose: PoseId }) {
  const mesh = useRef<T.InstancedMesh>(null)
  const dummy = useMemo(() => new T.Object3D(), [])
  const seeds = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    a: (i / 16) * Math.PI * 2,
    r: 1.9 + (i % 4) * 0.22,
    y: 0.55 + (i % 5) * 0.32,
    speed: 0.12 + (i % 3) * 0.04,
    size: 0.012 + (i % 3) * 0.006,
  })), [])
  const elapsed = useRef(0)
  useFrame((_, dt) => {
    if (!mesh.current) return
    if (!reduced) elapsed.current += Math.min(dt, 0.05)
    const t = elapsed.current
    seeds.forEach((p, i) => {
      const a = p.a + t * p.speed
      dummy.position.set(Math.cos(a) * p.r, p.y + Math.sin(t * 0.8 + p.a) * 0.18, Math.sin(a) * p.r * 0.72)
      dummy.scale.setScalar(p.size)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, seeds.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={pose === 'glance' ? '#f0c48a' : '#ffe1a4'} transparent opacity={0.45} />
    </instancedMesh>
  )
}

function Stage({ pose, reduced }: { pose: PoseId; reduced: boolean }) {
  const lamp = poses[pose].lamp
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[3.6, 72]} />
        <meshStandardMaterial color="#4a4036" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.07, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.7, 1.86, 0.14, 72]} />
        <meshStandardMaterial color="#5c4e42" roughness={0.84} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.145, 0]}>
        <ringGeometry args={[1.42, 1.52, 64]} />
        <meshStandardMaterial color="#e2c07a" roughness={0.38} metalness={0.25} emissive="#a87830" emissiveIntensity={0.15} />
      </mesh>
      {([-1, 1] as const).map(side => (
        <group key={side} position={[side * 2.4, 0, -1.35]}>
          <mesh position={[0, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.075, 0.84, 8]} />
            <meshStandardMaterial color="#5a4332" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.98, 0]} castShadow>
            <boxGeometry args={[0.28, 0.32, 0.28]} />
            <meshStandardMaterial color="#f2c56a" emissive="#e8942a" emissiveIntensity={lamp} roughness={0.45} />
          </mesh>
          <mesh position={[0, 1.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.2, 0.16, 4]} />
            <meshStandardMaterial color="#6b4a32" roughness={0.6} />
          </mesh>
          <pointLight position={[0, 0.98, 0.1]} color="#ffc27a" intensity={pose === 'glance' ? 8 : pose === 'cheer' ? 5 : 2.2} distance={4.5} decay={2} />
        </group>
      ))}
      <Motes reduced={reduced} pose={pose} />
    </group>
  )
}

function Scene(props: WorldProps) {
  useEffect(() => { props.onReady() }, [props.onReady])
  return (
    <>
      <Atmosphere pose={props.pose} />
      <Stage pose={props.pose} reduced={props.reduced} />
      <LionModel pose={props.pose} reduced={props.reduced} selected={props.selected} onSelect={props.onSelect} />
      <Html position={[features[props.selected].point[0], features[props.selected].point[1] + 0.35, features[props.selected].point[2]]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="sz-pin"><span>{String(props.selected + 1).padStart(2, '0')}</span>{features[props.selected].name}</div>
      </Html>
      <CameraRig shot={props.shot} auto={props.auto} reduced={props.reduced} onManual={props.onManual} onBearing={props.onBearing} />
      <Cinema pose={props.pose} />
    </>
  )
}

export default function World(props: WorldProps) {
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: shots.overview.pos, fov: 36, near: 0.1, far: 40 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.toneMapping = T.ACESFilmicToneMapping; gl.toneMappingExposure = 1.06; gl.shadowMap.type = T.PCFShadowMap; gl.domElement.style.cursor = 'grab' }}>
      <Scene {...props} />
    </Canvas>
  )
}
