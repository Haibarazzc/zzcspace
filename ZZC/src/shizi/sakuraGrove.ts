// 樱花树生成器：从 qixia（樱花古境）移植的三级递归分枝 + 单朵五瓣樱花实例化方案。
// 每棵树在原点生成，再用「平移×缩放」矩阵摆放，保证与古境同源的形态。
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

type Instance = { matrix: T.Matrix4; color: T.Color }

export function blossomRandom(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

// 带缺口的杯状花瓣
function createPetalGeometry(segments = 5) {
  const shape = new T.Shape()
  shape.moveTo(0, -.55)
  shape.bezierCurveTo(-.55, -.18, -.5, .55, -.13, .48)
  shape.lineTo(0, .32); shape.lineTo(.13, .48)
  shape.bezierCurveTo(.5, .55, .55, -.18, 0, -.55)
  const geometry = new T.ShapeGeometry(shape, segments), positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) positions.setZ(i, .3 * positions.getX(i) ** 2 + .12 * positions.getY(i))
  geometry.computeVertexNormals()
  return geometry
}

// 五瓣单朵樱花 + 花心
function createFlowerGeometry(detail: 'near' | 'far') {
  // Distant flowers keep a five-petal silhouette without each petal's curled edge.
  const parts: T.BufferGeometry[] = []
  if (detail === 'near') {
    const petal = createPetalGeometry(2)
    for (let i = 0; i < 5; i++) parts.push(petal.clone().scale(.52, .65, .6).translate(0, .32, 0).rotateZ(i * Math.PI * 2 / 5))
    petal.dispose()
  } else {
    const outline = Array.from({ length: 10 }, (_, i) => {
      const angle = i * Math.PI / 5, radius = i % 2 ? .28 : .61
      return new T.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius)
    })
    parts.push(new T.ShapeGeometry(new T.Shape(outline)))
  }
  const center = new T.CircleGeometry(.085, detail === 'near' ? 8 : 5); center.translate(0, 0, .04); parts.push(center)
  parts.forEach((part, i) => {
    const color = new T.Color(i === parts.length - 1 ? '#d59385' : '#ffffff'), colors: number[] = []
    for (let j = 0; j < part.getAttribute('position').count; j++) colors.push(color.r, color.g, color.b)
    part.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  })
  const geometry = mergeGeometries(parts)!
  parts.forEach(part => part.dispose())
  return geometry
}

const BLOSSOM_COLORS = ['#fff3ed', '#f4d1ce', '#eabebc', '#ffe8df', '#e6b6b9']
const LEAF_COLORS = ['#84946b', '#9f9f71', '#71835d']

function createLeafGeometry() {
  const shape = new T.Shape([
    new T.Vector2(0, -.5), new T.Vector2(-.23, -.08), new T.Vector2(-.17, .26),
    new T.Vector2(0, .5), new T.Vector2(.17, .26), new T.Vector2(.23, -.08),
  ])
  const geometry = new T.ShapeGeometry(shape)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.abs(positions.getX(i)) * -.22)
  geometry.computeVertexNormals()
  return geometry
}

