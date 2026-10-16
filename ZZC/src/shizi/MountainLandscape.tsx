import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { PoseId } from './data'

type Peak = { x: number; z: number; radial: number; tangent: number; angle: number; height: number }
type Layer = { inner: number; outer: number; rise: [number, number]; fall: [number, number]; rows: number; peaks: Peak[]; low: string; high: string; rock: string }
const TERRAIN_COLUMNS = 192
const noRaycast = () => {}
const random = (seed: number) => T.MathUtils.euclideanModulo(Math.sin(seed * 127.1 + 311.7) * 43758.5453, 1)
const smooth = (a: number, b: number, value: number) => T.MathUtils.smoothstep(value, a, b)

function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), tx = smooth(0, 1, x - ix), tz = smooth(0, 1, z - iz)
  const sample = (dx: number, dz: number) => random((ix + dx) * 137 + (iz + dz) * 293 + 719)
  return T.MathUtils.lerp(T.MathUtils.lerp(sample(0, 0), sample(1, 0), tx), T.MathUtils.lerp(sample(0, 1), sample(1, 1), tx), tz)
}

function peaks(seed: number, count: number, radius: [number, number], height: [number, number], width: [number, number]): Peak[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = i * 2.39996323 + seed * .371 + (random(seed + i * 31) - .5) * .33
    const r = T.MathUtils.lerp(...radius, random(seed + i * 31 + 3))
    return {
      x: Math.cos(angle) * r, z: Math.sin(angle) * r, angle: angle + (random(seed + i * 31 + 4) - .5) * .85,
      radial: T.MathUtils.lerp(...width, random(seed + i * 31 + 7)),
      tangent: T.MathUtils.lerp(...width, random(seed + i * 31 + 8)) * (1.1 + random(seed + i * 31 + 9) * .65),
      height: T.MathUtils.lerp(...height, random(seed + i * 31 + 11)),
    }
  })
}

// Every layer is a complete annular heightfield, not a row of isolated cones.
// Off-centre, stretched peaks overlap into ridges; world-space noise cuts
// smaller gullies through them without introducing a seam at north.
function heightAt(layer: Layer, x: number, z: number) {
  const r = Math.hypot(x, z)
  const envelope = smooth(...layer.rise, r) * (1 - smooth(...layer.fall, r))
  if (envelope === 0) return -.045
  let highest = 0, combined = 0
  for (const peak of layer.peaks) {
    const dx = x - peak.x, dz = z - peak.z, c = Math.cos(peak.angle), s = Math.sin(peak.angle)
    const along = (dx * c + dz * s) / peak.radial, across = (-dx * s + dz * c) / peak.tangent
    const rugged = layer.inner > 20
    const distance = along * along + across * across
    const field = Math.exp(-.64 * (rugged ? distance ** .59 : distance)) * peak.height
    highest = Math.max(highest, field); combined += field
  }
  const rugged = layer.inner > 20
  const warpX = x + Math.sin(z * .12 + .7) * 3.6, warpZ = z + Math.sin(x * .11 - .4) * 3.2
  const ridged = 1 - Math.abs(noise(warpX * .19 + 17, warpZ * .19 - 23) * 2 - 1)
  const fineRidges = 1 - Math.abs(noise(warpX * .44 - 9, warpZ * .44 + 11) * 2 - 1)
  const erosion = rugged ? .52 + ridged * .34 + fineRidges * .14 : .82 + noise(x * .31 + 27, z * .31 - 19) * .18
  const gullies = (noise(x * .13, z * .13) - .5) * (rugged ? 1.7 : .65) + (noise(x * .63 + 3, z * .63) - .5) * (rugged ? .68 : .25)
  return -.045 + envelope * Math.max(.2, (.4 + highest + combined * .1) * erosion + gullies)
}

