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
  top: { pos: [0.08, 7.4, 0.3], at: [0, 0.2, 0] },
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
      <directionalLight ref={sun} position={settings.position} intensity={settings.sunPower} color={settings.sun} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-camera-near={0.5} shadow-camera-far={30} shadow-bias={-0.00015} shadow-normalBias={0.02} />
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
      dummy.scale.set(p.size, p.size * 0.6, p.size)
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, seeds.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={pose === 'glance' ? '#d9b8e8' : '#f4b8c8'} transparent opacity={0.55} />
    </instancedMesh>
  )
}

function SakuraGrove({ photoMode }: { photoMode: boolean }) {
  const grove = useMemo(() => buildSakuraGrove([
    // 近景四棵
    { x: -3.4, z: -2.3, seed: 11, scale: 0.95 }, { x: 3.6, z: -2.7, seed: 27, scale: 1.05 },
    { x: -4.3, z: 1.7, seed: 43, scale: 0.9 }, { x: 0.8, z: -4.7, seed: 76, scale: 1 },
    // 远景一排（雾中层次，放大压住天际线）
    { x: -6.8, z: -4.6, seed: 112, scale: 1.45 }, { x: 6.9, z: -4.2, seed: 128, scale: 1.3 },
    { x: -7.6, z: 3.2, seed: 141, scale: 1.2 }, { x: 7.2, z: 4.4, seed: 156, scale: 1.5 },
    { x: 3.4, z: -7.4, seed: 169, scale: 1.35 }, { x: -3.1, z: -7.8, seed: 183, scale: 1.6 },
  ]), [])
  const foreground = useMemo(() => buildSakuraGrove([
    { x: 4.2, z: 2.0, seed: 58, scale: 0.85 },
    { x: -1.8, z: 4.4, seed: 91, scale: 0.8 },
  ]), [])
  useEffect(() => () => { grove.dispose(); foreground.dispose() }, [grove, foreground])
  return <group><primitive object={grove.group} /><primitive object={foreground.group} visible={!photoMode} /></group>
}

function SteppingStones() {
  const stones = useMemo(() => [
    { x: -0.22, z: 2.55 }, { x: 0.28, z: 3.05 }, { x: -0.1, z: 3.6 }, { x: 0.34, z: 4.15 }, { x: -0.05, z: 4.7 },
  ], [])
  return (
    <group>
      {stones.map((st, i) => (
        <mesh key={i} position={[st.x, 0.035, st.z]} rotation={[-Math.PI / 2, 0, i * 0.9]} castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.27, 0.05, 7]} />
          <meshStandardMaterial color="#8a8377" roughness={0.88} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function Torii() {
  return (
    <group position={[1.15, 0, -3.9]} rotation={[0, -0.22, 0]}>
      {[-0.62, 0.62].map(x => (
        <mesh key={x} position={[x, 0.95, 0]} castShadow>
          <cylinderGeometry args={[0.085, 0.1, 1.9, 10]} />
          <meshStandardMaterial color="#a8402f" roughness={0.72} />
        </mesh>
      ))}
      <mesh position={[0, 1.86, 0]} castShadow>
        <boxGeometry args={[1.78, 0.14, 0.2]} />
        <meshStandardMaterial color="#8f3425" roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.44, 0]} castShadow>
        <boxGeometry args={[1.42, 0.1, 0.14]} />
        <meshStandardMaterial color="#a8402f" roughness={0.72} />
      </mesh>
    </group>
  )
}

function Pond() {
  return (
    <group position={[3.5, 0, 2.5]} rotation={[0, -0.4, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <circleGeometry args={[0.92, 40]} />
        <meshStandardMaterial color="#2c454e" roughness={0.12} metalness={0.35} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 1.02, 0.05, Math.sin(a) * 1.02 * 0.92]} rotation={[0, a, 0]} scale={0.12 + (i % 3) * 0.03} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#6d6a62" roughness={0.9} flatShading />
          </mesh>
        )
      })}
      {[-0.25, 0.3].map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, i * 1.2]} position={[x, 0.035, i === 0 ? 0.15 : -0.2]}>
          <circleGeometry args={[0.14, 9]} />
          <meshStandardMaterial color="#4c6b45" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

