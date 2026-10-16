import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as T from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import LionModel from './LionModel'
import CourtyardGround from './CourtyardGround'
import CourtyardDetails from './CourtyardDetails'
import MountainLandscape from './MountainLandscape'
import MountainSky from './MountainSky'
import { buildSakuraGrove } from './sakuraGrove'
import { features, poses, type CameraShot, type PoseId, type ViewMode } from './data'

export type CaptureScene = () => Promise<HTMLCanvasElement>

export type WorldProps = {
  pose: PoseId
  shot: CameraShot
  selected: number
  auto: boolean
  reduced: boolean
  animated: boolean
  cheerRevision: number
  photoMode: boolean
  petRevision: number
  onSelect: (id: number) => void
  onPet: () => void
  onCaptureReady: (capture: CaptureScene | null) => void
  onManual: () => void
  onBearing: (degrees: number) => void
  onReady: () => void
}

const shots: Record<ViewMode, { pos: [number, number, number]; at: [number, number, number] }> = {
  overview: { pos: [3.4, 2.15, 8.4], at: [0, 1.45, 0] },
  front: { pos: [0, 1.65, 6.6], at: [0, 1.55, 0] },
  side: { pos: [6.6, 1.6, 0.12], at: [0, 1.55, 0] },
  top: { pos: [0.08, 10.4, 2.0], at: [0, 0.2, 0] },
}

const photoOverview = { pos: [2.2, 1.95, 6.4] as const, at: [0, 1.5, 0] as const }
const photoShots = { ...shots, overview: photoOverview }

function Cinema({ pose, onCaptureReady }: Pick<WorldProps, 'pose' | 'onCaptureReady'>) {
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
  useEffect(() => {
    let disposed = false
    const capture: CaptureScene = async () => {
      // Let the most recent pose/camera choice reach the scene before the
      // shutter samples it; the capture itself then runs without yielding.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      if (disposed) throw new Error('场景已关闭，请重新打开拍照模式。')
      if (gl.getContext().isContextLost()) throw new Error('三维场景暂时无法拍照，请重新载入后再试。')
      const width = 1440, height = 960
      const saved = {
        target: gl.getRenderTarget(), face: gl.getActiveCubeFace(), mip: gl.getActiveMipmapLevel(),
        viewport: gl.getViewport(new T.Vector4()), scissor: gl.getScissor(new T.Vector4()), scissorTest: gl.getScissorTest(),
        clearColor: gl.getClearColor(new T.Color()), clearAlpha: gl.getClearAlpha(),
        autoClear: gl.autoClear, autoClearColor: gl.autoClearColor, autoClearDepth: gl.autoClearDepth, autoClearStencil: gl.autoClearStencil,
        toneMapping: gl.toneMapping, exposure: gl.toneMappingExposure, colorSpace: gl.outputColorSpace,
      }
      // A separate, short-lived pipeline leaves the live preview's buffers,
      // camera and pixel ratio intact, including if rendering fails midway.
      const composer = new EffectComposer(gl)
      const bloom = new UnrealBloomPass(new T.Vector2(width, height), pipeline.bloom.strength, pipeline.bloom.radius, pipeline.bloom.threshold)
      const output = new OutputPass()
      const target = new T.WebGLRenderTarget(width, height, { type: T.UnsignedByteType, depthBuffer: false, stencilBuffer: false, colorSpace: T.NoColorSpace })
      let render: RenderPass | null = null
      try {
        scene.updateMatrixWorld(true)
        camera.updateWorldMatrix(true, false)
        if (camera instanceof T.PerspectiveCamera || camera instanceof T.OrthographicCamera) camera.updateProjectionMatrix()
        const captureCamera = camera.clone()
        camera.getWorldPosition(captureCamera.position)
        camera.getWorldQuaternion(captureCamera.quaternion)
        captureCamera.scale.set(1, 1, 1)
        if (captureCamera instanceof T.PerspectiveCamera) {
          captureCamera.aspect = width / height
          captureCamera.clearViewOffset()
          captureCamera.updateProjectionMatrix()
        } else if (captureCamera instanceof T.OrthographicCamera) {
          const center = (captureCamera.left + captureCamera.right) / 2
          const halfWidth = (captureCamera.top - captureCamera.bottom) / 2 * width / height
          captureCamera.left = center - halfWidth
          captureCamera.right = center + halfWidth
          captureCamera.clearViewOffset()
          captureCamera.updateProjectionMatrix()
        }
        captureCamera.updateMatrixWorld(true)
        render = new RenderPass(scene, captureCamera)
        composer.setPixelRatio(1)
        composer.setSize(width, height)
        composer.renderToScreen = false
        composer.addPass(render)
        composer.addPass(bloom)
        gl.setScissorTest(false)
        composer.render(0)
        // OutputPass applies the same ACES exposure and sRGB transfer as the
        // preview. The RGBA8 target stores those encoded bytes for canvas.
        output.renderToScreen = false
        output.render(gl, target, composer.readBuffer, 0, false)
        const pixels = new Uint8Array(width * height * 4)
        gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('当前浏览器无法生成照片，请稍后再试。')
        const image = context.createImageData(width, height)
        const stride = width * 4
        let hasColor = false
        for (let row = 0; row < height; row++) {
          const start = (height - row - 1) * stride
          image.data.set(pixels.subarray(start, start + stride), row * stride)
        }
        for (let i = 0; i < pixels.length && !hasColor; i += 4) hasColor = pixels[i] > 0 || pixels[i + 1] > 0 || pixels[i + 2] > 0
        if (!hasColor) throw new Error('照片暂时没有生成，请再拍一次。')
        context.putImageData(image, 0, 0)
        return canvas
      } finally {
        gl.setRenderTarget(saved.target, saved.face, saved.mip)
        gl.setViewport(saved.viewport)
        gl.setScissor(saved.scissor)
        gl.setScissorTest(saved.scissorTest)
        gl.setClearColor(saved.clearColor, saved.clearAlpha)
        gl.autoClear = saved.autoClear
        gl.autoClearColor = saved.autoClearColor
        gl.autoClearDepth = saved.autoClearDepth
        gl.autoClearStencil = saved.autoClearStencil
        gl.toneMapping = saved.toneMapping
        gl.toneMappingExposure = saved.exposure
        gl.outputColorSpace = saved.colorSpace
        target.dispose()
        render?.dispose()
        bloom.dispose()
        output.dispose()
        composer.dispose()
      }
    }
    onCaptureReady(capture)
    return () => { disposed = true; onCaptureReady(null) }
  }, [gl, scene, camera, pipeline, onCaptureReady])
  useFrame((_, dt) => {
    gl.toneMappingExposure = T.MathUtils.damp(gl.toneMappingExposure, poses[pose].exposure, 2, dt)
    pipeline.bloom.strength = T.MathUtils.damp(pipeline.bloom.strength, pose === 'cheer' ? 0.14 : pose === 'glance' ? 0.1 : 0.07, 2, dt)
    pipeline.composer.render(dt)
  }, 1)
  return null
}