function buildTerrain(layer: Layer, columns = TERRAIN_COLUMNS) {
  const positions: number[] = [], indices: number[] = []
  for (let row = 0; row <= layer.rows; row++) {
    const t = row / layer.rows
    const radius = layer.inner === 9.5 ? [9.5, 11, 12.5, 13.5, 14.7, 16.2, 17.8, 19.5, 21.4, 23.5, 25.7, 27.8, 30][row] : T.MathUtils.lerp(layer.inner, layer.outer, t)
    for (let col = 0; col <= columns; col++) {
      // The repeated seam column uses precisely the same coordinates.
      const angle = col === columns ? 0 : col / columns * Math.PI * 2
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius
      positions.push(x, heightAt(layer, x, z), z)
    }
  }
  for (let row = 0; row < layer.rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + 1, c = a + columns + 1, d = c + 1
    indices.push(a, b, c, b, d, c)
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals()
  const normals = geometry.getAttribute('normal'), position = geometry.getAttribute('position')
  const average = new T.Vector3()
  for (let row = 0; row <= layer.rows; row++) {
    const first = row * (columns + 1), last = first + columns
    average.fromBufferAttribute(normals, first).add(new T.Vector3().fromBufferAttribute(normals, last)).normalize()
    normals.setXYZ(first, average.x, average.y, average.z); normals.setXYZ(last, average.x, average.y, average.z)
  }
  const low = new T.Color(layer.low), high = new T.Color(layer.high), rock = new T.Color(layer.rock)
  const gardenGrass = new T.Color('#5a6a49')
  const colors: number[] = []
  const maxPeak = Math.max(...layer.peaks.map(peak => peak.height)) * 1.18
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i), y = position.getY(i)
    const altitude = T.MathUtils.clamp(y / maxPeak, 0, 1)
    const shade = .14 + altitude * .58 + noise(x * .19 + 9, z * .19) * .22
    const color = low.clone().lerp(high, shade)
    color.lerp(rock, smooth(.18, .66, 1 - normals.getY(i)) * .36)
    if (layer.inner === 9.5) color.lerp(gardenGrass, 1 - smooth(11, 15, Math.hypot(x, z)))
    colors.push(color.r, color.g, color.b)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  geometry.userData.columns = columns; geometry.userData.rows = layer.rows
  return geometry
}

// Sample the actual triangles, not only the analytic heightfield: this keeps
// tree roots attached even where the low-poly terrain interpolates a gully.
function terrainSurface(geometry: T.BufferGeometry, x: number, z: number) {
  const columns = geometry.userData.columns as number, stride = columns + 1, position = geometry.getAttribute('position')
  const rows = position.count / stride - 1, radius = Math.hypot(x, z)
  if (radius < position.getX(0) || radius > position.getX(rows * stride)) return -Infinity
  let row = 0
  while (row < rows - 1 && position.getX((row + 1) * stride) < radius) row++
  const angle = T.MathUtils.euclideanModulo(Math.atan2(z, x), Math.PI * 2)
  const col = Math.min(columns - 1, Math.floor(angle / (Math.PI * 2) * columns))
  for (let candidate = Math.max(0, row - 1); candidate <= Math.min(rows - 1, row + 1); candidate++) {
    const a = candidate * stride + col, b = a + 1, c = a + stride, d = c + 1
    for (const [ia, ib, ic] of [[a, b, c], [b, d, c]]) {
      const ax = position.getX(ia), az = position.getZ(ia), bx = position.getX(ib), bz = position.getZ(ib), cx = position.getX(ic), cz = position.getZ(ic)
      const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator
      const w = 1 - u - v
      if (u >= -.00001 && v >= -.00001 && w >= -.00001) return u * position.getY(ia) + v * position.getY(ib) + w * position.getY(ic)
    }
  }
  return -Infinity
}

function makeEvergreen() {
  const pieces: T.BufferGeometry[] = []
  const add = (geometry: T.BufferGeometry, color: string) => {
    geometry.deleteAttribute('uv')
    const rgb = new T.Color(color), colors: number[] = []
    for (let i = 0; i < geometry.getAttribute('position').count; i++) colors.push(rgb.r, rgb.g, rgb.b)
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); pieces.push(geometry)
  }
  add(new T.CylinderGeometry(.027, .047, 1.02, 5).translate(0, .51, 0), '#68644a')
  for (let tier = 0; tier < 3; tier++) {
    const geometry = new T.ConeGeometry(.36 - tier * .075, .76 - tier * .08, 6)
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
      const wave = 1 + .13 * Math.sin(x * 19 + z * 13 + tier * 2)
      position.setXYZ(i, x * wave, y + .025 * Math.sin(x * 11 + z * 17), z * wave)
    }
    geometry.translate(tier * .012, .7 + tier * .32, tier * -.012); geometry.computeVertexNormals()
    const normals = geometry.getAttribute('normal')
    for (let i = 0; i < normals.count; i++) if (Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) < .5) normals.setXYZ(i, 0, 1, 0)
    add(geometry, ['#566d4d', '#627955', '#758664'][tier])
  }
  const geometry = mergeGeometries(pieces)!
  pieces.forEach(piece => piece.dispose()); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

