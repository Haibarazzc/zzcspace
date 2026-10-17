/** Rainy konbini corner — renderer, lighting, camera and the small loops that
 *  keep the model alive: auto door, flickering signs, traffic light, weather. */
import {
  ACESFilmicToneMapping,
  BackSide,
  CanvasTexture,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { buildBase } from './base'
import { buildInterior } from './interior'
import { buildProps } from './props'
import { buildStore } from './store'
import { buildWeather } from './weather'

/** Vertical night-sky gradient wrapped on a big cylinder behind the model. */
function makeBackdrop(): Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 512)
  g.addColorStop(0, '#2b3c66')
  g.addColorStop(0.2, '#31446f')
  g.addColorStop(0.36, '#3b4d7a')
  g.addColorStop(0.46, '#4a5786')
  g.addColorStop(0.5, '#5c648c')
  g.addColorStop(0.53, '#3c3a54')
  g.addColorStop(0.6, '#1c1d2c')
  g.addColorStop(1, '#0a0b12')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 8, 512)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const geo = new SphereGeometry(90, 32, 24)
  const mesh = new Mesh(
    geo,
    new MeshBasicMaterial({ map: tex, side: BackSide, depthWrite: false, fog: false, toneMapped: false }),
  )
  return mesh
}

function makeEnvironment(renderer: WebGLRenderer) {
  const w = 512
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#070b16')
  sky.addColorStop(0.38, '#121b30')
  sky.addColorStop(0.47, '#2b3350')
  sky.addColorStop(0.5, '#5a4a58')
  sky.addColorStop(0.54, '#392c3c')
  sky.addColorStop(0.75, '#120f1a')
  sky.addColorStop(1, '#050409')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  // a band of distant windows / city glow right at the horizon
  const glow = ctx.createLinearGradient(0, h * 0.46, 0, h * 0.6)
  glow.addColorStop(0, 'rgba(255,186,120,0)')
  glow.addColorStop(0.5, 'rgba(255,186,120,0.34)')
  glow.addColorStop(1, 'rgba(255,186,120,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, h * 0.46, w, h * 0.14)
  for (let i = 0; i < 130; i++) {
    const x = Math.random() * w
    const y = h * 0.455 + Math.random() * h * 0.1
    const warm = Math.random() < 0.7
    ctx.fillStyle = warm
      ? `rgba(255,${190 + Math.random() * 40},${130 + Math.random() * 50},${0.18 + Math.random() * 0.4})`
      : `rgba(${150 + Math.random() * 60},${200 + Math.random() * 40},255,${0.12 + Math.random() * 0.3})`
    ctx.fillRect(x, y, 2 + Math.random() * 6, 1 + Math.random() * 2)
  }
  // wet pavement bounce
  const bounce = ctx.createLinearGradient(0, h * 0.62, 0, h)
  bounce.addColorStop(0, 'rgba(120,90,80,0.18)')
  bounce.addColorStop(1, 'rgba(10,8,14,0)')
  ctx.fillStyle = bounce
  ctx.fillRect(0, h * 0.62, w, h * 0.38)

  const tex = new CanvasTexture(canvas)
  tex.mapping = EquirectangularReflectionMapping
  tex.colorSpace = SRGBColorSpace
  const pmrem = new PMREMGenerator(renderer)
  const target = pmrem.fromEquirectangular(tex)
  pmrem.dispose()
  return { env: target.texture, sky: tex }
}

function makeDripSpots(): Vector3[] {
  const spots: Vector3[] = []
  for (let i = 0; i < 5; i++) spots.push(new Vector3(-0.55 + i * 0.42, 2.52, 1.14))
  for (let i = 0; i < 4; i++) spots.push(new Vector3(-2.45 + i * 1.5, 2.83, 0.52))
  spots.push(new Vector3(2.32, 2.83, 0.9))
  spots.push(new Vector3(2.2, 2.6, -2.2))
  spots.push(new Vector3(-2.9, 2.2, 0.2))
  spots.push(new Vector3(0.3, 3.55, -3.0))
  spots.push(new Vector3(-3.6, 2.55, -1.5))
  spots.push(new Vector3(1.7, 3.55, 3.3))
  return spots
}

export interface SceneHandle {
  dispose: () => void
}

export function createRainyStoreScene(container: HTMLElement): SceneHandle {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  renderer.shadowMap.enabled = true
  container.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0x0b1020)
  const environment = makeEnvironment(renderer)
  scene.background = new Color(0x0a0f1b)
  scene.fog = new FogExp2(0x101827, 0.018)
  scene.environment = environment.env
  scene.environmentIntensity = 0.62

  const camera = new PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 120)
  camera.position.set(9.6, 7.7, 11.2)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 1.0, -0.4)
  controls.enableDamping = true
  controls.dampingFactor = 0.055
  controls.enablePan = false
  controls.minDistance = 7
  controls.maxDistance = 25
  controls.minPolarAngle = 0.3
  controls.maxPolarAngle = Math.PI * 0.495
  controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  controls.autoRotateSpeed = 0.42
  controls.addEventListener('start', () => {
    controls.autoRotate = false
  })
  controls.update()

  renderer.domElement.style.touchAction = 'none'

  // ---------------------------------------------------------------- lights
  const hemi = new HemisphereLight(0x7f95c9, 0x1b1626, 0.72)
  scene.add(hemi)

  const moon = new DirectionalLight(0xa8c4f4, 1.5)
  moon.position.set(-6.5, 9.5, 7.5)
  moon.castShadow = true
  moon.shadow.mapSize.set(2048, 2048)
  moon.shadow.camera.left = -8
  moon.shadow.camera.right = 8
  moon.shadow.camera.top = 8
  moon.shadow.camera.bottom = -8
  moon.shadow.camera.near = 1
  moon.shadow.camera.far = 30
  moon.shadow.bias = -0.0008
  moon.shadow.normalBias = 0.025
  scene.add(moon)

  const rim = new DirectionalLight(0x7c8fd6, 0.85)
  rim.position.set(7, 5, -8)
  scene.add(rim)

  // a faint warm glow behind the shop so the silhouette separates from the night
  const backGlow = new DirectionalLight(0xffb27a, 0.28)
  backGlow.position.set(0, 2, -9)
  scene.add(backGlow)

  // ---------------------------------------------------------------- world
  const world = new Group()
  world.add(buildBase())
  const store = buildStore()
  world.add(store.group)
  world.add(buildInterior())
  const props = buildProps()
  world.add(props.group)
  const weather = buildWeather(store.rainMats, makeDripSpots())
  world.add(weather.group)
  scene.add(world)
  scene.add(makeBackdrop())

  // ---------------------------------------------------------------- post
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(
    new Vector2(container.clientWidth, container.clientHeight),
    0.34,
    0.5,
    0.88,
  )
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  // keep the last few big surfaces from crushing to grey
  const flickerBase = store.flickerLights.map((l) => l.intensity)
  const barBase = props.barLight.intensity

  const leftClosed: number = store.doorLeft.userData.closedX
  const leftOpen: number = store.doorLeft.userData.openX
  const rightClosed: number = store.doorRight.userData.closedX
  const rightOpen: number = store.doorRight.userData.openX

  // ---------------------------------------------------------------- loops
  const smooth = (v: number) => v * v * (3 - 2 * v)
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

  let door = 0
  let phase: 'rest' | 'opening' | 'hold' | 'closing' = 'rest'
  let wait = 3.5
  const stepDoor = (dt: number) => {
    switch (phase) {
      case 'rest':
        wait -= dt
        if (wait <= 0) phase = 'opening'
        break
      case 'opening':
        door = clamp01(door + dt / 1.05)
        if (door >= 1) {
          phase = 'hold'
          wait = 1.6 + Math.random() * 2.2
        }
        break
      case 'hold':
        wait -= dt
        if (wait <= 0) phase = 'closing'
        break
      case 'closing':
        door = clamp01(door - dt / 1.25)
        if (door <= 0) {
          phase = 'rest'
          wait = 3.5 + Math.random() * 5
        }
        break
    }
    const e = smooth(door)
    store.doorLeft.position.x = leftClosed + (leftOpen - leftClosed) * e
    store.doorRight.position.x = rightClosed + (rightOpen - rightClosed) * e
  }

  const signal = (t: number) => {
    const phaseT = (t + 4.2) % 13
    const green = phaseT < 5.6
    const yellow = phaseT >= 5.6 && phaseT < 7.1
    const red = phaseT >= 7.1
    const set = (mat: MeshBasicMaterial, on: boolean, level = 1) => {
      const f = on ? level : 0.06
      mat.color.setRGB(f, f, f)
    }
    set(props.vehicleLamp[0], green)
    set(props.vehicleLamp[1], yellow)
    set(props.vehicleLamp[2], red)
    const walk = red && phaseT > 7.6
    const blink = phaseT > 11.6 ? Math.sin(phaseT * 26) > 0 : true
    set(props.pedRed, !walk)
    set(props.pedGreen, walk && blink)
    set(props.farVehicle[0], green)
    set(props.farVehicle[1], yellow)
    set(props.farVehicle[2], red)
  }

  const flicker = (t: number, seed: number) => {
    const a = Math.sin(t * 17.0 + seed) * Math.sin(t * 5.3 + seed * 2.1)
    const b = Math.sin(t * 43.0 + seed * 3.3) * Math.sin(t * 9.7 + seed)
    let v = 0.95 + 0.05 * Math.sin(t * 2.2 + seed)
    if (a > 0.9) v *= 0.45
    if (b > 0.965) v *= 0.6
    return v
  }

  const clock = { last: performance.now() / 1000 }
  let elapsed = 0
  let frame = 0
  const tick = () => {
    frame = requestAnimationFrame(tick)
    const now = performance.now() / 1000
    const dt = Math.min(0.05, now - clock.last)
    clock.last = now
    elapsed += dt

    stepDoor(dt)
    signal(elapsed)

    const f = flicker(elapsed, 1.7)
    for (const mat of store.signMats) mat.color.setRGB(f, f, f)
    store.flickerLights.forEach((light, i) => {
      light.intensity = flickerBase[i] * (0.72 + 0.28 * flicker(elapsed, 4.1 + i * 2.3))
    })
    props.neon.color.setRGB(0.94 + 0.06 * f, 0.9 + 0.1 * f, 0.94 + 0.06 * f)
    props.barLight.intensity = barBase * (0.85 + 0.15 * Math.sin(elapsed * 9.0))

    weather.update(dt, elapsed)
    controls.update()
    composer.render()

    if (elapsed > 1e7) elapsed = 0
  }
  tick()

  const onResize = () => {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
    bloom.setSize(w, h)
  }
  window.addEventListener('resize', onResize)
  const observer = new ResizeObserver(onResize)
  observer.observe(container)

  const dispose = () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', onResize)
    observer.disconnect()
    controls.dispose()
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      obj.geometry.dispose()
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) {
        for (const value of Object.values(mat)) {
          if (value instanceof Texture) value.dispose()
        }
        mat.dispose()
      }
    })
    composer.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }

  return { dispose }
}
