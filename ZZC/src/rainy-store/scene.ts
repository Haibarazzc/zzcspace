/** Rainy konbini corner — renderer, lighting, camera and the small loops that
 *  keep the model alive: auto door, flickering signs, traffic light, weather. */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
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
  PointLight,
  Scene,
  Sprite,
  SpriteMaterial,
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
import { buildBlocks } from './blocks'
import { buildInterior } from './interior'
import { buildProps } from './props'
import { buildStore } from './store'
import { buildStreetLife } from './streetlife'
import { glowTexture } from './toon'
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
  renderer.toneMappingExposure = 1.08
  renderer.shadowMap.enabled = true
  container.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0x0b1020)
  const environment = makeEnvironment(renderer)
  scene.background = new Color(0x0a0f1b)
  scene.fog = new FogExp2(0x101827, 0.013)
  scene.environment = environment.env
  scene.environmentIntensity = 0.62

  const camera = new PerspectiveCamera(33, container.clientWidth / container.clientHeight, 0.1, 260)
  camera.position.set(15.5, 16.8, 28.8)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0.4, 1.05, 0.5)
  controls.enableDamping = true
  controls.dampingFactor = 0.055
  controls.enablePan = false
  controls.minDistance = 13
  controls.maxDistance = 78
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
  const hemi = new HemisphereLight(0x8ea3d4, 0x1b1626, 0.82)
  scene.add(hemi)

  const moon = new DirectionalLight(0xa8c4f4, 1.9)
  moon.position.set(-13, 19, 15)
  moon.castShadow = true
  moon.shadow.mapSize.set(2048, 2048)
  moon.shadow.camera.left = -17
  moon.shadow.camera.right = 17
  moon.shadow.camera.top = 17
  moon.shadow.camera.bottom = -17
  moon.shadow.camera.near = 1
  moon.shadow.camera.far = 60
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
  const blocks = buildBlocks()
  world.add(blocks.group)
  const street = buildStreetLife(blocks.parkingSpots)
  world.add(street.group)
  const weather = buildWeather(store.rainMats, makeDripSpots())
  world.add(weather.group)
  scene.add(world)
  scene.add(makeBackdrop())

  // ---------------------------------------------------------------- post
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(
    new Vector2(container.clientWidth, container.clientHeight),
    0.45,
    0.55,
    0.9,
  )
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  // keep the last few big surfaces from crushing to grey
  const flickerBase = store.flickerLights.map((l) => l.intensity)
  const barBase = props.barLight.intensity
  const lanternBase = blocks.lanternMats.map((m) => m.color.clone())

  // ramen steam: a handful of soft sprites drifting up from the pot
  const steamTex = glowTexture()
  const steamSpots = blocks.steamSpots.length ? blocks.steamSpots : [new Vector3(9.4, 1.3, -8.4)]
  const steam: { sprite: Sprite; phase: number; drift: number; home: Vector3 }[] = []
  for (const spot of steamSpots) {
    for (let i = 0; i < 8; i++) {
      const material = new SpriteMaterial({
        map: steamTex,
        color: 0xdfe9ff,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
      const sprite = new Sprite(material)
      sprite.position.copy(spot)
      sprite.scale.setScalar(0.4)
      world.add(sprite)
      steam.push({ sprite, phase: i / 8 + Math.random() * 0.1, drift: (Math.random() - 0.5) * 0.4, home: spot.clone() })
    }
  }

  // the parked-by-the-street wheels of the passing truck + its headlight
  const passing = street.passingCar
  const passingLight = passing.children.find((c): c is PointLight => (c as PointLight).isPointLight)
  const CAR_PERIOD = 16

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
    const on = phaseT < 5.6 ? 0 : phaseT < 7.1 ? 1 : 2 // 0 green, 1 amber, 2 red
    const set = (mat: MeshBasicMaterial, lit: boolean) => {
      const f = lit ? 1 : 0.06
      mat.color.setRGB(f, f, f)
    }
    // every head was pushed as three materials (green, amber, red)
    for (let head = 0; head < props.vehicleLamp.length / 3; head++) {
      // the side-street head runs the opposite phase of the main street
      const lit = head === 0 ? on : on === 0 ? 2 : on === 2 ? 0 : 1
      for (let k = 0; k < 3; k++) set(props.vehicleLamp[head * 3 + k], k === lit)
    }
    const walk = on === 2 && phaseT > 7.6
    const blink = phaseT > 11.6 ? Math.sin(phaseT * 26) > 0 : true
    set(props.pedRed, !walk)
    set(props.pedGreen, walk && blink)
    for (let head = 0; head < props.farVehicle.length / 3; head++) {
      for (let k = 0; k < 3; k++) set(props.farVehicle[head * 3 + k], k === on)
    }
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

    // window lights:每扇窗有自己的慢节奏明暗
    for (let i = 0; i < blocks.windowMats.length; i++) {
      const p = i * 1.913
      const slow = Math.sin(elapsed * 0.21 + p) * 0.5 + 0.5
      const fast = Math.sin(elapsed * 1.7 + p * 3.1) * 0.5 + 0.5
      const k = 0.62 + 0.3 * slow + 0.08 * fast
      blocks.windowMats[i].color.setRGB(k, k, k)
    }
    // paper lanterns breathe
    for (let i = 0; i < blocks.lanternMats.length; i++) {
      const k = 0.82 + 0.18 * Math.sin(elapsed * 2.6 + i * 1.7) * Math.sin(elapsed * 0.9 + i)
      blocks.lanternMats[i].color.copy(lanternBase[i]).multiplyScalar(k)
    }
    // ramen steam rising and fading
    for (const s of steam) {
      const life = (elapsed * 0.22 + s.phase) % 1
      s.sprite.position.y = s.home.y + life * 1.5
      s.sprite.position.x = s.home.x + s.drift * life
      s.sprite.scale.setScalar(0.3 + life * 0.75)
      ;(s.sprite.material as SpriteMaterial).opacity = Math.sin(life * Math.PI) * 0.2
    }
    // a kei-truck drives past every so often
    const cp = (elapsed % CAR_PERIOD) / CAR_PERIOD
    passing.position.x = -10.6 + cp * 21.2
    passing.position.z = 5.7
    passing.rotation.y = Math.PI / 2
    passing.visible = cp > 0.04 && cp < 0.96
    if (passingLight) passingLight.intensity = 2.2
    for (const w of street.passingWheels) w.rotation.z += dt * 9
    // cat tails
    street.cats.forEach((c, i) => {
      c.tail.rotation.z = Math.sin(elapsed * 1.5 + i * 2.1) * 0.22
      c.tail.rotation.x = Math.sin(elapsed * 0.7 + i) * 0.12
    })

    weather.update(dt, elapsed)
    controls.update()
    composer.render()

    if (elapsed > 1e7) elapsed = 0
  }
  tick()

  // keep the whole plinth in view on narrow / portrait screens: hold the
  // horizontal field of view constant instead of the vertical one
  const REF_ASPECT = 1.6
  const REF_TAN = Math.tan((33 * Math.PI) / 360) * REF_ASPECT
  const onResize = () => {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    const aspect = w / h
    camera.aspect = aspect
    const fov = aspect < REF_ASPECT ? (2 * Math.atan(REF_TAN / aspect) * 180) / Math.PI : 33
    camera.fov = Math.min(fov, 74)
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
    bloom.setSize(w, h)
  }
  onResize()
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
