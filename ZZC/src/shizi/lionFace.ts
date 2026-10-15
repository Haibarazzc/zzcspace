import * as T from 'three'

type Displacement = (x: number, y: number, z: number) => [number, number, number]

// Sampled from the native base-color texture through its UVs after normalizing
// the supplied Y-up GLB to three units. The two eyes are slightly asymmetric.
const eyes = [
  { x: -0.3955, y: 1.7876 },
  { x: 0.3941, y: 1.7939 },
] as const

function eyeField(x: number, y: number, z: number) {
  const eye = eyes[x < 0 ? 0 : 1]
  const dx = x - eye.x, dy = y - eye.y
  const radius = Math.hypot(dx / 0.116, dy / 0.134)
  // The eye surface slopes back toward the mane. In this local depth frame
  // its brown texture spans 0.475..0.565; the cheek in front is beyond 0.61.
  const depth = z + (Math.abs(x) - 0.395) * 0.65
  const weight = (1 - T.MathUtils.smootherstep(radius, 1.08, 1.85))
    * T.MathUtils.smootherstep(depth, 0.40, 0.47)
    * (1 - T.MathUtils.smootherstep(depth, 0.575, 0.625))
  return { eye, dx, dy, weight }
}

const smile: Displacement = (x, y, z) => {
  const side = Math.abs(x)
  const front = T.MathUtils.smootherstep(z, 0.35, 0.55)
    * T.MathUtils.smootherstep(side, 0.16, 0.25)
    * (1 - T.MathUtils.smootherstep(side, 0.65, 0.74))
    * T.MathUtils.smootherstep(y, 1.18, 1.25)
    * (1 - T.MathUtils.smootherstep(y, 1.54, 1.62))
  if (!front) return [0, 0, 0]
  const corner = 1 - T.MathUtils.smootherstep(Math.hypot((side - 0.45) / 0.23, (y - 1.42) / 0.20), 0, 1)
  const cheek = 1 - T.MathUtils.smootherstep(Math.hypot((side - 0.51) / 0.18, (y - 1.535) / 0.12), 0, 1)
  return [Math.sign(x) * corner * front * 0.004, (corner * 0.015 + cheek * 0.004) * front, cheek * front * 0.0015]
}

const blink: Displacement = (x, y, z) => {
  const { dx, dy, weight } = eyeField(x, y, z)
  if (!weight) return [0, 0, 0]
  // Compress the native painted eye into a soft smiling crease. Keeping a
  // little thickness avoids collapsing triangles or needing an overlay lid.
  const arc = -0.004 + 0.008 * Math.exp(-((dx / 0.105) ** 2))
  return [0, (arc - dy * 0.92) * weight, -0.018 * weight]
}

const lookX: Displacement = (x, y, z) => [eyeField(x, y, z).weight * 0.005, 0, 0]
const lookY: Displacement = (x, y, z) => [0, eyeField(x, y, z).weight * 0.004, 0]

// Transform the supplied normal by the field's inverse-transpose Jacobian.
// Unlike recomputing normals on UV-split triangles, this retains the native
// smooth shading and normal-map basis; an untouched vertex gets zero offset.
function createTarget(geometry: T.BufferGeometry, name: string, field: Displacement) {
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal')
  const offsets = new Float32Array(position.count * 3)
  const normalOffsets = new Float32Array(position.count * 3)
  const jacobian = new T.Matrix3(), transformed = new T.Vector3()
  const epsilon = 0.0001
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
    const displacement = field(x, y, z)
    offsets.set(displacement, i * 3)
    if (!normal || !displacement.some(value => value !== 0)) continue
    const xp = field(x + epsilon, y, z), xm = field(x - epsilon, y, z)
    const yp = field(x, y + epsilon, z), ym = field(x, y - epsilon, z)
    const zp = field(x, y, z + epsilon), zm = field(x, y, z - epsilon)
    const derivative = (a: number, b: number) => (a - b) / (2 * epsilon)
    jacobian.set(
      1 + derivative(xp[0], xm[0]), derivative(yp[0], ym[0]), derivative(zp[0], zm[0]),
      derivative(xp[1], xm[1]), 1 + derivative(yp[1], ym[1]), derivative(zp[1], zm[1]),
      derivative(xp[2], xm[2]), derivative(yp[2], ym[2]), 1 + derivative(zp[2], zm[2]),
    ).invert().transpose()
    transformed.fromBufferAttribute(normal, i).applyMatrix3(jacobian).normalize()
    normalOffsets.set([
      transformed.x - normal.getX(i), transformed.y - normal.getY(i), transformed.z - normal.getZ(i),
    ], i * 3)
  }
  const targetPosition = new T.Float32BufferAttribute(offsets, 3)
  targetPosition.name = name
  const targetNormal = new T.Float32BufferAttribute(normalOffsets, 3)
  targetNormal.name = name
  return { position: targetPosition, normal: targetNormal }
}

// Influences: [Smile 0..1, Blink 0..1, LookX -1..1, LookY -1..1].
// UVs, native positions/normals, vertex splits, and index remain unchanged.
export function addNativeFaceMorphs(geometry: T.BufferGeometry): T.BufferGeometry {
  const targets = [
    createTarget(geometry, 'Smile', smile),
    createTarget(geometry, 'Blink', blink),
    createTarget(geometry, 'LookX', lookX),
    createTarget(geometry, 'LookY', lookY),
  ]
  geometry.morphTargetsRelative = true
  geometry.morphAttributes.position = targets.map(target => target.position)
  geometry.morphAttributes.normal = targets.map(target => target.normal)
  return geometry
}
