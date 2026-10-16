import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { poses, type PoseId } from './data'

type Vec3 = [number, number, number]
type Bucket = 'wood' | 'stone' | 'roof' | 'plant' | 'leaf' | 'flower' | 'glass'

const noRaycast = () => {}
const rnd = (seed: number) => T.MathUtils.euclideanModulo(Math.sin(seed * 127.1 + 311.7) * 43758.5453, 1)

// Small architectural parts are baked by surface type, rather than creating a
// React mesh (and a draw call) for every tile, slat, stone or blade of grass.
function buildDetails() {
  const group = new T.Group()
  const floating = new T.Group()
  const parts: Record<Bucket, T.BufferGeometry[]> = {
    wood: [], stone: [], roof: [], plant: [], leaf: [], flower: [], glass: [],
  }
  const floatParts: Record<'leaf' | 'flower', T.BufferGeometry[]> = { leaf: [], flower: [] }
  const transform = new T.Object3D()
  const materials = {
    wood: new T.MeshStandardMaterial({ vertexColors: true, roughness: .87 }),
    stone: new T.MeshStandardMaterial({ vertexColors: true, roughness: .96, flatShading: true }),
    roof: new T.MeshStandardMaterial({ vertexColors: true, roughness: .84, side: T.DoubleSide }),
    plant: new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    leaf: new T.MeshStandardMaterial({ vertexColors: true, roughness: .88, side: T.DoubleSide }),
    flower: new T.MeshStandardMaterial({ vertexColors: true, roughness: .86, side: T.DoubleSide }),
    glass: new T.MeshStandardMaterial({ vertexColors: true, roughness: .65, emissive: '#f7b965', emissiveIntensity: .4 }),
  }
  const bake = (geometry: T.BufferGeometry, bucket: Bucket, color: string, position: Vec3, rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1], floats = false) => {
    // A consistent non-indexed layout allows cylinders, custom leaves and
    // beveled-looking rocks to share the same merged geometry.
    const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    geometry.dispose()
    baked.deleteAttribute('uv')
    transform.position.set(...position); transform.rotation.set(...rotation); transform.scale.set(...scale); transform.updateMatrix()
    baked.applyMatrix4(transform.matrix)
    const rgb = new T.Color(color), colors = new Float32Array(baked.getAttribute('position').count * 3)
    for (let i = 0; i < colors.length; i += 3) { colors[i] = rgb.r; colors[i + 1] = rgb.g; colors[i + 2] = rgb.b }
    baked.setAttribute('color', new T.BufferAttribute(colors, 3))
    if (floats && (bucket === 'leaf' || bucket === 'flower')) floatParts[bucket].push(baked)
    else parts[bucket].push(baked)
  }
  const box = (bucket: Bucket, color: string, at: Vec3, size: Vec3, rotation: Vec3 = [0, 0, 0]) =>
    bake(new T.BoxGeometry(1, 1, 1), bucket, color, at, rotation, size)
  const beam = (a: Vec3, b: Vec3, width: number, depth: number, color = '#604635') => {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), length = start.distanceTo(end)
    const geometry = new T.BoxGeometry(width, length, depth)
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), end.clone().sub(start).normalize()))
    bake(geometry, 'wood', color, start.add(end).multiplyScalar(.5).toArray() as Vec3)
  }
  const stone = (at: Vec3, size: Vec3, seed: number, color = '#77776a') => {
    const geometry = new T.IcosahedronGeometry(1, 0), p = geometry.getAttribute('position')
    // Position-driven variation keeps duplicated face corners together.
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      const uneven = 1 + .12 * Math.sin(x * 7 + y * 3 + z * 5 + seed)
      p.setXYZ(i, x * uneven, y * uneven, z * uneven)
    }
    geometry.computeVertexNormals()
    bake(geometry, 'stone', color, at, [seed * .12, seed * .61, seed * .03], size)
  }
  const leafGeometry = () => {
    const shape = new T.Shape()
    shape.moveTo(0, 0); shape.bezierCurveTo(-.5, .24, -.37, .75, 0, 1); shape.bezierCurveTo(.37, .75, .5, .24, 0, 0)
    const geometry = new T.ShapeGeometry(shape, 3), p = geometry.getAttribute('position')
    for (let i = 0; i < p.count; i++) p.setZ(i, .12 * Math.sin(p.getY(i) * Math.PI) - .12 * Math.abs(p.getX(i)))
    geometry.computeVertexNormals()
    return geometry
  }

  // A quiet timber garden entrance, with stone shoes, bracketed beams and a
  // tiled roof whose edges lift gently instead of ending in one square block.
  const gate = (x: number, y: number, z: number): Vec3 => [x + 1.3, y, z - 4.6]
  for (const side of [-1, 1]) {
    box('stone', '#8b877b', gate(side * 1.02, .09, 0), [.29, .18, .32])
    box('stone', '#77756b', gate(side * 1.02, .2, 0), [.22, .09, .25])
    box('wood', '#584031', gate(side * 1.02, 1.21, 0), [.16, 1.96, .18])
    box('wood', '#77543b', gate(side * 1.02, .3, 0), [.19, .09, .21])
    box('wood', '#76533b', gate(side * 1.02, 2.02, 0), [.24, .1, .24])
    box('wood', '#4e392d', gate(side * 1.02, 2.15, 0), [.36, .14, .3])
    beam(gate(side * 1.02, 1.69, 0), gate(side * .72, 2.06, 0), .07, .11)
    // Subtle raised strips catch light along the post edges.
    box('wood', '#6a4a34', gate(side * 1.02 - .047, 1.22, .094), [.018, 1.66, .008])
  }
  box('wood', '#6d4c35', gate(0, 2.14, 0), [2.6, .18, .23])
  box('wood', '#89613f', gate(0, 2.23, .015), [2.77, .055, .31])
  box('wood', '#5b4131', gate(0, 1.85, 0), [2.18, .1, .14])
  for (const x of [-.7, -.35, 0, .35, .7]) box('wood', '#80593a', gate(x, 1.99, 0), [.045, .19, .12])
  const roofHeight = (x: number, z: number) => 2.36 + .17 * (1 - Math.abs(x / 1.43) ** 1.4) + .065 * Math.abs(x / 1.43) ** 7 - .17 * Math.abs(z / .43) ** 1.25
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 18; col++) {
      const x0 = -1.43 + col * 2.86 / 18, x1 = x0 + 2.86 / 18 - .008
      const z0 = -.43 + row * .86 / 4, z1 = z0 + .86 / 4 - .008
      const vertices = [x0, roofHeight(x0, z0), z0, x1, roofHeight(x1, z0), z0, x1, roofHeight(x1, z1), z1,
        x0, roofHeight(x0, z0), z0, x1, roofHeight(x1, z1), z1, x0, roofHeight(x0, z1), z1]
      const tile = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); tile.computeVertexNormals()
      bake(tile, 'roof', col % 4 === 0 ? '#5f625a' : row % 2 ? '#53584f' : '#62665b', gate(0, 0, 0))
    }
  }
  bake(new T.CylinderGeometry(.041, .041, 2.93, 8), 'roof', '#747367', gate(0, 2.545, 0), [0, 0, Math.PI / 2])
  for (const side of [-1, 1]) {
    box('wood', '#44392e', gate(0, 2.22, side * .4), [2.89, .045, .055])
    for (let i = 0; i < 19; i++) box('roof', '#6a6d60', gate(-1.4 + i * 2.8 / 18, 2.235 + .055 * Math.abs((-1.4 + i * 2.8 / 18) / 1.4) ** 7, side * .43), [.115, .055, .055])
  }

  // A low rail and slatted bench remain behind the main stage, giving the
  // garden a human scale without filling the mascot's silhouette.
  for (const x of [-4.15, -3.05, -1.95]) {
    box('stone', '#858174', [x, .045, -3.65], [.2, .09, .2])
    box('wood', '#654d38', [x, .36, -3.65], [.09, .64, .09])
    box('wood', '#896548', [x, .7, -3.65], [.14, .055, .14])
  }
  for (const y of [.29, .54]) box('wood', '#7a5b40', [-3.05, y, -3.65], [2.35, .065, .075])
  for (let i = 0; i < 10; i++) {
    const x = -4.02 + i * .217
    box('wood', i % 2 ? '#6b5039' : '#7a5a40', [x, .41, -3.65], [.025, .28, .035])
  }
  const bench = (x: number, y: number, z: number): Vec3 => [x - 3, y, z - 2.9]
  for (const x of [-.66, .66]) {
    for (const z of [-.19, .19]) {
      box('stone', '#77766a', bench(x, .035, z), [.16, .07, .16])
      box('wood', '#584331', bench(x, .24, z), [.075, .4, .075])
    }
    box('wood', '#6e5038', bench(x, .39, 0), [.09, .08, .56])
    box('wood', '#604733', bench(x, .65, -.2), [.065, .48, .065])
  }
  for (let i = 0; i < 4; i++) box('wood', i % 2 ? '#94704b' : '#896444', bench(0, .455, -.19 + i * .13), [1.66, .065, .11])
  for (const y of [.69, .84]) box('wood', '#896444', bench(0, y, -.225), [1.66, .09, .06])

  // Two timber lamps and one stone lantern. Their panes share a single warm
  // material; their three inexpensive point lights are created by React.
  for (const [x, z] of [[-2.6, -1.6], [2.6, -1.6], [-3.6, 2.9]]) {
    const stoneLantern = x === -3.6
    box('stone', '#898476', [x, .06, z], [.37, .12, .37])
    box('stone', '#746e62', [x, .15, z], [.27, .07, .27])
    bake(new T.CylinderGeometry(stoneLantern ? .085 : .055, stoneLantern ? .11 : .072, .38, 8), stoneLantern ? 'stone' : 'wood', stoneLantern ? '#898376' : '#5a4431', [x, .36, z])
    box(stoneLantern ? 'stone' : 'wood', stoneLantern ? '#918a7b' : '#795638', [x, .57, z], [.35, .08, .35])
    box('glass', '#ead09a', [x, .76, z], [.235, .29, .235])
    for (const dx of [-.142, .142]) for (const dz of [-.142, .142]) box(stoneLantern ? 'stone' : 'wood', stoneLantern ? '#817c6d' : '#5c4431', [x + dx, .76, z + dz], [.035, .32, .035])
    for (const dy of [.66, .85]) {
      box('wood', '#75583d', [x, dy, z + .13], [.29, .018, .02])
      box('wood', '#75583d', [x, dy, z - .13], [.29, .018, .02])
      box('wood', '#75583d', [x + .13, dy, z], [.02, .018, .29])
      box('wood', '#75583d', [x - .13, dy, z], [.02, .018, .29])
    }
    box(stoneLantern ? 'stone' : 'wood', '#6c6657', [x, .925, z], [.37, .055, .37])
    bake(new T.ConeGeometry(.31, .15, 4), 'roof', stoneLantern ? '#7b7b6c' : '#606254', [x, 1.025, z], [0, Math.PI / 4, 0])
    bake(new T.SphereGeometry(.034, 8, 5), 'roof', '#8c826b', [x, 1.12, z])
  }

  // Irregular shallow pond. Its low stones are clustered, rather than a
  // necklace of identical spheres; all remain outside the central walkway.
  const pondPoint = (angle: number, radius = 1): Vec3 => {
    const r = 1 + .08 * Math.sin(angle * 3 + .4) + .045 * Math.cos(angle * 5)
    return [3.6 + Math.cos(angle) * r * radius * 1.1, .024, 2.6 + Math.sin(angle) * r * radius * .79]
  }
  const outline = new T.Shape()
  for (let i = 0; i < 64; i++) {
    const point = pondPoint(i / 64 * Math.PI * 2)
    if (i === 0) outline.moveTo(point[0], -point[2]); else outline.lineTo(point[0], -point[2])
  }
  outline.closePath()
  const waterGeometry = new T.ShapeGeometry(outline, 2).rotateX(-Math.PI / 2)
  waterGeometry.translate(0, .025, 0)
  const waterMaterial = new T.MeshStandardMaterial({ color: '#486e69', roughness: .2, metalness: .23 })
  const water = new T.Mesh(waterGeometry, waterMaterial); water.raycast = noRaycast; water.receiveShadow = true; group.add(water)
  for (let i = 0; i < 29; i++) {
    const angle = i / 29 * Math.PI * 2, at = pondPoint(angle, 1.035), seed = i + 101
    at[1] = .064 + rnd(seed) * .026
    stone(at, [.16 + rnd(seed + 1) * .095, .075 + rnd(seed + 2) * .055, .15 + rnd(seed + 3) * .07], seed, ['#777a6c', '#8c8b79', '#626e62'][i % 3])
  }
  for (let i = 0; i < 8; i++) {
    const angle = i * .78 + .2, at = pondPoint(angle, 1.13)
    at[1] = .019
    stone(at, [.045 + rnd(i + 41) * .035, .028, .04], i + 73, '#9c9a85')
  }
  const pads = [[3.1, 2.61, .15], [3.24, 2.81, .13], [3.88, 2.22, .17], [4.02, 2.43, .12]]
  for (let i = 0; i < pads.length; i++) {
    const [x, z, radius] = pads[i], padShape = new T.Shape()
    padShape.moveTo(0, 0)
    for (let k = 0; k <= 26; k++) {
      const a = .22 + k / 26 * (Math.PI * 2 - .44)
      padShape.lineTo(Math.cos(a) * radius, Math.sin(a) * radius * .8)
    }
    padShape.lineTo(0, 0)
    bake(new T.ShapeGeometry(padShape, 2), 'leaf', i % 2 ? '#677b4c' : '#58714d', [x, .034, z], [-Math.PI / 2, 0, i * .7], [1, 1, 1], true)
    for (let k = 0; k < 5; k++) {
      const angle = .4 + k * 1.15 + i * .7
      const vein = new T.BoxGeometry(radius * .65, .001, .003)
      bake(vein, 'leaf', '#829061', [x + Math.cos(angle) * radius * .37, .035, z + Math.sin(angle) * radius * .37], [0, -angle, 0], [1, 1, 1], true)
    }
  }
  for (const [x, z] of [[3.15, 2.75], [3.87, 2.27]]) {
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2
      bake(leafGeometry(), 'flower', i % 2 ? '#ead0bd' : '#f0dfcd', [x + Math.cos(a) * .018, .054, z + Math.sin(a) * .018], [Math.sin(a) * .96, -a, Math.cos(a) * .96], [.053, .091, .053], true)
    }
    bake(new T.SphereGeometry(.023, 7, 4), 'flower', '#d4aa61', [x, .079, z], [0, 0, 0], [1, .6, 1], true)
  }

  // A few composed planting pockets, with rounded clumps, distinct leaves,
  // ferns and fine grass mixed at several scales. The front path stays open.
  const beds = [
    [-2.55, 1.8, .39], [2.65, .95, .33], [-2.9, -.55, .32], [3.0, -.7, .41],
    [-1.75, 3.25, .28], [4.7, 2.2, .24], [-4.15, -4.4, .3],
  ]
  for (let i = 0; i < beds.length; i++) {
    const [x, z, size] = beds[i]
    for (let j = 0; j < 5; j++) {
      const a = j * 2.399 + i, r = j === 0 ? 0 : size * .54
      bake(new T.IcosahedronGeometry(1, 1), 'plant', ['#526446', '#64744f', '#465c41'][j % 3], [x + Math.cos(a) * r, size * (.42 + rnd(i + j * 9) * .14), z + Math.sin(a) * r], [0, a, 0], [size * .69, size * .45, size * .65])
    }
    stone([x + size * .8, .075, z + size * .25], [size * .45, .13, size * .35], i + 83, '#777c68')
    stone([x + size * .65, .035, z + size * .68], [size * .25, .06, size * .21], i + 72, '#8b8c77')
    // Three arching fern fronds, each made from paired small leaflets.
    for (let frond = 0; frond < 3; frond++) {
      const angle = i * 2.3 + frond * .8, fx = x - size * .7, fz = z + size * .48
      for (let leaflet = 0; leaflet < 6; leaflet++) {
        const t = (leaflet + 1) / 7, reach = t * .32
        const y = .045 + Math.sin(t * Math.PI * .75) * .25
        for (const side of [-1, 1]) {
          bake(leafGeometry(), 'leaf', leaflet % 2 ? '#6b7f54' : '#57704b', [fx + Math.cos(angle) * reach, y, fz + Math.sin(angle) * reach], [side * .6, -angle + side * .8, -Math.PI / 2], [.037 * (1 - t * .45), .095 * (1 - t * .45), .06])
        }
      }
    }
    // Thin tapered blades are geometry, not transparent billboard cards.
    for (let blade = 0; blade < 11; blade++) {
      const a = rnd(i * 29 + blade + 50) * Math.PI * 2, height = .11 + rnd(blade * 13 + i) * .16
      const gx = x + Math.cos(a) * size * 1.1, gz = z + Math.sin(a) * size * 1.1
      const bladeGeometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([-.009, 0, 0, .009, 0, 0, .025, height, .014], 3))
      bladeGeometry.computeVertexNormals()
      bake(bladeGeometry, 'leaf', blade % 3 ? '#78805a' : '#8b8a62', [gx, .015, gz], [0, a, 0])
    }
  }

  for (const bucket of Object.keys(parts) as Bucket[]) {
    if (parts[bucket].length) {
      const geometry = mergeGeometries(parts[bucket])!
      const mesh = new T.Mesh(geometry, materials[bucket])
      mesh.castShadow = bucket !== 'glass' && bucket !== 'leaf'
      mesh.receiveShadow = bucket !== 'glass'
      mesh.raycast = noRaycast
      group.add(mesh)
    }
    parts[bucket].forEach(g => g.dispose())
  }
  for (const bucket of ['leaf', 'flower'] as const) {
    const geometry = mergeGeometries(floatParts[bucket])!
    const mesh = new T.Mesh(geometry, materials[bucket])
    mesh.receiveShadow = true; mesh.raycast = noRaycast; floating.add(mesh)
    floatParts[bucket].forEach(g => g.dispose())
  }
  group.add(floating)
  return {
    group, floating, glass: materials.glass,
    dispose() {
      group.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose() })
      Object.values(materials).forEach(material => material.dispose())
      waterMaterial.dispose()
    },
  }
}

