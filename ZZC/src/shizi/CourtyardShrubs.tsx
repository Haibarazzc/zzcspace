import { useEffect, useMemo } from 'react'
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

type ShrubBed = readonly [x: number, z: number, size: number]
type LeafInstance = { matrix: T.Matrix4; color: T.Color }

const BEDS: readonly ShrubBed[] = [
  [-2.55, 1.8, .39], [2.65, .95, .33], [-2.9, -.55, .32], [3, -.7, .41],
  [-1.75, 3.25, .28], [4.7, 2.2, .24], [-4.15, -4.4, .3],
]
const noRaycast = () => {}
const random = (seed: number) => T.MathUtils.euclideanModulo(Math.sin(seed * 127.1 + 311.7) * 43758.5453, 1)

// Eight triangles make an oval leaf with a raised central fold and curled tip.
// The two halves have separate ridge vertices, so their normals preserve the
// crease instead of looking like a flat card. Every leaf shares this geometry.
function makeLeafGeometry() {
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute([
    0, 0, 0, -.13, .23, -.018, -.235, .51, -.025, -.145, .81, -.037, 0, 1, -.065, 0, .5, .052,
    0, 0, 0, .13, .23, -.018, .235, .51, -.025, .145, .81, -.037, 0, 1, -.065, 0, .5, .052,
  ], 3))
  geometry.setIndex([5, 1, 0, 5, 2, 1, 5, 3, 2, 5, 4, 3, 11, 6, 7, 11, 7, 8, 11, 8, 9, 11, 9, 10])
  const colors: number[] = []
  for (let i = 0; i < 12; i++) {
    const tone = i % 6 === 5 ? 1 : i % 6 === 4 ? .99 : i % 6 === 0 ? .8 : .94
    colors.push(tone, tone, tone)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

export function buildCourtyardShrubs() {
  const group = new T.Group()
  const branches: T.BufferGeometry[] = []
  const leaves: LeafInstance[] = []
  const perBed: { leaves: number; branches: number }[] = []
  const darkLeaf = new T.Color('#526e48'), matureLeaf = new T.Color('#83975e'), freshLeaf = new T.Color('#a3ad72')
  const matrix = new T.Matrix4(), rotation = new T.Quaternion(), scale = new T.Vector3()
  const xAxis = new T.Vector3(), yAxis = new T.Vector3(), zAxis = new T.Vector3()
  const roll = new T.Quaternion()

  const branch = (points: T.Vector3[], baseRadius: number, tipRadius: number, seed: number, main: boolean) => {
    const curve = new T.CatmullRomCurve3(points)
    const segments = main ? 4 : 2, sides = main ? 5 : 4
    const geometry = new T.TubeGeometry(curve, segments, 1, sides, false)
    const positions = geometry.getAttribute('position'), colors: number[] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, center = curve.getPointAt(t), radius = T.MathUtils.lerp(baseRadius, tipRadius, t)
      for (let j = 0; j <= sides; j++) {
        const index = i * (sides + 1) + j
        const position = new T.Vector3().fromBufferAttribute(positions, index).sub(center).multiplyScalar(radius).add(center)
        positions.setXYZ(index, position.x, position.y, position.z)
        const color = new T.Color('#4b4735').lerp(new T.Color('#7c6949'), .24 + .23 * random(seed + j * 5))
        colors.push(color.r, color.g, color.b)
      }
    }
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
    geometry.deleteAttribute('uv'); geometry.computeVertexNormals(); branches.push(geometry)
    return curve
  }
  const leaf = (at: T.Vector3, direction: T.Vector3, length: number, seed: number, freshness: number) => {
    yAxis.copy(direction).normalize()
    // Broad leaf faces lean outward as well as upward. This keeps the crown
    // visibly green at the low camera angle instead of showing thin edges.
    const facing = random(seed + 47) < .5 ? -1 : 1
    zAxis.set(-direction.z * .78 * facing, .72, direction.x * .78 * facing).normalize().addScaledVector(yAxis, -zAxis.dot(yAxis)).normalize()
    xAxis.crossVectors(yAxis, zAxis).normalize(); zAxis.crossVectors(xAxis, yAxis).normalize()
    matrix.makeBasis(xAxis, yAxis, zAxis); rotation.setFromRotationMatrix(matrix)
    roll.setFromAxisAngle(new T.Vector3(0, 1, 0), (random(seed + 17) - .5) * .7); rotation.multiply(roll)
    scale.set(length * 1.3 * 1.15 * (.86 + random(seed + 13) * .27), length * 1.3, length * 1.3)
    matrix.compose(at, rotation, scale)
    const tone = T.MathUtils.clamp(freshness * .78 + random(seed + 31) * .22, 0, 1)
    const color = darkLeaf.clone().lerp(matureLeaf, tone)
    if (freshness > .8) color.lerp(freshLeaf, (freshness - .8) * 2.25)
    leaves.push({ matrix: matrix.clone(), color })
  }

  BEDS.forEach(([x, z, size], bedIndex) => {
    const seed = 401 + bedIndex * 853, r = (n: number) => random(seed + n)
    const startLeaves = leaves.length, startBranches = branches.length
    const shoots = size > .35 ? 6 : size < .26 ? 4 : 5
    const rotationAngle = r(1) * Math.PI * 2
    for (let shoot = 0; shoot < shoots; shoot++) {
      const a = rotationAngle + shoot * 2.399 + (r(shoot * 41 + 3) - .5) * .45
      const spread = size * (.29 + r(shoot * 41 + 5) * .3)
      const height = .035 + size * (.84 + r(shoot * 41 + 7) * .29)
      const root = new T.Vector3(x + Math.cos(a) * .014, .002, z + Math.sin(a) * .014)
      const tip = new T.Vector3(x + Math.cos(a) * spread, height, z + Math.sin(a) * spread)
      const main = branch([
        root,
        new T.Vector3(x + Math.cos(a) * spread * .12, height * .32, z + Math.sin(a) * spread * .12),
        new T.Vector3(x + Math.cos(a + .16) * spread * .68, height * .77, z + Math.sin(a + .16) * spread * .68),
        tip,
      ], size * .026, size * .007, seed + shoot * 101, true)
      // Alternate leaflets low on the main stems keep the base planted and
      // leafy, while leaving small glimpses of their woody branching.
      for (let n = 0; n < 5; n++) {
        const t = .2 + n * .135
        for (const side of [-1, 1]) {
          const at = main.getPoint(t + (side === 1 ? .025 : 0))
          const direction = new T.Vector3(Math.cos(a + side * .9), -.1 + r(n + shoot * 5 + side + 31) * .5, Math.sin(a + side * .9))
          leaf(at, direction, .07 + size * .1 + r(n + shoot * 39) * .02, seed + n * 17 + shoot * 211 + side, .16 + t * .6)
        }
      }
      for (let twig = 0; twig < 4; twig++) {
        const n = shoot * 193 + twig * 31, side = twig % 2 ? 1 : -1
        const at = main.getPoint(.41 + twig * .15)
        const angle = a + side * (.52 + r(n + 11) * .58)
        const reach = size * (.34 + r(n + 13) * .28)
        const lift = size * (.12 + r(n + 15) * .14) * (twig === 3 ? .55 : 1)
        const out = new T.Vector3(Math.cos(angle), 0, Math.sin(angle))
        const end = at.clone().addScaledVector(out, reach).add(new T.Vector3(0, lift, 0))
        const curve = branch([at, at.clone().lerp(end, .55).add(new T.Vector3(0, size * .055, 0)), end], size * .011, size * .002, seed + n, false)
        // Paired, alternating leaves follow real twig nodes instead of
        // scattering disconnected leaves over an invisible sphere.
        for (let node = 0; node < 5; node++) {
          const t = .16 + node * .185, point = curve.getPoint(t)
          for (const leafSide of [-1, 1]) {
            const leafAngle = angle + leafSide * (.66 + r(n + node * 7 + leafSide + 28) * .35)
            const direction = new T.Vector3(Math.cos(leafAngle), -.28 + r(n + node * 11 + leafSide + 51) * .9, Math.sin(leafAngle))
            const freshness = T.MathUtils.clamp((point.y - .06) / (size * 1.1), .08, .94)
            const length = (.073 + r(n + node * 13 + leafSide + 67) * .044) * (.88 + size * .4) * (node === 4 ? .82 : 1)
            leaf(point, direction, length, seed + n * 19 + node * 37 + leafSide, freshness)
          }
        }
        // Five overlapping terminal leaves make a small irregular rosette;
        // two are young upright leaves and three are larger outward leaves.
        for (let bud = 0; bud < 5; bud++) {
          const budAngle = angle + bud * 2.399
          const direction = new T.Vector3(Math.cos(budAngle) * .8, bud < 2 ? .62 : -.12 + r(n + bud * 13 + 77) * .5, Math.sin(budAngle) * .8)
          leaf(end, direction, (bud < 2 ? .058 : .074) + r(n + bud * 29 + 89) * .023, seed + n * 41 + bud, bud < 2 ? .98 : .75)
        }
      }
    }
    perBed.push({ leaves: leaves.length - startLeaves, branches: branches.length - startBranches })
  })

  const branchGeometry = mergeGeometries(branches)!
  branches.forEach(geometry => geometry.dispose())
  branchGeometry.computeBoundingBox(); branchGeometry.computeBoundingSphere()
  const branchMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  const wood = new T.Mesh(branchGeometry, branchMaterial)
  wood.castShadow = true; wood.receiveShadow = true; wood.raycast = noRaycast
  const leafGeometry = makeLeafGeometry()
  const leafMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, side: T.DoubleSide, shadowSide: T.FrontSide, emissive: '#344124', emissiveIntensity: .055 })
  const foliage = new T.InstancedMesh(leafGeometry, leafMaterial, leaves.length)
  leaves.forEach((instance, index) => { foliage.setMatrixAt(index, instance.matrix); foliage.setColorAt(index, instance.color) })
  foliage.instanceMatrix.needsUpdate = true
  if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true
  foliage.castShadow = true; foliage.receiveShadow = true; foliage.raycast = noRaycast
  foliage.computeBoundingBox(); foliage.computeBoundingSphere()
  group.add(wood, foliage)
  return {
    group,
    stats: { beds: BEDS.length, leaves: leaves.length, branches: branches.length, triangles: (branchGeometry.index!.count + leafGeometry.index!.count * leaves.length) / 3, perBed },
    dispose() {
      branchGeometry.dispose(); leafGeometry.dispose()
      branchMaterial.dispose(); leafMaterial.dispose(); foliage.dispose()
    },
  }
}

export default function CourtyardShrubs() {
  const shrubs = useMemo(buildCourtyardShrubs, [])
  useEffect(() => () => shrubs.dispose(), [shrubs])
  return <primitive object={shrubs.group} dispose={null} />
}
