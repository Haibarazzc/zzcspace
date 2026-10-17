/** The collectible square base: the 22×22 block plinth, asphalt streets,
 *  raised pavements, curbs, gutter grates, tactile paving, crosswalk paint,
 *  puddles and the brass rim. */
import { CircleGeometry, Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry } from 'three'
import { LAYOUT, SIDEWALK_Y } from './palette'
import {
  asphaltTexture,
  box,
  cylinder,
  gutterTexture,
  makeTexture,
  plane,
  plateTexture,
  roadPaintTexture,
  sidewalkTexture,
  tactileTexture,
  toonMaterial,
  wetMaterial,
  woodTexture,
  glowMaterial,
  glowTexture,
} from './toon'

export interface Puddle {
  x: number
  z: number
  rx: number
  rz: number
  rot: number
  y: number
}

/** Filled by buildBase(); the weather system spawns ripples on each entry. */
export const PUDDLES: Puddle[] = []

const HALF = 11
const WALK_TOP = SIDEWALK_Y
const walkRects: [number, number, number, number][] = [
  [-HALF, 2.1, LAYOUT.northWalk.z0, LAYOUT.northWalk.z1],
  [LAYOUT.westWalk.x0, LAYOUT.westWalk.x1, -HALF, LAYOUT.northWalk.z1],
  [LAYOUT.eastWalk.x0, LAYOUT.eastWalk.x1, -HALF, LAYOUT.northWalk.z1],
  [-HALF, HALF, LAYOUT.southWalk.z0, LAYOUT.southWalk.z1],
]

/** Top surface height at a ground position — pavements sit above the asphalt. */
export function groundY(x: number, z: number): number {
  for (const [x0, x1, z0, z1] of walkRects) {
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return WALK_TOP + 0.008
  }
  return 0.014
}

const asphaltMat = new MeshStandardMaterial({
  map: asphaltTexture(13),
  roughness: 0.3,
  metalness: 0.52,
  envMapIntensity: 1.5,
  emissive: new Color(0x0a1222),
  emissiveIntensity: 0.55,
})
const alleyMat = new MeshStandardMaterial({
  map: asphaltTexture(6),
  color: 0x9aa0b4,
  roughness: 0.26,
  metalness: 0.5,
  envMapIntensity: 1.2,
  emissive: new Color(0x0b1322),
  emissiveIntensity: 0.5,
})
const walkMatLong = new MeshStandardMaterial({
  map: sidewalkTexture(9, 2),
  color: 0x93a0b8,
  roughness: 0.42,
  metalness: 0.3,
  envMapIntensity: 0.9,
})
const walkMatWide = new MeshStandardMaterial({
  map: sidewalkTexture(3, 9),
  color: 0x93a0b8,
  roughness: 0.42,
  metalness: 0.3,
  envMapIntensity: 0.9,
})
const curbMat = toonMaterial(0x6c7387)
const whitePaint = new MeshStandardMaterial({ color: 0xcdd4de, roughness: 0.34, metalness: 0.18, envMapIntensity: 0.9 })

function slab(w: number, d: number, x: number, z: number, mat: MeshStandardMaterial): Mesh {
  const m = box(w, 0.072, d, mat, x, 0.036, z)
  m.castShadow = false
  return m
}

function curb(w: number, d: number, x: number, z: number): Mesh {
  const m = box(w, 0.11, d, curbMat, x, 0.055, z)
  m.castShadow = false
  return m
}

/** white road paint decal sitting just above the wet asphalt */
function paint(w: number, h: number, x: number, z: number, rot = 0, opacity = 0.92): Mesh {
  const mat = whitePaint.clone()
  mat.transparent = true
  mat.opacity = opacity
  return plane(w, h, mat, x, 0.009, z, -Math.PI / 2, 0, rot)
}

