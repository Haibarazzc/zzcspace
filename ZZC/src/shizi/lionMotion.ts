import * as T from 'three'
import type { PoseId } from './data'
import { addNativeFaceMorphs } from './lionFace'

export const BODY_PIVOT = 0.32
export const HEAD_PIVOT = 1.13
export const CHEER_DURATION = 3.7
export const CHEER_PEAK_TIME = 1.45
export const PET_DURATION = 2.8
export const PET_PEAK_TIME = 0.9
const CHEER_ARM_SCALE = 1

// Both the sculpt and its separate tooth/tongue meshes use normalized model
// coordinates, so one field keeps the original mouth contour joined together.
export function smileDisplacement(x: number, y: number, z: number): [number, number, number] {
  const side = Math.abs(x)
  const front = T.MathUtils.smoothstep(z, 0.44, 0.62)
    * T.MathUtils.smoothstep(side, 0.145, 0.23)
    * (1 - T.MathUtils.smoothstep(side, 0.64, 0.72))
    * T.MathUtils.smoothstep(y, 1.19, 1.27)
    * (1 - T.MathUtils.smoothstep(y, 1.56, 1.64))
  if (!front) return [0, 0, 0]
  const corner = 1 - T.MathUtils.smoothstep(Math.hypot((side - 0.39) / 0.29, (y - 1.43) / 0.22), 0, 1)
  const cheek = 1 - T.MathUtils.smoothstep(Math.hypot((side - 0.50) / 0.19, (y - 1.555) / 0.14), 0, 1)
  return [Math.sign(x) * corner * front * 0.006, (corner * 0.020 + cheek * 0.006) * front, cheek * front * 0.0025]
}

export function getPetAmount(petAge: number) {
  return petAge >= 0 && petAge < PET_DURATION
    ? T.MathUtils.smootherstep(petAge, 0, 0.62) * (1 - T.MathUtils.smootherstep(petAge, 1.45, PET_DURATION)) : 0
}

export function getSmileAmount(cheerAge: number, reactionAge = 100, petAge = 100) {
  const cheer = cheerAge >= 0 && cheerAge < CHEER_DURATION
    ? T.MathUtils.smootherstep(cheerAge, 0.10, 1.04) * (1 - T.MathUtils.smootherstep(cheerAge, 2.35, CHEER_DURATION)) : 0
  const response = reactionAge >= 0 && reactionAge < 1.7
    ? Math.sin(reactionAge * Math.PI / 1.7) ** 2 * 0.18 : 0
  return Math.max(cheer, response, getPetAmount(petAge) * 0.88)
}

export function addSmileMorph(geometry: T.BufferGeometry, origin: [number, number, number] = [0, 0, 0]) {
  const position = geometry.getAttribute('position')
  const offsets = new Float32Array(position.count * 3)
  const target = geometry.clone()
  const targetPosition = target.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
    const displacement = smileDisplacement(x + origin[0], y + origin[1], z + origin[2])
    offsets.set(displacement, i * 3)
    targetPosition.setXYZ(i, x + displacement[0], y + displacement[1], z + displacement[2])
  }
  target.computeVertexNormals()
  const normal = geometry.getAttribute('normal'), targetNormal = target.getAttribute('normal')
  const normalOffsets = new Float32Array(position.count * 3)
  for (let i = 0; i < normalOffsets.length; i++) normalOffsets[i] = targetNormal.array[i] - normal.array[i]
  const smilePosition = new T.Float32BufferAttribute(offsets, 3)
  smilePosition.name = 'Smile'
  geometry.morphTargetsRelative = true
  geometry.morphAttributes.position = [smilePosition]
  geometry.morphAttributes.normal = [new T.Float32BufferAttribute(normalOffsets, 3)]
  target.dispose()
  return geometry
}