function CameraRig({ shot, pose, auto, reduced, photoMode, onManual, onBearing }: Pick<WorldProps, 'shot' | 'pose' | 'auto' | 'reduced' | 'photoMode' | 'onManual' | 'onBearing'>) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size } = useThree()
  const destination = useRef(new T.Vector3(...shots.overview.pos))
  const target = useRef(new T.Vector3(...shots.overview.at))
  const moving = useRef(false)
  const lastBearing = useRef(0)
  const cameraPose = photoMode ? null : pose
  useEffect(() => {
    const framed = photoMode ? photoShots[shot.mode]
      : shot.focus !== null ? { pos: features[shot.focus].camera, at: features[shot.focus].point }
        : cameraPose === 'cheer' && shot.mode === 'overview' ? photoOverview : shots[shot.mode]
    const pos = new T.Vector3(...framed.pos)
    const at = new T.Vector3(...framed.at)
    if (!photoMode && size.width < 900) pos.sub(at).multiplyScalar(1.28).add(at)
    destination.current.copy(pos)
    target.current.copy(at)
    if (reduced || photoMode) {
      moving.current = false
      if (controls.current) {
        const damping = controls.current.enableDamping
        controls.current.autoRotate = false
        controls.current.enableDamping = false
        controls.current.update()
        camera.position.copy(pos)
        controls.current.target.copy(at)
        controls.current.update()
        controls.current.enableDamping = damping
      } else {
        camera.position.copy(pos)
        camera.lookAt(at)
        camera.updateMatrixWorld()
      }
    } else moving.current = true
  }, [shot, cameraPose, photoMode, camera, reduced, size.width, size.height])
  useFrame((_, dt) => {
    if (!controls.current) return
    controls.current.autoRotate = auto && !photoMode && !moving.current && !reduced && shot.focus === null
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
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.075} minDistance={1.7} maxDistance={12} minPolarAngle={0.18} maxPolarAngle={Math.PI / 2 + 0.035} autoRotateSpeed={0.55} rotateSpeed={0.65} zoomSpeed={0.75} onStart={() => { moving.current = false; onManual() }} target={[0, 1.4, 0]} />
}

