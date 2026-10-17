/** The collectible square base: asphalt streets, raised pavements, curbs,
 *  gutter grates, tactile paving, crosswalk paint, puddles and the brass rim. */
import { CircleGeometry, Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry } from 'three'
import { COL } from './palette'
import {
  asphaltTexture,
  box,
  cylinder,
  glowMaterial,
  glowTexture,
  gutterTexture,
  plane,
  plateTexture,
  roadPaintTexture,
  sidewalkTexture,
  tactileTexture,
  toonMaterial,
  wetMaterial,
  woodTexture,
} from './toon'

export interface Puddle {
  x: number
  z: number
  rx: number
  rz: number
  rot: number
}

/** Filled by buildBase(); the weather system spawns ripples on each entry. */
export const PUDDLES: Puddle[] = []

const asphaltMat = new MeshStandardMaterial({
  map: asphaltTexture(7),
  roughness: 0.3,
  metalness: 0.52,
  envMapIntensity: 1.5,
  emissive: new Color(0x0a1222),
  emissiveIntensity: 0.55,
})
const sidewalkMat = new MeshStandardMaterial({
  map: sidewalkTexture(2.6, 1.4),
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

function curb(w: number, d: number, x: number, z: number) {
  const m = box(w, 0.1, d, curbMat, x, 0.05, z)
  m.castShadow = false
  return m
}

/** white road paint decal sitting just above the wet asphalt */
function paint(w: number, h: number, x: number, z: number, rot = 0, opacity = 0.92) {
  const mat = whitePaint.clone()
  mat.transparent = true
  mat.opacity = opacity
  return plane(w, h, mat, x, 0.009, z, -Math.PI / 2, 0, rot)
}

function puddle(x: number, z: number, rx: number, rz: number, rot: number) {
  const mat = wetMaterial(0x22324e, 0.04, 0.45)
  mat.envMapIntensity = 2.2
  mat.emissive = new Color(0x0c1626)
  mat.emissiveIntensity = 1.1
  const mesh = new Mesh(new CircleGeometry(1, 22), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.rotation.z = rot
  mesh.scale.set(rx, rz, 1)
  mesh.position.set(x, 0.012, z)
  // soft spill of the shop / street lights lying on the water
  const sheen = new Mesh(new CircleGeometry(1.25, 22), glowMaterial(0xffb478, 0.06, glowTexture()))
  sheen.position.set(0, 0, 0.0025)
  sheen.scale.set(1.15, 1.15, 1)
  mesh.add(sheen)
  PUDDLES.push({ x, z, rx, rz, rot })
  return mesh
}

export function buildBase(): Group {
  const g = new Group()
  PUDDLES.length = 0

  // ---- plinth
  const wood = new MeshStandardMaterial({ map: woodTexture(), roughness: 0.62, metalness: 0.08 })
  const plinth = box(10, 0.34, 10, wood, 0, -0.17, 0)
  plinth.castShadow = true
  g.add(plinth)
  const plate = plane(4.4, 0.62, new MeshBasicMaterial({ map: plateTexture(), toneMapped: false }), 0, -0.105, 5.004)
  plate.rotation.y = Math.PI
  g.add(plate)

  // brass inlay around the top edge
  const brass = wetMaterial(0xb08a45, 0.28, 0.9)
  g.add(box(9.9, 0.024, 0.05, brass, 0, 0.012, 4.95))
  g.add(box(9.9, 0.024, 0.05, brass, 0, 0.012, -4.95))
  g.add(box(0.05, 0.024, 9.9, brass, 4.95, 0.012, 0))
  g.add(box(0.05, 0.024, 9.9, brass, -4.95, 0.012, 0))

  // ---- asphalt everywhere first
  const road = plane(10, 10, asphaltMat, 0, 0.004, 0, -Math.PI / 2)
  road.receiveShadow = true
  g.add(road)

  // ---- pavements
  g.add(slab(4.8, 2.2, -0.3, 1.4, sidewalkMat)) // front of store, x -2.7..2.1
  g.add(slab(1.4, 5.8, 2.8, -0.4, sidewalkMat)) // east side, x 2.1..3.5, z -3.3..2.5
  g.add(slab(0.9, 5.6, -4.45, -2.6, sidewalkMat)) // narrow walk in front of neighbour house
  // corner ramp where the alley meets the pavement
  const apron = plane(1.2, 2.2, asphaltMat, -3.3, 0.008, 1.4, -Math.PI / 2)
  g.add(apron)

  // ---- curbs
  g.add(curb(4.8, 0.12, -0.3, 2.56))
  g.add(curb(1.4, 0.12, 2.8, 2.56))
  g.add(curb(0.12, 2.2, 3.56, 1.4))
  g.add(curb(0.12, 2.0, -2.64, 1.3))
  g.add(curb(0.12, 2.0, -3.96, 1.3))

  // ---- gutter grates along the road edges
  const gutter = new MeshStandardMaterial({ map: gutterTexture(9), roughness: 0.4, metalness: 0.7 })
  g.add(plane(6.4, 0.17, gutter, 0.15, 0.011, 2.71, -Math.PI / 2))
  const gutterSide = new MeshStandardMaterial({ map: gutterTexture(6), roughness: 0.4, metalness: 0.7 })
  g.add(plane(0.17, 2.2, gutterSide, 3.64, 0.011, 1.4, -Math.PI / 2))
  const alleyDrain = new MeshStandardMaterial({ map: gutterTexture(5), roughness: 0.35, metalness: 0.75 })
  g.add(plane(0.16, 4.9, alleyDrain, -3.32, 0.012, -2.3, -Math.PI / 2))

  // ---- tactile paving
  const tactile = new MeshStandardMaterial({ map: tactileTexture(4, 1), roughness: 0.55, metalness: 0.1 })
  g.add(plane(1.5, 0.34, tactile, 1.45, 0.017, 2.24, -Math.PI / 2))
  const tactileL = new MeshStandardMaterial({ map: tactileTexture(1, 4), roughness: 0.55, metalness: 0.1 })
  g.add(plane(0.34, 1.5, tactileL, 2.42, 0.017, 1.6, -Math.PI / 2))

  // ---- crosswalk over the main street
  for (let i = 0; i < 6; i++) {
    g.add(paint(0.42, 2.15, 0.75 + i * 0.78, 3.72, 0, 0.85))
  }
  // stop bar before the crosswalk
  g.add(paint(2.2, 0.22, -1.2, 4.75, 0, 0.8))
  // dashed side-street centre line
  for (let i = 0; i < 5; i++) {
    g.add(paint(0.13, 0.5, 4.25, 1.9 - i * 0.95, 0, 0.72))
  }
  // parking bay on the main street
  g.add(paint(0.1, 1.9, -3.65, 3.95, 0, 0.78))
  g.add(paint(0.1, 1.9, -1.75, 3.95, 0, 0.78))
  g.add(paint(1.9, 0.1, -2.7, 3.0, 0, 0.78))
  const pLetter = plane(0.85, 0.85, new MeshBasicMaterial({ map: roadPaintTexture(), transparent: true, opacity: 0.7 }), -2.7, 0.011, 4.1, -Math.PI / 2)
  g.add(pLetter)
  // wheel stopper
  const stopper = box(1.5, 0.09, 0.16, toonMaterial(0x8b8f9a), -2.7, 0.05, 4.62)
  g.add(stopper)

  // ---- manhole
  const manhole = cylinder(0.36, 0.36, 0.012, 20, wetMaterial(0x2a2f3a, 0.35, 0.8), 1.6, 0.012, 3.55)
  g.add(manhole)
  const ring = new Mesh(new RingGeometry(0.24, 0.33, 22), new MeshBasicMaterial({ color: 0x525a6b, transparent: true, opacity: 0.8 }))
  ring.rotation.x = -Math.PI / 2
  ring.position.set(1.6, 0.02, 3.55)
  g.add(ring)

  // ---- puddles
  const spots: [number, number, number, number, number][] = [
    [1.9, 3.05, 1.05, 0.5, 0.3],
    [0.3, 4.35, 0.8, 0.42, -0.4],
    [2.95, 3.95, 0.65, 0.5, 0.9],
    [-1.0, 2.15, 0.55, 0.28, 0.2],
    [2.9, 0.55, 0.6, 0.26, -0.2],
    [-3.3, 1.1, 0.45, 0.3, 0.5],
    [-3.35, -2.2, 0.36, 0.6, 0.1],
    [-3.34, -4.3, 0.5, 0.34, 0.7],
    [4.3, 0.9, 0.7, 0.34, -0.5],
    [4.55, 3.9, 0.55, 0.3, 0.4],
    [-1.6, 4.5, 0.5, 0.26, -0.8],
    [0.15, 0.95, 0.5, 0.22, 0.1],
    [3.2, -1.6, 0.4, 0.22, 0.6],
    [-2.0, -4.4, 0.75, 0.6, 0.2],
  ]
  for (const [x, z, rx, rz, rot] of spots) g.add(puddle(x, z, rx, rz, rot))

  // faint painted parking corner line in the back yard
  g.add(paint(1.2, 0.08, 1.2, -4.4, 0, 0.35))

  return g
}