// Distal hands form separate branches below y=0.70. Following connectivity
// includes each thumb without pulling in the adjacent belly surface.
function createArmWeights(geometry: T.BufferGeometry) {
  const position = geometry.getAttribute('position'), count = position.count
  // UV seams duplicate the surface vertices in the textured model. Weld only
  // the logical graph, keeping the actual UVs, normals and indices unchanged.
  const weldedIndices = new Uint32Array(count)
  const weldedVertices: number[] = []
  const positions = new Map<string, number>()
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(position.getX(i) * 1e5)},${Math.round(position.getY(i) * 1e5)},${Math.round(position.getZ(i) * 1e5)}`
    let vertex = positions.get(key)
    if (vertex === undefined) {
      vertex = weldedVertices.length
      positions.set(key, vertex)
      weldedVertices.push(i)
    }
    weldedIndices[i] = vertex
  }
  const neighbors = Array.from({ length: weldedVertices.length }, () => new Set<number>())
  const index = geometry.getIndex()!
  for (let i = 0; i < index.count; i += 3) {
    const a = weldedIndices[index.getX(i)], b = weldedIndices[index.getX(i + 1)], c = weldedIndices[index.getX(i + 2)]
    if (a !== b) { neighbors[a].add(b); neighbors[b].add(a) }
    if (b !== c) { neighbors[b].add(c); neighbors[c].add(b) }
    if (c !== a) { neighbors[c].add(a); neighbors[a].add(c) }
  }
  const weights = new Float32Array(weldedVertices.length)
  const inHand = (vertex: number, side: number) => {
    const i = weldedVertices[vertex], y = position.getY(i)
    return y >= 0.32 && y < 0.70 && position.getZ(i) > -0.15 && side * position.getX(i) > 0.48
  }
  for (const side of [-1, 1]) {
    let seed = -1, nearest = Infinity
    for (let vertex = 0; vertex < weldedVertices.length; vertex++) {
      if (!inHand(vertex, side)) continue
      const i = weldedVertices[vertex]
      const d = Math.hypot(position.getX(i) - side * 0.60, position.getY(i) - 0.55, position.getZ(i) - 0.16)
      if (d < nearest) { nearest = d; seed = vertex }
    }
    if (seed === -1) continue
    const queue = [seed], seen = new Set(queue)
    for (let at = 0; at < queue.length; at++) {
      const i = queue[at]
      weights[i] = 1
      for (const n of neighbors[i]) {
        if (!seen.has(n) && inHand(n, side)) {
          seen.add(n); queue.push(n)
        }
      }
    }
  }
  const free: number[] = []
  for (let vertex = 0; vertex < weldedVertices.length; vertex++) {
    const i = weldedVertices[vertex]
    if (weights[vertex] === 0 && position.getY(i) > 0.32 && position.getY(i) < 1.04
      && Math.abs(position.getX(i)) > 0.40 && position.getZ(i) > -0.18) free.push(vertex)
  }
  // Blend every unpinned vertex around the palm and shoulder, including the
  // inner thumb and belly side. Limiting the blend to y>=0.70 would cut across
  // this denser sculpt's fused arm/body surface and create stretched slivers.
  const links = free.map(vertex => {
    const i = weldedVertices[vertex]
    return Array.from(neighbors[vertex], n => {
      const j = weldedVertices[n]
      return { n, weight: 1 / Math.max(0.0001, Math.hypot(position.getX(i) - position.getX(j), position.getY(i) - position.getY(j), position.getZ(i) - position.getZ(j))) }
    })
  })
  const next = new Float32Array(free.length)
  for (let pass = 0; pass < 180; pass++) {
    for (let at = 0; at < free.length; at++) {
      let value = 0, sum = 0
      for (const link of links[at]) { value += weights[link.n] * link.weight; sum += link.weight }
      next[at] = sum ? value / sum : weights[free[at]]
    }
    free.forEach((i, at) => { weights[i] = next[at] })
  }
  return { weights, weldedIndices, weldedVertices }
}

// Local arm chains articulate the original surface while the plinth stays fixed.
export function createLionRig(source: T.BufferGeometry, sourceMaterial: T.Material | T.Material[]) {
  const geometry = source.clone()
  addNativeFaceMorphs(geometry)
  const position = geometry.getAttribute('position')
  const surface = createArmWeights(geometry)
  const indices = new Uint16Array(position.count * 4)
  const weights = new Float32Array(position.count * 4)
  for (let i = 0; i < position.count; i++) {
    const vertex = surface.weldedVertices[surface.weldedIndices[i]]
    const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex)
    const mobile = T.MathUtils.smoothstep(y, 0.32, 0.65)
    const head = T.MathUtils.smoothstep(y, 0.95, 1.20)
    // The back of the mane shares the tail's X/Z range, so gate by height too.
    const tail = T.MathUtils.smoothstep(x, 0.18, 0.70)
      * (1 - T.MathUtils.smoothstep(y, 0.75, 0.88))
      * (1 - T.MathUtils.smoothstep(z, -0.36, -0.18))
      * T.MathUtils.smoothstep(y, 0.17, 0.195)
    const arm = surface.weights[surface.weldedIndices[i]]
    const forearm = 1 - T.MathUtils.smoothstep(y, 0.62, 0.77)
    const shoulderIndex = x < 0 ? 4 : 6
    const influences = [
      [0, (1 - mobile) * (1 - tail) * (1 - arm)],
      [1, mobile * (1 - head) * (1 - tail) * (1 - arm)],
      [2, mobile * head * (1 - tail) * (1 - arm)],
      [3, tail * (1 - arm)],
      [shoulderIndex, arm * (1 - forearm)],
      [shoulderIndex + 1, arm * forearm],
    ].filter(([, weight]) => weight > 0).sort((a, b) => b[1] - a[1]).slice(0, 4)
    const total = influences.reduce((sum, [, weight]) => sum + weight, 0)
    influences.forEach(([index, weight], slot) => {
      indices[i * 4 + slot] = index
      weights[i * 4 + slot] = weight / total
    })
  }
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4))
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4))
  const root = new T.Bone(), body = new T.Bone(), head = new T.Bone(), tail = new T.Bone()
  root.name = 'Ground'
  body.name = 'Breathing'
  head.name = 'Head'
  tail.name = 'Tail'
  body.position.y = BODY_PIVOT
  head.position.y = HEAD_PIVOT - BODY_PIVOT
  tail.position.set(0.12, 0.69 - BODY_PIVOT, -0.28)
  root.add(body)
  body.add(head, tail)
  const shoulders: T.Bone[] = [], elbows: T.Bone[] = []
  for (const side of [-1, 1]) {
    const shoulder = new T.Bone(), elbow = new T.Bone()
    shoulder.name = side < 0 ? 'LeftShoulder' : 'RightShoulder'
    elbow.name = side < 0 ? 'LeftElbow' : 'RightElbow'
    shoulder.position.set(side * 0.38, 0.96 - BODY_PIVOT, 0.14)
    elbow.position.set(side * 0.15, -0.23, 0)
    shoulder.add(elbow)
    body.add(shoulder)
    shoulders.push(shoulder)
    elbows.push(elbow)
  }
  const skeleton = new T.Skeleton([root, body, head, tail, shoulders[0], elbows[0], shoulders[1], elbows[1]])
  // Material.clone retains the original PBR maps and UV setup. Their textures
  // remain owned by the GLTF cache and must outlive this disposable rig.
  const material = Array.isArray(sourceMaterial) ? sourceMaterial.map(value => value.clone()) : sourceMaterial.clone()
  const mesh = new T.SkinnedMesh(geometry, material)
  mesh.add(root)
  mesh.updateMatrixWorld(true)
  mesh.bind(skeleton)
  mesh.computeBoundingSphere()
  mesh.boundingSphere!.radius += 0.55
  mesh.castShadow = mesh.receiveShadow = true
  mesh.frustumCulled = false
  return {
    mesh, body, head, tail, shoulders, elbows, armIndices: [4, 5, 6, 7],
    dispose() {
      geometry.dispose()
      for (const value of Array.isArray(material) ? material : [material]) value.dispose()
      skeleton.dispose()
    },
  }
}

export type LionRig = ReturnType<typeof createLionRig>

function blinkPulse(age: number) {
  if (age < 0 || age > 0.30) return 0
  return age < 0.10 ? T.MathUtils.smoothstep(age, 0, 0.10) : 1 - T.MathUtils.smoothstep(age, 0.10, 0.30)
}

function cheerLift(age: number) {
  return age >= 0 && age < CHEER_DURATION
    ? T.MathUtils.smootherstep(age, 0.22, 1.02) * (1 - T.MathUtils.smootherstep(age, 2.30, 3.60)) : 0
}

export function animateLionRig(rig: LionRig, time: number, reactionAge: number, pose: PoseId, cheerAge = 100, petAge = 100) {
  rig.mesh.morphTargetInfluences![0] = getSmileAmount(cheerAge, reactionAge, petAge)
  const pet = getPetAmount(petAge)
  const cheer = (cheerLift(cheerAge) + cheerLift(cheerAge - 0.10)) * 0.5
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1
    const stagger = i === 0 ? 1 : 0.96
    const age = cheerAge - i * 0.10
    const lift = cheerLift(age)
    // A separate envelope starts and stops the wrist wave at rest, rather
    // than introducing a velocity jump as soon as the hands reach the top.
    const wave = lift * T.MathUtils.smootherstep(age, 1.04, 1.30)
      * (1 - T.MathUtils.smootherstep(age, 2.13, 2.40))
      * Math.sin((age - 1.04) * 7.5)
    // Pitch first moves the short paws forward, clear of the large mane.
    // The localized weights keep the chest still as the short paws rise.
    rig.shoulders[i].rotation.set(-0.85 * lift * CHEER_ARM_SCALE, 0, side * (0.95 * lift + wave * 0.055) * stagger * CHEER_ARM_SCALE, 'ZXY')
    rig.shoulders[i].position.z = 0.14 + lift * 0.055 * CHEER_ARM_SCALE
    rig.elbows[i].rotation.set(-0.20 * lift * CHEER_ARM_SCALE, 0, side * (1.00 * lift + wave * 0.065) * CHEER_ARM_SCALE, 'ZXY')
  }
  const active = cheerAge >= 0 && cheerAge < CHEER_DURATION
  const preparation = active ? T.MathUtils.smootherstep(cheerAge, 0, 0.20)
    * (1 - T.MathUtils.smootherstep(cheerAge, 0.20, 0.52)) : 0
  const settling = active ? T.MathUtils.smootherstep(cheerAge, 2.82, 3.15)
    * (1 - T.MathUtils.smootherstep(cheerAge, 3.15, CHEER_DURATION)) : 0
  const squash = preparation * 0.004 + settling * 0.0012
  const breath = Math.sin(time * 1.65) * 0.008
  // Only the existing mobile body weights compress; feet and plinth stay on
  // the unchanged ground bone throughout the anticipation and recovery.
  rig.body.scale.set(1 + breath * 0.7 + squash * 0.35, 1 + breath * 0.4 - squash, 1 + breath + squash * 0.35)
  rig.body.rotation.z = Math.sin(time * 0.67) * 0.005
  const cycle = time % 11.8
  const nodAge = cycle - 5.1
  const nod = nodAge >= 0 && nodAge < 1.5 ? Math.sin(nodAge / 1.5 * Math.PI) ** 2 : 0
  const greeting = reactionAge >= 0 && reactionAge < 1.7
    ? Math.sin(reactionAge * Math.PI / 1.7) ** 2 : 0
  rig.head.rotation.set(
    Math.sin(time * 0.77) * 0.010 + nod * 0.020 + greeting * Math.sin(reactionAge * 7) * 0.030 - cheer * 0.018 - pet * 0.010,
    Math.sin(time * 0.46) * 0.023 + (pose === 'glance' ? 0.012 : 0) - pet * 0.008,
    Math.sin(time * 0.64) * 0.014 + greeting * 0.018 + pet * 0.036,
  )
  rig.tail.rotation.y = Math.sin(time * 1.8) * 0.060 + Math.sin(time * 2.6) * 0.015 + greeting * Math.sin(reactionAge * 9) * 0.025
    + (pet ? pet * Math.sin(petAge * 5.5) * 0.055 : 0)
  // Uneven spacing and an occasional double blink avoid a mechanical loop.
  const blinkCycle = time % 13.7
  return Math.max(...[2.3, 6.7, 11.5, 11.88].map(at => blinkPulse(blinkCycle - at)), blinkPulse(reactionAge - 0.18), blinkPulse(cheerAge - 0.12))
}