// 在原点生成一棵完整樱花树（与古境 model.ts 的 tree() 同源）
function buildOneTree(seed: number, detail: 'near' | 'far') {
  const near = detail === 'near'
  const branches: T.BufferGeometry[] = []
  const flowers: Instance[] = []
  const petals: Instance[] = []
  const leaves: Instance[] = []
  const buds: Instance[] = []
  const dummy = new T.Object3D()
  const rnd = (n: number) => blossomRandom(seed * 101 + n)
  const height = 2.5 + rnd(1) * .65, rotation = rnd(2) * Math.PI * 2, spread = .88 + rnd(3) * .2
  const lean = new T.Vector3(Math.cos(rotation) * .32, 0, Math.sin(rotation) * .32)
  const v = (px: number, py: number, pz: number) => new T.Vector3(px, py, pz)

  // 渐缩弯曲的树干是轮廓主角；花永远不填满整个树冠
  const branch = (points: T.Vector3[], base: number, tip: number, segments: number, sides: number) => {
    const curve = new T.CatmullRomCurve3(points), geometry = new T.TubeGeometry(curve, segments, 1, sides, false)
    const positions = geometry.getAttribute('position'), colors: number[] = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, center = curve.getPointAt(t), radius = T.MathUtils.lerp(base, tip, t)
      for (let j = 0; j <= sides; j++) {
        const k = i * (sides + 1) + j, p = new T.Vector3().fromBufferAttribute(positions, k)
        const furrow = 1 + .065 * Math.sin(j / sides * Math.PI * 8 + seed) + .025 * Math.sin(t * 22 + seed)
        p.sub(center).multiplyScalar(radius * furrow).add(center); positions.setXYZ(k, p.x, p.y, p.z)
        const shade = .48 + Math.cos(j / sides * Math.PI * 2 + .8) * .19 + Math.sin(t * 25 + j / sides * Math.PI * 6 + seed) * .1
        const color = new T.Color('#382b28').lerp(new T.Color('#705044'), shade)
        colors.push(color.r, color.g, color.b)
      }
    }
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals(); branches.push(geometry)
    return curve
  }
  const flower = (point: T.Vector3, count: number, n: number) => {
    for (let i = 0; i < count; i++) {
      const k = n + i * 13, angle = rnd(k + 4) * Math.PI * 2, radius = .035 + rnd(k + 8) * .105
      dummy.position.copy(point).add(new T.Vector3(Math.cos(angle) * radius, (rnd(k + 9) - .4) * .16, Math.sin(angle) * radius))
      dummy.rotation.set(rnd(k + 14) * Math.PI * 2, rnd(k + 16) * Math.PI * 2, rnd(k + 18) * Math.PI * 2)
      dummy.scale.setScalar((.065 + rnd(k + 20) * .05) * (near ? 1 : 1.1)); dummy.updateMatrix()
      flowers.push({ matrix: dummy.matrix.clone(), color: new T.Color(BLOSSOM_COLORS[Math.floor(rnd(k + 22) * 5)]) })
    }
  }
  const fallenPetal = (x: number, z: number, petalSeed: number) => {
    const size = .025 + blossomRandom(petalSeed * 3) * .03
    dummy.position.set(x, .012, z); dummy.scale.setScalar(size)
    dummy.rotation.set(-Math.PI / 2, 0, blossomRandom(petalSeed * 11) * Math.PI * 2); dummy.updateMatrix()
    petals.push({ matrix: dummy.matrix.clone(), color: new T.Color(BLOSSOM_COLORS[Math.floor(blossomRandom(petalSeed * 7) * 5)]) })
  }
  const newGrowth = (point: T.Vector3, n: number, leaf: boolean) => {
    dummy.position.copy(point)
    dummy.rotation.set(rnd(n + 2) * .9, rnd(n + 4) * Math.PI * 2, (rnd(n + 6) - .5) * 1.7)
    dummy.scale.setScalar(leaf ? .07 + rnd(n + 8) * .035 : .025 + rnd(n + 8) * .012)
    if (!leaf) dummy.scale.y *= 1.5
    dummy.updateMatrix()
    const colors = leaf ? LEAF_COLORS : ['#d8a29a', '#e5b4a8', '#c98d89']
    ;(leaf ? leaves : buds).push({ matrix: dummy.matrix.clone(), color: new T.Color(colors[Math.floor(rnd(n + 10) * colors.length)]) })
  }

  for (let i = 0; i < (near ? 5 : 4); i++) {
    const a = rotation + i * 2.399, length = .35 + rnd(i + 700) * .25
    branch([v(0, .12, 0), v(Math.cos(a) * length * .5, .045, Math.sin(a) * length * .5), v(Math.cos(a) * length, .006, Math.sin(a) * length)], .09, .008, near ? 4 : 3, near ? 6 : 4)
  }
  const trunk = branch([v(0, 0, 0), v(-lean.x * .35, 1.4 - .66, -lean.z * .35), v(lean.x * .7, 2.1 - .66, lean.z * .7), v(lean.x, height - .66, lean.z)], .18, .072, near ? 10 : 7, near ? 10 : 7)
  const mainCount = near ? 6 : 5, secondaryCount = near ? 5 : 3, twigCount = near ? 4 : 2
  for (let i = 0; i < mainCount; i++) {
    const angle = rotation + i * 2.399 + (rnd(i + 30) - .5) * .35, length = (1.65 + rnd(i + 40) * .55) * spread
    const start = trunk.getPoint(.5 + i / (mainCount - 1) * .415), out = new T.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const lift = .65 + rnd(i + 50) * 1.1
    const main = branch([start, start.clone().addScaledVector(out, length * .25).add(new T.Vector3(0, .2, 0)), start.clone().addScaledVector(out, length * .7).add(new T.Vector3(0, lift * .72, 0)), start.clone().addScaledVector(out, length).add(new T.Vector3(0, lift, 0))], .09 - i * .005, .025, near ? 7 : 5, near ? 7 : 5)
    for (let j = 0; j < secondaryCount; j++) {
      const n = i * 900 + j * 120 + 60, origin = main.getPoint(.3 + j / (secondaryCount - 1) * .56), side = j % 2 ? 1 : -1
      const direction = angle + side * (.45 + rnd(n) * .65), reach = (.62 + rnd(n + 1) * .55) * spread
      const lateral = new T.Vector3(Math.cos(direction) * reach, .18 + rnd(n + 2) * .5, Math.sin(direction) * reach)
      const secondary = branch([origin, origin.clone().addScaledVector(lateral, .48).add(new T.Vector3(0, .08, 0)), origin.clone().add(lateral)], .029, .009, near ? 5 : 3, near ? 5 : 4)
      for (let k = 0; k < twigCount; k++) {
        const m = n + k * 29, at = secondary.getPoint(.2 + k / (twigCount - 1) * .66), a = direction + (k % 2 ? 1 : -1) * (.6 + rnd(m + 5) * .5)
        const extent = .37 + rnd(m + 6) * .4, dy = (k === 3 ? -.18 : .12) + rnd(m + 7) * .24
        const end = at.clone().add(new T.Vector3(Math.cos(a) * extent, dy, Math.sin(a) * extent))
        const twig = branch([at, at.clone().lerp(end, .5).add(new T.Vector3(0, .1, 0)), end], .011, .003, near ? 3 : 2, near ? 4 : 3)
        const clusterCount = near ? 4 : 3
        for (let b = 0; b < clusterCount; b++) flower(twig.getPoint(.2 + b / (clusterCount - 1) * .775), near ? 3 : 2, m * 31 + b * 8)
        if (k % 2 === 0) newGrowth(end, m * 59, false)
      }
      const secondaryClusters = near ? 4 : 3
      for (let b = 0; b < secondaryClusters; b++) flower(secondary.getPoint(.44 + b / (secondaryClusters - 1) * .51), near ? 3 : 2, n * 41 + b * 17)
      newGrowth(secondary.getPoint(.7), n * 47, true)
      if (near) newGrowth(secondary.getPoint(.92), n * 53, true)
    }
  }
  for (let i = 0; i < (near ? 42 : 24); i++) {
    const angle = rnd(i + 301) * Math.PI * 2, r = .4 + rnd(i + 400) * 1.5
    fallenPetal(Math.cos(angle) * r, Math.sin(angle) * r, seed * 71 + i)
  }
  const bark = mergeGeometries(branches)!
  branches.forEach(geometry => geometry.dispose())
  return { bark, flowers, petals, leaves, buds }
}