function puddle(x: number, z: number, rx: number, rz: number, rot: number): Mesh {
  const y = groundY(x, z)
  const mat = wetMaterial(0x22324e, 0.04, 0.45)
  mat.envMapIntensity = 2.2
  mat.emissive = new Color(0x0c1626)
  mat.emissiveIntensity = 1.1
  const mesh = new Mesh(new CircleGeometry(1, 22), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.rotation.z = rot
  mesh.scale.set(rx, rz, 1)
  mesh.position.set(x, y, z)
  // soft spill of the shop / street lights lying on the water
  const sheen = new Mesh(new CircleGeometry(1.25, 22), glowMaterial(0xffb478, 0.06, glowTexture()))
  sheen.position.set(0, 0, 0.0025)
  sheen.scale.set(1.15, 1.15, 1)
  mesh.add(sheen)
  PUDDLES.push({ x, z, rx, rz, rot, y })
  return mesh
}

function gravelTexture(): MeshStandardMaterial {
  const tex = makeTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#4c4a52'
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 900; i++) {
      const g = 60 + Math.random() * 70
      ctx.fillStyle = `rgba(${g + 12},${g + 8},${g + 4},${0.25 + Math.random() * 0.5})`
      const s = 1 + Math.random() * 3
      ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s)
    }
  })
  tex.repeat.set(3, 3)
  return new MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.1 })
}

