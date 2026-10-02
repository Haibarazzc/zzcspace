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
function createFlowerGeometry() {
  const petal = createPetalGeometry(2), parts: T.BufferGeometry[] = []
  for (let i = 0; i < 5; i++) parts.push(petal.clone().scale(.52, .65, .6).translate(0, .32, 0).rotateZ(i * Math.PI * 2 / 5))
  const center = new T.CircleGeometry(.085, 8); center.translate(0, 0, .04); parts.push(center)
  parts.forEach((part, i) => {
    const color = new T.Color(i === 5 ? '#b95c84' : '#ffffff'), colors: number[] = []
    for (let j = 0; j < part.getAttribute('position').count; j++) colors.push(color.r, color.g, color.b)
    part.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  })
  const geometry = mergeGeometries(parts)!
  petal.dispose(); parts.forEach(part => part.dispose())
  return geometry
}

const BLOSSOM_COLORS = ['#fff1f1', '#f3cdda', '#edb8cc', '#ffe9ed', '#e2b0c4']

// 在原点生成一棵完整樱花树（与古境 model.ts 的 tree() 同源）
function buildOneTree(seed: number) {
  const branches: T.BufferGeometry[] = []
  const flowers: Instance[] = []
  const petals: Instance[] = []
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
        const color = new T.Color(j % 3 === 0 ? '#554449' : j % 3 === 1 ? '#372d32' : '#45383b')
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
      dummy.scale.setScalar(.07 + rnd(k + 20) * .055); dummy.updateMatrix()
      flowers.push({ matrix: dummy.matrix.clone(), color: new T.Color(BLOSSOM_COLORS[Math.floor(rnd(k + 22) * 5)]) })
    }
  }
  const fallenPetal = (x: number, z: number, s: number) => {
    dummy.position.set(x, .075, z); dummy.scale.setScalar(s)
    dummy.rotation.set(-Math.PI / 2, 0, s * 91); dummy.updateMatrix()
    petals.push({ matrix: dummy.matrix.clone(), color: new T.Color(BLOSSOM_COLORS[Math.floor(blossomRandom(s * 7) * 5)]) })
  }

  const trunk = branch([v(0, 0, 0), v(-lean.x * .35, 1.4 - .66, -lean.z * .35), v(lean.x * .7, 2.1 - .66, lean.z * .7), v(lean.x, height - .66, lean.z)], .18, .072, 10, 10)
  for (let i = 0; i < 6; i++) {
    const angle = rotation + i * 2.399 + (rnd(i + 30) - .5) * .35, length = (1.65 + rnd(i + 40) * .55) * spread
    const start = trunk.getPoint(.5 + i * .083), out = new T.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const lift = .65 + rnd(i + 50) * 1.1
    const main = branch([start, start.clone().addScaledVector(out, length * .25).add(new T.Vector3(0, .2, 0)), start.clone().addScaledVector(out, length * .7).add(new T.Vector3(0, lift * .72, 0)), start.clone().addScaledVector(out, length).add(new T.Vector3(0, lift, 0))], .09 - i * .005, .025, 7, 7)
    for (let j = 0; j < 5; j++) {
      const n = i * 900 + j * 120 + 60, origin = main.getPoint(.3 + j * .14), side = j % 2 ? 1 : -1
      const direction = angle + side * (.45 + rnd(n) * .65), reach = (.62 + rnd(n + 1) * .55) * spread
      const lateral = new T.Vector3(Math.cos(direction) * reach, .18 + rnd(n + 2) * .5, Math.sin(direction) * reach)
      const secondary = branch([origin, origin.clone().addScaledVector(lateral, .48).add(new T.Vector3(0, .08, 0)), origin.clone().add(lateral)], .029, .009, 5, 5)
      for (let k = 0; k < 4; k++) {
        const m = n + k * 29, at = secondary.getPoint(.2 + k * .22), a = direction + (k % 2 ? 1 : -1) * (.6 + rnd(m + 5) * .5)
        const extent = .37 + rnd(m + 6) * .4, dy = (k === 3 ? -.18 : .12) + rnd(m + 7) * .24
        const end = at.clone().add(new T.Vector3(Math.cos(a) * extent, dy, Math.sin(a) * extent))
        const twig = branch([at, at.clone().lerp(end, .5).add(new T.Vector3(0, .1, 0)), end], .011, .003, 3, 4)
        for (let b = 0; b < 6; b++) flower(twig.getPoint(.2 + b * .155), 3, m * 31 + b * 8)
      }
      for (let b = 0; b < 4; b++) flower(secondary.getPoint(.44 + b * .17), 3, n * 41 + b * 17)
    }
  }
  for (let i = 0; i < 42; i++) {
    const angle = rnd(i + 301) * Math.PI * 2, r = .4 + rnd(i + 400) * 1.9
    fallenPetal(Math.cos(angle) * r, Math.sin(angle) * r, seed * 71 + i)
  }
  return { branches, flowers, petals }
}

export interface SakuraTreeSpec { x: number; z: number; seed: number; scale?: number }

export function buildSakuraGrove(specs: SakuraTreeSpec[]) {
  const group = new T.Group()
  const allBranches: T.BufferGeometry[] = []
  const allFlowers: Instance[] = []
  const allPetals: Instance[] = []
  for (const spec of specs) {
    const tree = buildOneTree(spec.seed)
    const place = new T.Matrix4().compose(
      new T.Vector3(spec.x, 0, spec.z), new T.Quaternion(), new T.Vector3(spec.scale ?? 1, spec.scale ?? 1, spec.scale ?? 1))
    tree.branches.forEach(g => { g.applyMatrix4(place); allBranches.push(g) })
    tree.flowers.forEach(i => allFlowers.push({ matrix: place.clone().multiply(i.matrix), color: i.color }))
    tree.petals.forEach(i => allPetals.push({ matrix: place.clone().multiply(i.matrix), color: i.color }))
  }

  const branchMat = new T.MeshStandardMaterial({ roughness: 1, vertexColors: true })
  const flowerMat = new T.MeshStandardMaterial({ roughness: .95, side: T.DoubleSide, vertexColors: true, emissive: '#c1789c', emissiveIntensity: .025 })
  const petalMat = new T.MeshStandardMaterial({ roughness: .9, side: T.DoubleSide, emissive: '#b86588', emissiveIntensity: .16 })

  const flowerGeo = createFlowerGeometry()
  const petalGeo = createPetalGeometry()
  const flowerMesh = new T.InstancedMesh(flowerGeo, flowerMat, allFlowers.length)
  const petalMesh = new T.InstancedMesh(petalGeo, petalMat, allPetals.length)
  allFlowers.forEach((v, i) => { flowerMesh.setMatrixAt(i, v.matrix); flowerMesh.setColorAt(i, v.color) })
  allPetals.forEach((v, i) => { petalMesh.setMatrixAt(i, v.matrix); petalMesh.setColorAt(i, v.color) })
  petalMesh.receiveShadow = true

  const bark = new T.Mesh(mergeGeometries(allBranches)!, branchMat)
  bark.castShadow = true; bark.receiveShadow = true
  group.add(bark, flowerMesh, petalMesh)

  return {
    group,
    dispose() {
      flowerGeo.dispose(); petalGeo.dispose()
      branchMat.dispose(); flowerMat.dispose(); petalMat.dispose()
      allBranches.forEach(g => g.dispose())
      flowerMesh.dispose(); petalMesh.dispose(); bark.geometry.dispose()
    },
  }
}