export function buildMountainLandscape() {
  const layers: Layer[] = [
    { inner: 9.5, outer: 30, rise: [13.5, 17.4], fall: [25, 30], rows: 12, peaks: peaks(37, 12, [18, 24], [1.7, 4.2], [2.7, 5.2]), low: '#354d40', high: '#536c55', rock: '#697565' },
    { inner: 22, outer: 47, rise: [23, 28], fall: [42, 47], rows: 18, peaks: peaks(91, 11, [30, 39], [6.5, 13.8], [3.6, 7.1]), low: '#405e66', high: '#66818a', rock: '#8b9595' },
    { inner: 39, outer: 65, rise: [40, 45], fall: [60, 65], rows: 20, peaks: peaks(163, 13, [47, 57], [11.5, 20], [4.5, 8.3]), low: '#587787', high: '#8397a4', rock: '#9ba6aa' },
  ]
  const group = new T.Group()
  const materials = layers.map((_, i) => new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: i > 0 }))
  const geometries = layers.map(layer => buildTerrain(layer))
  geometries.forEach((geometry, i) => {
    const mesh = new T.Mesh(geometry, materials[i]); mesh.raycast = noRaycast; mesh.castShadow = false; mesh.receiveShadow = false
    group.add(mesh)
  })
  const treeGeometry = makeEvergreen()
  const treeMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  const treeCount = 330
  const forest = new T.InstancedMesh(treeGeometry, treeMaterial, treeCount)
  const dummy = new T.Object3D()
  let placed = 0
  for (let candidate = 0; placed < treeCount && candidate < 2000; candidate++) {
    const cluster = Math.floor(candidate / 11)
    const angle = cluster * 2.39996323 + (random(candidate + 611) - .5) * .15
    const radius = 17 + random(cluster * 13 + 881) * 12 + (random(candidate + 881) - .5) * 2.4
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius
    const y = Math.max(...geometries.map(geometry => terrainSurface(geometry, x, z)))
    if (!Number.isFinite(y)) continue
    // Small groves prefer gentler lower slopes; gaps retain the terrain's
    // ridge-and-valley silhouette rather than making a uniform tree wall.
    const slope = Math.hypot(heightAt(layers[0], x + .2, z) - heightAt(layers[0], x - .2, z), heightAt(layers[0], x, z + .2) - heightAt(layers[0], x, z - .2)) / .4
    if (y > 7.6 || slope > 1.1 || random(candidate + 2201) < .16) continue
    const height = (.68 + random(candidate + 1001) * .72) * .58
    dummy.position.set(x, y - .025, z); dummy.rotation.set(0, random(candidate + 1201) * Math.PI * 2, 0)
    dummy.scale.set(height * (.82 + random(candidate + 1301) * .3), height, height)
    dummy.updateMatrix(); forest.setMatrixAt(placed, dummy.matrix)
    forest.setColorAt(placed, new T.Color('#7d927c').lerp(new T.Color('#b6c0a4'), random(candidate + 1401) * .65))
    placed++
  }
  forest.count = placed; forest.instanceMatrix.needsUpdate = true
  if (forest.instanceColor) forest.instanceColor.needsUpdate = true
  forest.computeBoundingBox(); forest.computeBoundingSphere(); forest.raycast = noRaycast
  forest.castShadow = false; forest.receiveShadow = false; group.add(forest)
  return {
    group, materials: [...materials, treeMaterial],
    stats: { terrainTriangles: geometries.reduce((sum, geometry) => sum + geometry.index!.count / 3, 0), trees: placed, treeTriangles: treeGeometry.index!.count / 3 * placed, drawCalls: group.children.length, radius: 65 },
    dispose() {
      geometries.forEach(geometry => geometry.dispose()); treeGeometry.dispose()
      materials.forEach(material => material.dispose()); treeMaterial.dispose(); forest.dispose()
    },
  }
}

export default function MountainLandscape({ pose }: { pose: PoseId }) {
  const landscape = useMemo(buildMountainLandscape, [])
  const targets = useMemo(() => {
    const colors = pose === 'glance' ? ['#637b85', '#8197a5', '#a5b5c5', '#5d747a']
      : pose === 'cheer' ? ['#fff0ce', '#f6ead4', '#f3e5dc', '#fff1d1'] : ['#ffffff', '#ffffff', '#ffffff', '#ffffff']
    return colors.map(color => new T.Color(color))
  }, [pose])
  useFrame((_, dt) => {
    landscape.materials.forEach((material, i) => material.color.lerp(targets[i], 1 - Math.exp(-Math.min(dt, .05) * 1.8)))
  })
  useEffect(() => () => landscape.dispose(), [landscape])
  return <primitive object={landscape.group} dispose={null} />
}