export default function CourtyardDetails({ pose, reduced, animated }: { pose: PoseId; reduced: boolean; animated: boolean }) {
  const details = useMemo(buildDetails, [])
  const rippleGeometry = useMemo(() => new T.RingGeometry(.97, 1, 56).rotateX(-Math.PI / 2), [])
  const rippleMaterials = useMemo(() => [0, 1, 2].map(() => new T.MeshBasicMaterial({ color: '#a7b9a3', transparent: true, opacity: .1, depthWrite: false, side: T.DoubleSide })), [])
  const ripples = useRef<(T.Mesh | null)[]>([])
  const lamps = useRef<(T.PointLight | null)[]>([])
  const elapsed = useRef(0)
  useEffect(() => () => { details.dispose(); rippleGeometry.dispose(); rippleMaterials.forEach(material => material.dispose()) }, [details, rippleGeometry, rippleMaterials])
  useFrame((_, dt) => {
    const active = animated && !reduced
    if (active) elapsed.current += Math.min(dt, .05)
    const time = elapsed.current
    details.floating.position.y = Math.sin(time * .75) * .0015
    for (let i = 0; i < 3; i++) {
      const phase = (time * .095 + i / 3) % 1
      const radius = .08 + phase * .55
      ripples.current[i]?.scale.set(radius, 1, radius * .66)
      rippleMaterials[i].opacity = Math.sin(phase * Math.PI) * .14
    }
    details.glass.emissiveIntensity = T.MathUtils.damp(details.glass.emissiveIntensity, poses[pose].lamp, 2.5, dt)
    lamps.current.forEach((lamp, i) => {
      if (lamp) lamp.intensity = T.MathUtils.damp(lamp.intensity, (pose === 'glance' ? 2.3 : pose === 'cheer' ? 1.45 : .85) * (i === 2 ? .8 : 1), 2.5, dt)
    })
  })
  return (
    <group dispose={null}>
      <primitive object={details.group} />
      {[0, 1, 2].map(i => (
        <mesh key={i} ref={mesh => { ripples.current[i] = mesh }} geometry={rippleGeometry} material={rippleMaterials[i]} position={[3.6, .029 + i * .0003, 2.6]} raycast={noRaycast} />
      ))}
      {([[-2.6, .76, -1.6], [2.6, .76, -1.6], [-3.6, .76, 2.9]] as Vec3[]).map((position, i) => (
        <pointLight key={i} ref={light => { lamps.current[i] = light }} position={position} color="#ffcf93" intensity={.85} distance={3.4} decay={2} />
      ))}
    </group>
  )
}