export interface SakuraTreeSpec { x: number; z: number; seed: number; scale?: number; detail?: 'near' | 'far' }

export function buildSakuraGrove(specs: SakuraTreeSpec[]) {
  const group = new T.Group()
  const allBranches: T.BufferGeometry[] = []
  const flowers: Record<'near' | 'far', Instance[]> = { near: [], far: [] }
  const allPetals: Instance[] = []
  const allLeaves: Instance[] = []
  const allBuds: Instance[] = []
  for (const spec of specs) {
    const detail = spec.detail ?? 'near'
    const tree = buildOneTree(spec.seed, detail)
    const place = new T.Matrix4().compose(
      new T.Vector3(spec.x, 0, spec.z), new T.Quaternion(), new T.Vector3(spec.scale ?? 1, spec.scale ?? 1, spec.scale ?? 1))
    tree.bark.applyMatrix4(place); allBranches.push(tree.bark)
    tree.flowers.forEach(i => flowers[detail].push({ matrix: place.clone().multiply(i.matrix), color: i.color }))
    tree.leaves.forEach(i => allLeaves.push({ matrix: place.clone().multiply(i.matrix), color: i.color }))
    tree.buds.forEach(i => allBuds.push({ matrix: place.clone().multiply(i.matrix), color: i.color }))
    tree.petals.forEach(i => {
      const matrix = place.clone().multiply(i.matrix)
      // Keep the central plinth clear and petals just above the garden surface.
      if (Math.hypot(matrix.elements[12], matrix.elements[14]) < 2.4) return
      matrix.elements[13] = .012
      allPetals.push({ matrix, color: i.color })
    })
  }

  const branchMat = new T.MeshStandardMaterial({ roughness: 1, vertexColors: true })
  const flowerMat = new T.MeshStandardMaterial({ roughness: .95, side: T.DoubleSide, vertexColors: true, emissive: '#c99085', emissiveIntensity: .015 })
  const petalMat = new T.MeshStandardMaterial({ roughness: 1, side: T.DoubleSide })
  const leafMat = new T.MeshStandardMaterial({ roughness: .95, side: T.DoubleSide })
  const budMat = new T.MeshStandardMaterial({ roughness: .9 })
  const nearFlowerGeo = createFlowerGeometry('near')
  const farFlowerGeo = createFlowerGeometry('far')
  const petalGeo = createPetalGeometry()
  const leafGeo = createLeafGeometry()
  const budGeo = new T.IcosahedronGeometry(.5, 0)
  const instance = (name: string, geometry: T.BufferGeometry, material: T.Material, values: Instance[]) => {
    const mesh = new T.InstancedMesh(geometry, material, values.length)
    mesh.name = name
    values.forEach((value, i) => { mesh.setMatrixAt(i, value.matrix); mesh.setColorAt(i, value.color) })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    if (values.length) group.add(mesh)
    return mesh
  }
  const nearFlowers = instance('Sakura blossoms near', nearFlowerGeo, flowerMat, flowers.near)
  const farFlowers = instance('Sakura blossoms far', farFlowerGeo, flowerMat, flowers.far)
  const petalMesh = instance('Sakura fallen petals', petalGeo, petalMat, allPetals)
  const leafMesh = instance('Sakura young leaves', leafGeo, leafMat, allLeaves)
  const budMesh = instance('Sakura buds', budGeo, budMat, allBuds)
  petalMesh.receiveShadow = true

  const bark = new T.Mesh(allBranches.length ? mergeGeometries(allBranches)! : new T.BufferGeometry(), branchMat)
  allBranches.forEach(geometry => geometry.dispose())
  allBranches.length = 0
  bark.name = 'Sakura bark and roots'
  bark.castShadow = true; bark.receiveShadow = true
  group.add(bark)

  let disposed = false
  return {
    group,
    dispose() {
      if (disposed) return
      disposed = true
      nearFlowerGeo.dispose(); farFlowerGeo.dispose(); petalGeo.dispose(); leafGeo.dispose(); budGeo.dispose()
      branchMat.dispose(); flowerMat.dispose(); petalMat.dispose(); leafMat.dispose(); budMat.dispose()
      nearFlowers.dispose(); farFlowers.dispose(); petalMesh.dispose(); leafMesh.dispose(); budMesh.dispose(); bark.geometry.dispose()
    },
  }
}
