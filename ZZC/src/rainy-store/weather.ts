/** Weather layer: shader rain, puddle ripples, eave drips, glass droplets and
 *  the additive light streaks that make the asphalt look soaked. */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { PUDDLES, groundY } from './base'
import { rippleTexture, streakTexture } from './toon'

const RAIN_COUNT = 5200
const RAIN_HEIGHT = 10.5
/** footprint of every roofed thing on the block: rain is clipped out of them */
const ROOFS: [number, number, number, number][] = [
  [-2.95, 2.35, -3.55, 0.55], // konbini
  [-5.05, -3.85, -3.7, 0.4], // neighbour house
  [-8.95, -5.3, -3.75, 0.1], // apartment
  [-10.35, -5.25, -10.85, -4.75], // warehouse
  [-4.95, -1.55, -10.0, -4.9], // back house
  [8.8, 10.95, -11.35, -5.65], // ramen shop
  [-9.85, -4.75, 7.1, 11], // laundry
  [-3.95, 1.85, 7.1, 11], // izakaya
  [0.3, 1.9, 8.4, 9.6], // bus shelter
  [-7.35, -6.45, 1.15, 2.05], // phone booth
  [2.9, 3.9, -3.9, -3.2], // neighbour overhang
]
function underRoof(x: number, z: number): boolean {
  for (const [x0, x1, z0, z1] of ROOFS) if (x > x0 && x < x1 && z > z0 && z < z1) return true
  return false
}

interface Drip {
  mesh: Mesh
  start: Vector3
  y: number
  vy: number
  wait: number
}

const RIPPLE_POOL = 70

export interface WeatherParts {
  group: Group
  update: (dt: number, t: number) => void
}