export function buildBase(): Group {
  const g = new Group()
  PUDDLES.length = 0

  // ---- plinth
  // ponytail: the plinth has no light of its own down there; a touch of emissive keeps
  // the wood readable instead of crushing to black under ACES.
  const wood = new MeshStandardMaterial({
    map: woodTexture(),
    roughness: 0.6,
    metalness: 0.08,
    emissive: new Color(0x3a2b1d),
    emissiveIntensity: 0.5,
  })
  const plinth = box(22, 0.34, 22, wood, 0, -0.17, 0)
  plinth.castShadow = true
  g.add(plinth)
  const plate = plane(5.2, 0.7, new MeshBasicMaterial({ map: plateTexture(), toneMapped: false }), 0, -0.105, 11.004)
  plate.rotation.y = Math.PI
  g.add(plate)
  const plateSide = plane(3.4, 0.46, new MeshBasicMaterial({ map: plateTexture(), toneMapped: false }), 11.004, -0.105, 0)
  plateSide.rotation.y = Math.PI / 2
  g.add(plateSide)

  // brass inlay around the top edge
  const brass = wetMaterial(0xb08a45, 0.28, 0.9)
  g.add(box(21.9, 0.024, 0.05, brass, 0, 0.012, 10.95))
  g.add(box(21.9, 0.024, 0.05, brass, 0, 0.012, -10.95))
  g.add(box(0.05, 0.024, 21.9, brass, 10.95, 0.012, 0))
  g.add(box(0.05, 0.024, 21.9, brass, -10.95, 0.012, 0))

  // ---- asphalt everywhere first
  const road = plane(22, 22, asphaltMat, 0, 0.004, 0, -Math.PI / 2)
  road.receiveShadow = true
  g.add(road)

  // ---- the service lane behind the shops
  const lane = plane(13.1, LAYOUT.backLane.z1 - LAYOUT.backLane.z0, alleyMat, -4.45, 0.008, (LAYOUT.backLane.z0 + LAYOUT.backLane.z1) / 2, -Math.PI / 2)
  lane.receiveShadow = true
  g.add(lane)
  // alley mouth connects the service lane to the shop alley
  const mouth = plane(1.2, 3.4, alleyMat, -3.3, 0.009, -2.0, -Math.PI / 2)
  g.add(mouth)

  // ---- pavements
  const nw = LAYOUT.northWalk
  g.add(slab(13.1, nw.z1 - nw.z0, -4.45, (nw.z0 + nw.z1) / 2, walkMatLong)) // in front of the shops
  g.add(slab(LAYOUT.westWalk.x1 - LAYOUT.westWalk.x0, 13.8, 2.75, -4.1, walkMatWide)) // west of the side street
  g.add(slab(LAYOUT.eastWalk.x1 - LAYOUT.eastWalk.x0, 13.8, 8.1, -4.1, walkMatWide)) // east of the side street
  const sw = LAYOUT.southWalk
  g.add(slab(22, sw.z1 - sw.z0, 0, (sw.z0 + sw.z1) / 2, walkMatLong)) // south pavement

  // ---- shrine forecourt (gravel) at the west end of the block
  const gravel = gravelTexture()
  g.add(plane(1.9, 3.6, gravel, -10.05, 0.077, -1.5, -Math.PI / 2))
  // stone path from the street to the shrine
  g.add(plane(0.9, 2.2, gravel, -9.5, 0.076, 0.9, -Math.PI / 2))

  // ---- curbs
  g.add(curb(13.1, 0.12, -4.45, nw.z1)) // north walk onto the main street
  g.add(curb(0.12, 13.8, LAYOUT.westWalk.x1, -4.1))
  g.add(curb(0.12, 13.8, LAYOUT.eastWalk.x0, -4.1))
  g.add(curb(22, 0.12, 0, sw.z0))
  g.add(curb(0.12, 2.6, LAYOUT.westWalk.x0, 1.5))

  // ---- gutter grates along the road edges
  const gutter = new MeshStandardMaterial({ map: gutterTexture(9), roughness: 0.4, metalness: 0.7 })
  g.add(plane(9.2, 0.17, gutter, -5.4, 0.011, 2.71, -Math.PI / 2))
  g.add(plane(4.4, 0.17, gutter, 5.6, 0.011, 2.71, -Math.PI / 2))
  g.add(plane(12.0, 0.17, gutter, -1.6, 0.011, 8.29, -Math.PI / 2))
  const gutterSide = new MeshStandardMaterial({ map: gutterTexture(6), roughness: 0.4, metalness: 0.7 })
  g.add(plane(0.17, 9.4, gutterSide, 3.51, 0.011, -2.0, -Math.PI / 2))
  g.add(plane(0.17, 9.4, gutterSide, 7.29, 0.011, -2.0, -Math.PI / 2))
  const alleyDrain = new MeshStandardMaterial({ map: gutterTexture(5), roughness: 0.35, metalness: 0.75 })
  g.add(plane(0.16, 4.9, alleyDrain, -3.32, 0.012, -2.3, -Math.PI / 2))
  g.add(plane(9.0, 0.16, alleyDrain, -6.4, 0.012, -3.75, -Math.PI / 2))

  // ---- tactile paving at the crossings
  const tactile = new MeshStandardMaterial({ map: tactileTexture(4, 1), roughness: 0.55, metalness: 0.1 })
  g.add(plane(2.0, 0.34, tactile, 1.2, 0.09, 2.24, -Math.PI / 2))
  g.add(plane(1.6, 0.34, tactile, -7.9, 0.09, 2.24, -Math.PI / 2))
  g.add(plane(2.0, 0.34, tactile, 1.2, 0.09, 7.36, -Math.PI / 2))
  const tactileL = new MeshStandardMaterial({ map: tactileTexture(1, 4), roughness: 0.55, metalness: 0.1 })
  g.add(plane(0.34, 2.0, tactileL, 2.42, 0.09, 1.6, -Math.PI / 2))

  // ---- crosswalk over the main street, west of the junction
  for (let i = 0; i < 7; i++) {
    g.add(paint(0.34, 3.4, 1.2 - 1.98 + i * 0.66, 4.8, 0, 0.85))
  }
  // crosswalk over the side street, just north of the junction
  for (let i = 0; i < 6; i++) {
    g.add(paint(3.4, 0.34, 5.4, 0.62 + i * 0.42, 0, 0.85))
  }
  // far crosswalk at the west end of the main street
  for (let i = 0; i < 6; i++) {
    g.add(paint(0.34, 3.4, -7.9 + i * 0.62, 4.8, 0, 0.8))
  }

  // stop bars before the crossings (Japan drives on the left)
  g.add(paint(0.22, 1.9, 3.06, 3.85, 0, 0.8)) // eastbound main street
  g.add(paint(1.9, 0.22, 6.4, 0.34, 0, 0.8)) // southbound side street
  // dashed centre line on the main street
  for (let i = 0; i < 9; i++) {
    const x = -10.4 + i * 1.5
    if (x > -2.5 && x < 8.2) continue
    g.add(paint(0.14, 0.9, x, 4.8, 0, 0.62))
  }
  // dashed centre line on the side street
  for (let i = 0; i < 6; i++) {
    g.add(paint(0.14, 0.9, 5.4, -2.2 - i * 1.5, 0, 0.62))
  }
  // parallel parking bays on the south edge of the main street
  for (const cx of [-6.4, -3.6]) {
    g.add(paint(0.1, 2.0, cx - 1.25, 5.8, 0, 0.72))
    g.add(paint(0.1, 2.0, cx + 1.25, 5.8, 0, 0.72))
    g.add(paint(2.5, 0.1, cx, 6.78, 0, 0.72))
    const p = plane(0.7, 0.7, new MeshBasicMaterial({ map: roadPaintTexture(), transparent: true, opacity: 0.62 }), cx - 0.6, 0.011, 6.2, -Math.PI / 2)
    g.add(p)
    g.add(box(1.5, 0.09, 0.16, toonMaterial(0x8b8f9a), cx, 0.05, 6.55))
  }

  // ---- manholes
  const manhole = (x: number, z: number) => {
    g.add(cylinder(0.36, 0.36, 0.012, 20, wetMaterial(0x2a2f3a, 0.35, 0.8), x, 0.012, z))
    const ring = new Mesh(new RingGeometry(0.24, 0.33, 22), new MeshBasicMaterial({ color: 0x525a6b, transparent: true, opacity: 0.8 }))
    ring.rotation.x = -Math.PI / 2
    ring.position.set(x, 0.02, z)
    g.add(ring)
  }
  manhole(1.7, 4.9)
  manhole(5.9, -3.6)
  manhole(-5.2, 5.6)
  manhole(0.6, 1.0)

  // ---- puddles across the whole block
  const spots: [number, number, number, number, number][] = [
    [1.4, 3.4, 1.15, 0.5, 0.2],
    [-0.4, 4.5, 0.9, 0.45, -0.3],
    [2.7, 5.7, 0.8, 0.4, 0.7],
    [-3.4, 3.3, 0.7, 0.35, -0.2],
    [-6.3, 5.0, 1.0, 0.4, 0.5],
    [5.2, 3.7, 0.9, 0.4, 0.1],
    [6.5, 5.9, 0.7, 0.3, -0.4],
    [-8.7, 5.5, 0.8, 0.35, 0.3],
    [-9.9, 3.9, 0.6, 0.3, 0.2],
    [0.2, 6.3, 0.7, 0.3, -0.5],
    [4.2, -1.2, 0.55, 0.85, 0.2],
    [6.2, -3.4, 0.6, 0.9, -0.2],
    [5.0, -6.2, 0.7, 0.6, 0.4],
    [6.6, -9.0, 0.5, 0.7, 0.0],
    [4.0, 1.8, 0.6, 0.35, 0.2],
    [2.75, 0.9, 0.4, 0.75, 0.0],
    [2.75, -2.5, 0.35, 0.6, 0.2],
    [8.1, -1.6, 0.4, 0.7, 0.0],
    [8.1, 1.2, 0.4, 0.5, 0.3],
    [-1.6, 1.2, 0.7, 0.3, 0.2],
    [-5.3, 1.6, 0.6, 0.3, -0.2],
    [-9.3, 1.0, 0.5, 0.3, 0.0],
    [0.4, 7.4, 0.8, 0.3, 0.0],
    [-4.6, 7.6, 0.6, 0.3, 0.2],
    [6.6, 7.4, 0.5, 0.3, 0.0],
    [-3.3, 0.8, 0.45, 0.3, 0.5],
    [-3.35, -2.2, 0.36, 0.6, 0.1],
    [-3.34, -4.2, 0.5, 0.34, 0.7],
    [-1.2, -4.2, 0.7, 0.3, 0.0],
    [-7.4, -4.2, 0.6, 0.3, 0.2],
    [-2.0, -6.4, 0.75, 0.5, 0.2],
    [9.6, -4.4, 0.7, 0.4, 0.3],
  ]
  for (const [x, z, rx, rz, rot] of spots) g.add(puddle(x, z, rx, rz, rot))

  return g
}