function Fence() {
  return (
    <group position={[-2.35, 0, -3.35]} rotation={[0, 0.18, 0]}>
      {[-1.0, 0, 1.0].map(x => (
        <mesh key={x} position={[x, 0.34, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.68, 7]} />
          <meshStandardMaterial color="#5f4232" roughness={0.85} />
        </mesh>
      ))}
      {[0.28, 0.48].map(y => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <boxGeometry args={[2.25, 0.07, 0.055]} />
          <meshStandardMaterial color="#6b4a36" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

function Garden({ photoMode }: { photoMode: boolean }) {
  const props = useMemo(() => ({
    bushes: [
      { x: -2.3, z: 1.9, s: 0.42 }, { x: 2.4, z: 1.6, s: 0.36 }, { x: -2.8, z: -0.6, s: 0.3 },
      { x: 2.9, z: -0.9, s: 0.4 }, { x: 1.4, z: 2.8, s: 0.3 }, { x: -1.2, z: 3.0, s: 0.34 },
    ],
    stones: [
      { x: 1.9, z: 3.4, s: 0.22 }, { x: -3.1, z: 3.1, s: 0.16 }, { x: 5.0, z: 0.3, s: 0.19 },
    ],
  }), [])
  return (
    <group>
      <SakuraGrove photoMode={photoMode} />
      {props.bushes.map(b => (
        <mesh key={b.x + 'b' + b.z} position={[b.x, b.s * 0.55, b.z]} scale={[b.s, b.s * 0.75, b.s]} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#3f5340" roughness={0.95} flatShading />
        </mesh>
      ))}
      {props.stones.map((st, i) => (
        <mesh key={i} position={[st.x, st.s * 0.5, st.z]} rotation={[i * 0.7, i * 1.3, 0]} scale={st.s} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#6d6a62" roughness={0.9} flatShading />
        </mesh>
      ))}
      {/* 左前：石灯笼压住空角 */}
      <group position={[-3.6, 0, 2.9]} rotation={[0, 0.5, 0]}>
        <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.24, 0.3, 0.18, 6]} />
          <meshStandardMaterial color="#75716a" roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 0.5, 6]} />
          <meshStandardMaterial color="#807b73" roughness={0.88} flatShading />
        </mesh>
        <mesh position={[0, 0.78, 0]} castShadow>
          <boxGeometry args={[0.34, 0.3, 0.34]} />
          <meshStandardMaterial color="#e8c987" emissive="#c98f3d" emissiveIntensity={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.0, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[0.32, 0.24, 4]} />
          <meshStandardMaterial color="#6b675f" roughness={0.85} flatShading />
        </mesh>
        <pointLight position={[0, 0.78, 0]} color="#ffcf8a" intensity={1.6} distance={3} decay={2} />
      </group>
      {[-4.4, 2.0].map((z, i) => (
        <group key={i} position={[-4.15, 0, z]}>
          <mesh position={[0, 0.16, 0]} scale={[0.26, 0.18, 0.26]} castShadow>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#415542" roughness={0.95} flatShading />
          </mesh>
          {Array.from({ length: 5 }, (_, j) => {
            const a = j * 1.256 + i
            return (
              <mesh key={j} position={[Math.cos(a) * 0.2, 0.32, Math.sin(a) * 0.2]} scale={0.045} castShadow>
                <sphereGeometry args={[1, 8, 6]} />
                <meshStandardMaterial color={j % 2 ? '#f2b8c6' : '#fff1f4'} roughness={0.7} />
              </mesh>
            )
          })}
        </group>
      ))}
      <Torii />
      <Pond />
      <Fence />
      <SteppingStones />
    </group>
  )
}

function Stage({ pose, reduced, photoMode }: Pick<WorldProps, 'pose' | 'reduced' | 'photoMode'>) {
  const lamp = poses[pose].lamp
  return (
    <group>
      {/* 草地：外圈到雾里，内圈稍亮 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[11, 72]} />
        <meshStandardMaterial color="#41503c" roughness={0.96} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <circleGeometry args={[3.4, 64]} />
        <meshStandardMaterial color="#4b5c42" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]} receiveShadow>
        <circleGeometry args={[2.35, 48]} />
        <meshStandardMaterial color="#7c7568" roughness={0.9} />
      </mesh>
      {[0.78, 1.28, 1.78].map(r => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 0]}>
          <ringGeometry args={[r, r + 0.035, 56]} />
          <meshStandardMaterial color="#655f54" roughness={0.92} />
        </mesh>
      ))}
      <Garden photoMode={photoMode} />
      <mesh position={[0, 0.07, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.7, 1.86, 0.14, 72]} />
        <meshStandardMaterial color="#5c4e42" roughness={0.84} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.145, 0]}>
        <ringGeometry args={[1.42, 1.52, 64]} />
        <meshStandardMaterial color="#e2c07a" roughness={0.38} metalness={0.25} emissive="#a87830" emissiveIntensity={0.15} />
      </mesh>
      {([-1, 1] as const).map(side => (
        <group key={side} position={[side * 2.6, 0, -1.5]}>
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
      <Stage pose={props.pose} reduced={props.reduced} photoMode={props.photoMode} />
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
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: shots.overview.pos, fov: 36, near: 0.1, far: 40 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.toneMapping = T.ACESFilmicToneMapping; gl.toneMappingExposure = 1.06; gl.shadowMap.type = T.PCFShadowMap; gl.domElement.style.cursor = 'grab' }}>
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