function makeRain(): { points: Points; material: ShaderMaterial } {
  const pos: number[] = []
  const speed: number[] = []
  const size: number[] = []
  let guard = 0
  while (pos.length / 3 < RAIN_COUNT && guard < RAIN_COUNT * 10) {
    guard++
    const x = (Math.random() - 0.5) * 21.4
    const z = (Math.random() - 0.5) * 21.4
    if (underRoof(x, z)) continue
    pos.push(x, Math.random() * RAIN_HEIGHT, z)
    speed.push(6.5 + Math.random() * 5.5)
    size.push(0.8 + Math.random() * 1.4)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('aSpeed', new BufferAttribute(new Float32Array(speed), 1))
  geo.setAttribute('aSize', new BufferAttribute(new Float32Array(size), 1))

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: RAIN_HEIGHT },
      uColor: { value: new Color(0x9fbbe0) },
    },
    vertexShader: `
      attribute float aSpeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uHeight;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float span = uHeight + 0.4;
        p.y = mod(position.y - uTime * aSpeed, span);
        p.x += (span - p.y) * 0.035;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * (58.0 / max(1.0, -mv.z)), 1.5, 13.0);
        vAlpha = clamp(0.95 - (-mv.z) / 34.0, 0.1, 0.5);
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float line = 1.0 - smoothstep(0.02, 0.18, abs(uv.x));
        float tail = 1.0 - smoothstep(0.18, 0.5, abs(uv.y));
        float a = line * tail * vAlpha;
        if (a < 0.02) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  return { points: new Points(geo, material), material }
}

function makeRipples(): { group: Group; spawn: (x: number, z: number, y?: number) => void; update: (dt: number) => void } {
  const group = new Group()
  const ripples: { mesh: Mesh; life: number; rate: number; startScale: number }[] = []
  const geo = new PlaneGeometry(1, 1)
  for (let i = 0; i < RIPPLE_POOL; i++) {
    const mat = new MeshBasicMaterial({
      map: rippleTexture(),
      color: 0x9ab6dd,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    const mesh = new Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false
    group.add(mesh)
    ripples.push({ mesh, life: 0, rate: 1.4, startScale: 0.1 })
  }
  let cursor = 0
  const spawn = (x: number, z: number, y = 0.016) => {
    const r = ripples[cursor % ripples.length]
    cursor++
    r.mesh.position.set(x, y, z)
    r.mesh.visible = true
    r.life = 0
    r.rate = 1.1 + Math.random() * 0.7
    r.startScale = 0.06 + Math.random() * 0.08
  }
  const update = (dt: number) => {
    for (const r of ripples) {
      if (!r.mesh.visible) continue
      r.life += dt * r.rate
      if (r.life >= 1) {
        r.mesh.visible = false
        continue
      }
      const s = r.startScale + r.life * 0.42
      r.mesh.scale.set(s, s, s)
      ;(r.mesh.material as MeshBasicMaterial).opacity = Math.sin(Math.min(1, r.life) * Math.PI) * 0.55
    }
  }
  return { group, spawn, update }
}

export function buildWeather(rainMats: MeshBasicMaterial[], dripSpots: Vector3[]): WeatherParts {
  const group = new Group()

  // ------------------------------------------------------------------ rain
  const { points, material } = makeRain()
  group.add(points)

  // ------------------------------------------------------------------ ripples
  const ripples = makeRipples()
  group.add(ripples.group)

  // ------------------------------------------------------------------ drips
  const drips: Drip[] = []
  const dropGeo = new SphereGeometry(0.014, 6, 6)
  const dropMat = new MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.75, toneMapped: false })
  for (let i = 0; i < 16; i++) {
    const spot = dripSpots[i % dripSpots.length]
    const mesh = new Mesh(dropGeo, dropMat)
    mesh.scale.set(1, 2.6, 1)
    mesh.visible = false
    group.add(mesh)
    drips.push({ mesh, start: spot.clone(), y: spot.y, vy: 0, wait: Math.random() * 2.4 })
  }

  // ------------------------------------------------------------------ wet reflection streaks
  const streakTex = streakTexture()
  const streaks: { mat: MeshBasicMaterial; phase: number; base: number }[] = []
  const addStreak = (x: number, z: number, w: number, len: number, color: number, base: number, y = 0.008) => {
    const mat = new MeshBasicMaterial({
      map: streakTex,
      color,
      transparent: true,
      opacity: base,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    const m = new Mesh(new PlaneGeometry(w, len), mat)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, y, z + len / 2)
    group.add(m)
    streaks.push({ mat, phase: Math.random() * 6.28, base })
  }
  // shop window spill on the pavement
  addStreak(-1.9, 0.32, 1.5, 2.0, 0xffb877, 0.34, 0.078)
  addStreak(-0.2, 0.32, 1.8, 2.2, 0xffc98d, 0.4, 0.078)
  addStreak(1.5, 0.32, 1.2, 1.9, 0xffb877, 0.3, 0.078)
  // spill reaching the main road
  addStreak(-0.3, 2.45, 3.4, 2.4, 0xffb26f, 0.16)
  // east glass spill
  addStreak(2.2, -0.7, 1.5, 1.6, 0xffbd80, 0.22, 0.078)
  // vending machine glow
  addStreak(2.55, 1.35, 0.9, 1.4, 0xff9f88, 0.26, 0.078)
  addStreak(2.55, 0.7, 0.8, 1.1, 0x8fd4ff, 0.22, 0.078)
  // street lamp on the wet road
  addStreak(2.55, 2.4, 1.5, 2.8, 0xffd9a0, 0.22)
  // traffic signal green smear on the crosswalk
  addStreak(2.55, 3.3, 0.7, 1.8, 0x6fffc0, 0.14)
  // neon bar in the alley
  addStreak(-3.3, -0.4, 0.8, 1.6, 0xff6fa8, 0.2)
  // warm light under the awning
  addStreak(0.3, 1.0, 1.5, 1.1, 0xffcf94, 0.2, 0.078)
  // ---- the rest of the block
  // apartment corridor light on the alley pavement
  addStreak(-7.0, 0.3, 2.4, 1.8, 0xffc98d, 0.16, 0.078)
  // warehouse sodium lamp in the service lane
  addStreak(-7.8, -4.6, 2.2, 2.0, 0xffd9a0, 0.14)
  // ramen shop: warm opening spilling into the side street
  addStreak(9.0, -7.4, 1.5, 2.4, 0xffa870, 0.24)
  addStreak(8.4, -8.6, 1.2, 1.8, 0xffc084, 0.16)
  // coin laundry: cyan wash on the south pavement
  addStreak(-7.3, 7.2, 3.4, 1.7, 0x9fd8ff, 0.22, 0.078)
  // izakaya lanterns
  addStreak(-1.0, 7.2, 2.6, 1.6, 0xffb07a, 0.2, 0.078)
  // bus shelter lamp
  addStreak(0.55, 6.9, 1.4, 1.4, 0xffe0b0, 0.16, 0.078)
  // phone booth
  addStreak(-6.9, 2.1, 0.8, 1.2, 0xbfe6ff, 0.2, 0.078)
  // coin parking floodlight + vending bank
  addStreak(9.9, 0.2, 2.0, 2.6, 0xbfe0ff, 0.12)
  addStreak(-4.5, 7.8, 1.6, 1.5, 0xffa890, 0.18, 0.078)
  // street lamp at the east corner
  addStreak(7.3, 2.6, 1.6, 3.0, 0xffd9a0, 0.16)
  // shrine lantern path
  addStreak(-9.8, 0.4, 1.1, 1.6, 0xffb877, 0.12, 0.078)
  // far crosswalk signal
  addStreak(-8.4, 3.1, 0.7, 1.8, 0x6fffc0, 0.1)

  // ------------------------------------------------------------------ update
  const glassMats = [...new Set(rainMats)]

  const update = (dt: number, t: number) => {
    material.uniforms.uTime.value = t

    // ripples everywhere it rains: puddles always, dry ground occasionally
    if (PUDDLES.length) {
      const spawns = Math.random() < dt * 55 ? 2 : 1
      for (let i = 0; i < spawns; i++) {
        if (Math.random() < 0.62) {
          const p = PUDDLES[Math.floor(Math.random() * PUDDLES.length)]
          const a = Math.random() * Math.PI * 2
          const r = Math.sqrt(Math.random())
          ripples.spawn(p.x + Math.cos(a) * p.rx * r * 0.8, p.z + Math.sin(a) * p.rz * r * 0.8, p.y + 0.009)
        } else {
          const x = (Math.random() - 0.5) * 20.6
          const z = (Math.random() - 0.5) * 20.6
          if (underRoof(x, z)) continue
          ripples.spawn(x, z, groundY(x, z) + 0.007)
        }
      }
    }
    ripples.update(dt)

    // dripping from the awning + eaves
    for (const d of drips) {
      if (!d.mesh.visible) {
        d.wait -= dt
        if (d.wait <= 0) {
          d.mesh.visible = true
          d.y = d.start.y
          d.vy = 0
          d.mesh.position.copy(d.start)
        }
        continue
      }
      d.vy += 22 * dt
      d.y -= d.vy * dt
      d.mesh.position.y = d.y
      if (d.y < 0.09) {
        d.mesh.visible = false
        d.wait = 0.5 + Math.random() * 3.4
        ripples.spawn(d.start.x, d.start.z, d.start.z < 2.5 && d.start.z > 0.3 ? 0.08 : 0.018)
      }
    }

    // water sliding down the glass
    for (const mat of glassMats) {
      const alpha = mat.alphaMap
      if (!alpha) continue
      alpha.offset.y = (t * 0.045) % 1
      alpha.offset.x = Math.sin(t * 0.35) * 0.02
    }

    // shimmer the reflections
    for (const s of streaks) {
      s.mat.opacity = s.base * (0.82 + Math.sin(t * 1.7 + s.phase) * 0.1 + Math.sin(t * 4.3 + s.phase * 2) * 0.05)
    }
  }

  return { group, update }
}