function Atmosphere({ pose }: { pose: PoseId }) {
  const sun = useRef<T.DirectionalLight>(null)
  const fill = useRef<T.HemisphereLight>(null)
  const { scene } = useThree()
  const settings = poses[pose]
  const targetColor = useMemo(() => new T.Color(settings.background), [settings])
  const sunColor = useMemo(() => new T.Color(settings.sun), [settings])
  const sunPosition = useMemo(() => new T.Vector3(...settings.position), [settings])
  useEffect(() => { scene.background = new T.Color(settings.background); scene.fog = new T.Fog(settings.background, 14, 110); return () => { scene.fog = null } }, [scene])
  useFrame((_, dt) => {
    const colorBlend = 1 - Math.exp(-Math.min(dt, .05) * 2)
    if (!(scene.background instanceof T.Color)) scene.background = targetColor.clone()
    scene.background.lerp(targetColor, colorBlend)
    if (scene.fog) scene.fog.color.copy(scene.background as T.Color)
    if (sun.current) {
      sun.current.color.lerp(sunColor, colorBlend)
      sun.current.position.lerp(sunPosition, 1 - Math.exp(-dt * 1.7))
      sun.current.intensity = T.MathUtils.damp(sun.current.intensity, settings.sunPower, 2, dt)
    }
    if (fill.current) fill.current.intensity = T.MathUtils.damp(fill.current.intensity, settings.ambient, 2, dt)
  })
  return (
    <>
      <hemisphereLight ref={fill} args={['#ffe7c4', '#3a2c22', settings.ambient]} />
      <directionalLight ref={sun} position={settings.position} intensity={settings.sunPower} color={settings.sun} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-camera-near={0.5} shadow-camera-far={30} shadow-bias={-0.00015} shadow-normalBias={0.02} shadow-radius={2} />
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
  const seeds = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    a: (i / 28) * Math.PI * 2,
    r: 2.5 + (i % 6) * 0.38,
    y: (i / 28) * 3.8,
    speed: 0.16 + (i % 3) * 0.035,
    size: 0.022 + (i % 3) * 0.008,
  })), [])
  const geometry = useMemo(() => {
    const shape = new T.Shape()
    shape.moveTo(0, -0.55)
    shape.bezierCurveTo(-0.6, -0.12, -0.5, 0.6, -0.1, 0.44)
    shape.lineTo(0, 0.32); shape.lineTo(0.1, 0.44)
    shape.bezierCurveTo(0.5, 0.6, 0.6, -0.12, 0, -0.55)
    return new T.ShapeGeometry(shape, 3)
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const elapsed = useRef(0)
  useFrame((_, dt) => {
    if (!mesh.current) return
    if (!reduced) elapsed.current += Math.min(dt, 0.05)
    const t = elapsed.current
    seeds.forEach((p, i) => {
      const a = p.a + Math.sin(t * 0.19 + p.a) * 0.12
      const y = 0.1 + ((p.y - t * p.speed) % 3.8 + 3.8) % 3.8
      dummy.position.set(Math.cos(a) * p.r + Math.sin(t * 0.5 + p.a) * 0.2, y, Math.sin(a) * p.r * 0.8)
      dummy.rotation.set(t * 0.45 + p.a, t * 0.3 + p.a * 2, p.a + Math.sin(t * 0.7 + p.a))
      dummy.scale.setScalar(p.size)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, seeds.length]} frustumCulled={false} raycast={() => {}}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color={pose === 'glance' ? '#dfc4da' : '#f2cad1'} roughness={0.9} side={T.DoubleSide} />
    </instancedMesh>
  )
}

function SakuraGrove({ clearView }: { clearView: boolean }) {
  const grove = useMemo(() => buildSakuraGrove([
    // 近景四棵
    { x: -3.9, z: -2.5, seed: 11, scale: 0.95 }, { x: 4.4, z: -2.7, seed: 27, scale: 1.0 },
    { x: -5.8, z: 1.2, seed: 43, scale: 0.85 }, { x: 0.8, z: -4.7, seed: 76, scale: 1 },
    // 远景一排（雾中层次，放大压住天际线）
    { x: -6.8, z: -4.6, seed: 112, scale: 1.45, detail: 'far' }, { x: 6.9, z: -4.2, seed: 128, scale: 1.3, detail: 'far' },
    { x: -7.6, z: 3.2, seed: 141, scale: 1.2, detail: 'far' }, { x: 7.2, z: 4.4, seed: 156, scale: 1.5, detail: 'far' },
    { x: 3.4, z: -7.4, seed: 169, scale: 1.35, detail: 'far' }, { x: -3.1, z: -7.8, seed: 183, scale: 1.6, detail: 'far' },
  ]), [])
  const foreground = useMemo(() => buildSakuraGrove([
    { x: 6.7, z: 3.0, seed: 58, scale: 0.75 },
    { x: -6.4, z: 2.8, seed: 91, scale: 0.75 },
  ]), [])
  useEffect(() => () => { grove.dispose(); foreground.dispose() }, [grove, foreground])
  return <group><primitive object={grove.group} /><primitive object={foreground.group} visible={!clearView} /></group>
}

function Stage({ pose, reduced, animated, photoMode, clearView }: Pick<WorldProps, 'pose' | 'reduced' | 'animated' | 'photoMode'> & { clearView: boolean }) {
  const moving = animated && !reduced && !photoMode
  return (
    <group>
      <CourtyardGround />
      <SakuraGrove clearView={clearView} />
      <CourtyardDetails pose={pose} reduced={reduced || photoMode} animated={animated} />
      <Motes reduced={!moving} pose={pose} />
    </group>
  )
}

function FeaturePin({ selected, element }: { selected: number; element: RefObject<HTMLDivElement | null> }) {
  const point = useMemo(() => {
    const result = new T.Vector3(...features[selected].point)
    result.y += 0.35
    return result
  }, [selected])
  const projected = useMemo(() => new T.Vector3(), [])
  const { camera, size } = useThree()
  useFrame(() => {
    if (!element.current) return
    projected.copy(point).project(camera)
    element.current.style.visibility = projected.z < -1 || projected.z > 1 ? 'hidden' : 'visible'
    element.current.style.transform = `translate3d(${(projected.x + 1) * size.width / 2}px,${(1 - projected.y) * size.height / 2}px,0) translate(-50%,-50%)`
  })
  return null
}

function Scene(props: WorldProps & { pin: RefObject<HTMLDivElement | null> }) {
  return (
    <>
      <Atmosphere pose={props.pose} />
      <MountainSky pose={props.pose} />
      <MountainLandscape pose={props.pose} />
      <Stage pose={props.pose} reduced={props.reduced} animated={props.animated} photoMode={props.photoMode} clearView={props.photoMode || props.shot.focus !== null} />
      <Suspense fallback={null}>
        <LionModel pose={props.pose} reduced={props.reduced} animated={props.animated} cheerRevision={props.cheerRevision} petRevision={props.petRevision} onPet={props.onPet} photoPose={props.photoMode ? props.pose : null} onSelect={props.onSelect} onReady={props.onReady} />
      </Suspense>
      {!props.photoMode && <FeaturePin selected={props.selected} element={props.pin} />}
      <CameraRig shot={props.shot} pose={props.pose} auto={props.auto} reduced={props.reduced} photoMode={props.photoMode} onManual={props.onManual} onBearing={props.onBearing} />
      <Cinema pose={props.pose} onCaptureReady={props.onCaptureReady} />
    </>
  )
}

export default function World(props: WorldProps) {
  const pin = useRef<HTMLDivElement>(null)
  return (
    <>
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: shots.overview.pos, fov: 36, near: 0.1, far: 120 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.toneMapping = T.ACESFilmicToneMapping; gl.toneMappingExposure = 1.06; gl.shadowMap.type = T.PCFShadowMap; gl.domElement.style.cursor = 'grab' }}>
      <Scene {...props} pin={pin} />
    </Canvas>
    <div style={{ pointerEvents: 'none', zIndex: 5, display: props.photoMode ? 'none' : undefined }} aria-hidden="true">
      <div ref={pin} className="sz-pin" style={{ position: 'absolute', left: 0, top: 0 }}>
        <span>{String(props.selected + 1).padStart(2, '0')}</span>{features[props.selected].name}
      </div>
    </div>
    </>
  )
}
