/** Street furniture around the shop: vending machines, bicycles, umbrellas,
 *  bins, utility pole with wires and signals, guardrail, signs, the neighbour
 *  house and the little neon bar down the alley. */
import {
  AdditiveBlending,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  TorusGeometry,
  Vector3,
  type Material,
  type Texture,
} from 'three'
import {
  bannerTexture,
  binTexture,
  boardTexture,
  box,
  cylinder,
  glowTexture,
  makeTexture,
  neonTexture,
  parkingSignTexture,
  plane,
  posterTexture,
  roofTileTexture,
  sphere,
  stopSignTexture,
  streetPlateTexture,
  toonMaterial,
  vendingTexture,
  wetMaterial,
} from './toon'

export interface PropsParts {
  group: Group
  vehicleLamp: MeshBasicMaterial[]
  pedRed: MeshBasicMaterial
  pedGreen: MeshBasicMaterial
  farVehicle: MeshBasicMaterial[]
  neon: MeshBasicMaterial
  barLight: PointLight
}

const metal = wetMaterial(0x8a919e, 0.35, 0.72)
const poleMat = toonMaterial(0x9aa0aa, { tint: 'neutral' })
const whitePaint = wetMaterial(0xd6dbe2, 0.4, 0.18)
const pipeDark = wetMaterial(0x40454f, 0.45, 0.4)

function tube(a: Vector3, b: Vector3, r: number, mat: Material, seg = 8): Mesh {
  const len = a.distanceTo(b)
  const m = new Mesh(new CylinderGeometry(r, r, len, seg), mat)
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize())
  return m
}

function vending(x: number, z: number, kind: 0 | 1): Group {
  const g = new Group()
  g.position.set(x, 0, z)
  const body = box(0.72, 1.78, 0.62, toonMaterial(0xdfe3e6, { tint: 'neutral' }), 0, 0.89, 0)
  g.add(body)
  const front = plane(0.66, 1.62, new MeshBasicMaterial({ map: vendingTexture(kind), toneMapped: false }), 0, 0.94, 0.315)
  g.add(front)
  // side panels
  g.add(box(0.024, 1.7, 0.6, wetMaterial(kind ? 0x8a2a24 : 0x1d5c85, 0.35, 0.4), -0.372, 0.9, 0))
  g.add(box(0.024, 1.7, 0.6, wetMaterial(kind ? 0x8a2a24 : 0x1d5c85, 0.35, 0.4), 0.372, 0.9, 0))
  // top light strip
  g.add(box(0.66, 0.04, 0.05, new MeshBasicMaterial({ color: kind ? 0xffb1a0 : 0xa8e4ff, toneMapped: false }), 0, 1.8, 0.3))
  // glow card (bloom pickup)
  const card = plane(0.7, 0.9, new MeshBasicMaterial({ map: glowTexture(), color: kind ? 0xff9c86 : 0x9fdcff, transparent: true, opacity: 0.14, blending: AdditiveBlending, depthWrite: false, toneMapped: false }), 0, 0.95, 0.42)
  g.add(card)
  return g
}

function bicycle(): Group {
  const g = new Group()
  const frameMat = wetMaterial(0x2f6f8f, 0.3, 0.55)
  const tireMat = wetMaterial(0x1b1f27, 0.55, 0.2)
  const wheel = (x: number) => {
    const w = new Group()
    const tire = new Mesh(new TorusGeometry(0.3, 0.022, 8, 24), tireMat)
    w.add(tire)
    const rim = new Mesh(new TorusGeometry(0.27, 0.008, 6, 24), metal)
    w.add(rim)
    for (let i = 0; i < 6; i++) {
      const spoke = box(0.006, 0.52, 0.006, metal, 0, 0, 0)
      spoke.rotation.z = (i / 6) * Math.PI
      w.add(spoke)
    }
    w.position.set(x, 0.3, 0)
    return w
  }
  g.add(wheel(-0.55), wheel(0.55))
  const rear = new Vector3(-0.55, 0.3, 0)
  const crank = new Vector3(-0.02, 0.28, 0)
  const seat = new Vector3(-0.18, 0.82, 0)
  const head = new Vector3(0.42, 0.86, 0)
  const front = new Vector3(0.55, 0.3, 0)
  g.add(tube(rear, crank, 0.014, frameMat))
  g.add(tube(crank, seat, 0.014, frameMat))
  g.add(tube(seat, rear, 0.012, frameMat))
  g.add(tube(seat, head, 0.016, frameMat))
  g.add(tube(head, crank, 0.014, frameMat))
  g.add(tube(head, front, 0.012, metal))
  g.add(tube(seat, new Vector3(-0.12, 0.62, 0), 0.012, metal))
  // saddle + handlebar
  g.add(box(0.2, 0.05, 0.1, wetMaterial(0x2a2420, 0.5, 0.2), -0.2, 0.86, 0))
  g.add(box(0.04, 0.04, 0.4, metal, 0.44, 0.95, 0))
  g.add(box(0.04, 0.12, 0.04, metal, 0.44, 0.9, 0))
  // front basket
  g.add(box(0.34, 0.22, 0.26, new MeshStandardMaterial({ color: 0xb9c1c9, roughness: 0.5, metalness: 0.6, wireframe: true }), 0.48, 0.66, 0))
  // pedals + chain guard + kickstand
  g.add(box(0.16, 0.02, 0.02, metal, -0.02, 0.16, 0.06))
  g.add(box(0.2, 0.2, 0.01, wetMaterial(0x22262e, 0.5, 0.3), -0.1, 0.4, 0.03))
  g.add(tube(new Vector3(0, 0.3, 0), new Vector3(0.08, 0.02, 0.16), 0.012, pipeDark))
  return g
}

function utilityPole(x: number, z: number, h: number, big: boolean): Group {
  const g = new Group()
  g.position.set(x, 0, z)
  const radius = big ? 0.1 : 0.085
  g.add(cylinder(radius * 0.82, radius, h, 10, toonMaterial(0x8f95a0, { tint: 'neutral' }), 0, h / 2, 0))
  for (let i = 0; i < 6; i++) {
    g.add(box(0.02, 0.04, radius * 2.4, pipeDark, 0, 1.1 + i * 0.3, 0))
  }
  // transformer + crossarms + insulators
  g.add(cylinder(0.16, 0.16, 0.4, 12, wetMaterial(0x5c6270, 0.5, 0.4), 0, h - 0.75, 0.0))
  g.add(box(1.35, 0.07, 0.09, pipeDark, 0, h - 0.45, 0))
  g.add(box(1.1, 0.06, 0.08, pipeDark, 0, h - 0.2, 0))
  for (let i = 0; i < 4; i++) {
    g.add(cylinder(0.03, 0.045, 0.09, 7, wetMaterial(0xd9d3c4, 0.5, 0.1), -0.6 + i * 0.4, h - 0.37, 0))
  }
  // step bolts
  for (let i = 0; i < 5; i++) g.add(box(0.26, 0.02, 0.02, metal, 0.16, 2.2 + i * 0.5, 0))
  // lamp arm
  if (big) {
    g.add(cylinder(0.035, 0.035, 0.85, 8, metal, -0.35, h - 1.35, 0.35).rotateX(0.5).rotateZ(-1.0))
    const lamp = new Group()
    lamp.position.set(-0.72, h - 1.22, 0.68)
    lamp.add(box(0.42, 0.08, 0.24, wetMaterial(0x3d424c, 0.4, 0.5), 0, 0.06, 0))
    lamp.add(box(0.36, 0.04, 0.2, new MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false }), 0, 0.0, 0))
    g.add(lamp)
  }
  return g
}

function signalHead(facing = 0): Group {
  const g = new Group()
  g.rotation.y = facing
  g.add(box(0.78, 0.26, 0.18, wetMaterial(0x30353f, 0.4, 0.45), 0, 0, 0))
  g.add(box(0.82, 0.06, 0.22, wetMaterial(0x22262e, 0.4, 0.45), 0, 0.16, 0))
  return g
}

function pedSignal(red?: MeshBasicMaterial, green?: MeshBasicMaterial): { group: Group; red: MeshBasicMaterial; green: MeshBasicMaterial } {
  const g = new Group()
  g.add(box(0.32, 0.62, 0.16, wetMaterial(0x30353f, 0.4, 0.45), 0, 0, 0))
  g.add(box(0.36, 0.04, 0.2, wetMaterial(0x22262e, 0.4, 0.45), 0, 0.32, 0))
  const rMat = red ?? new MeshBasicMaterial({ color: 0xff4d4d, toneMapped: false, transparent: true, opacity: 0.2 })
  const gMat = green ?? new MeshBasicMaterial({ color: 0x5ce6a0, toneMapped: false, transparent: true, opacity: 0.2 })
  const top = new Mesh(new CircleGeometry(0.1, 16), rMat)
  top.position.set(0, 0.14, 0.085)
  const bottom = new Mesh(new CircleGeometry(0.1, 16), gMat)
  bottom.position.set(0, -0.16, 0.085)
  g.add(top, bottom)
  return { group: g, red: rMat, green: gMat }
}

export function buildProps(): PropsParts {
  const group = new Group()
  const vehicleLamp: MeshBasicMaterial[] = []
  const farVehicle: MeshBasicMaterial[] = []

  // ------------------------------------------------------------ vending machines
  const vm1 = vending(2.66, 0.72, 0)
  vm1.rotation.y = 0.42
  group.add(vm1)
  const vm2 = vending(2.66, 1.42, 1)
  vm2.rotation.y = 0.42
  group.add(vm2)
  const vmLight = new PointLight(0xffa890, 1.6, 2.6, 2)
  vmLight.position.set(2.3, 1.1, 1.4)
  group.add(vmLight)
  const vmLight2 = new PointLight(0xa0dcff, 1.4, 2.4, 2)
  vmLight2.position.set(2.3, 1.1, 0.7)
  group.add(vmLight2)

  // ------------------------------------------------------------ umbrella stand
  const umb = new Group()
  umb.position.set(-0.66, 0.075, 0.55)
  umb.add(box(0.42, 0.46, 0.3, new MeshStandardMaterial({ color: 0x8d949f, roughness: 0.4, metalness: 0.7, wireframe: true }), 0, 0.23, 0))
  const umbCols = [0x2f4a63, 0x6d3036, 0x8a7040]
  umbCols.forEach((c, i) => {
    const slant = (i - 1) * 0.14
    const shaft = cylinder(0.012, 0.012, 0.72, 6, metal, -0.12 + i * 0.12, 0.42, slant)
    shaft.rotation.z = (i - 1) * 0.18
    umb.add(shaft)
    const canopy = new Mesh(new ConeGeometry(0.085, 0.3, 8), toonMaterial(c, { tint: 'cool' }))
    canopy.position.set(-0.12 + i * 0.12 + slant * 0.2, 0.62, slant)
    canopy.rotation.z = (i - 1) * 0.18
    umb.add(canopy)
    const handle = new Mesh(new TorusGeometry(0.03, 0.008, 6, 10), wetMaterial(0x3a2b1e, 0.5, 0.1))
    handle.position.set(-0.12 + i * 0.12, 0.04, slant)
    handle.rotation.y = Math.PI / 2
    umb.add(handle)
  })
  group.add(umb)

  // ------------------------------------------------------------ bins trio
  ;[0, 1, 2].forEach((i) => {
    const g = new Group()
    g.position.set(1.55 + i * 0.34, 0.075, 2.08)
    g.add(box(0.3, 0.56, 0.3, toonMaterial(0xdcd6c6, { tint: 'neutral' }), 0, 0.28, 0))
    g.add(plane(0.26, 0.18, new MeshBasicMaterial({ map: binTexture(i), toneMapped: false }), 0, 0.4, 0.153))
    g.add(box(0.3, 0.04, 0.32, wetMaterial(0x40454f, 0.4, 0.4), 0, 0.58, 0))
    g.add(box(0.16, 0.03, 0.16, new MeshStandardMaterial({ color: 0x101216, roughness: 0.6 }), 0, 0.6, 0))
    group.add(g)
  })

  // ------------------------------------------------------------ bicycle in the alley
  const bike = bicycle()
  bike.position.set(-3.08, 0.0, 1.05)
  bike.rotation.y = Math.PI / 2 + 0.12
  bike.rotation.z = -0.1
  group.add(bike)

  // ------------------------------------------------------------ utility pole + wires
  const poleA = utilityPole(3.18, 2.3, 5.0, true)
  group.add(poleA)
  const poleB = utilityPole(-4.6, 2.36, 4.35, false)
  group.add(poleB)
  const poleC = utilityPole(-4.55, -3.2, 4.1, false)
  group.add(poleC)
  // the block got bigger: three more poles carry the wires along the streets
  const poleD = utilityPole(-9.6, 2.35, 4.6, true)
  group.add(poleD)
  const poleE = utilityPole(8.05, 2.42, 4.9, true)
  group.add(poleE)
  const poleF = utilityPole(8.05, -6.2, 4.4, true)
  group.add(poleF)

  const sag = (a: Vector3, b: Vector3, drop: number): Vector3[] => {
    const pts: Vector3[] = []
    for (let i = 0; i <= 10; i++) {
      const t = i / 10
      const p = a.clone().lerp(b, t)
      p.y -= Math.sin(Math.PI * t) * drop
      pts.push(p)
    }
    return pts
  }
  const wireMat = wetMaterial(0x14161d, 0.7, 0.2)
  const addWire = (a: Vector3, b: Vector3, drop: number, mat = wireMat) => {
    const pts = sag(a, b, drop)
    for (let i = 0; i < pts.length - 1; i++) group.add(tube(pts[i], pts[i + 1], 0.012, mat, 5))
  }
  for (let w = 0; w < 3; w++) {
    addWire(new Vector3(3.18 - 0.55 + w * 0.5, 4.55 - w * 0.03, 2.3), new Vector3(-4.6 - 0.4 + w * 0.4, 4.0, 2.36), 1.05)
  }
  addWire(new Vector3(3.18, 4.3, 2.3), new Vector3(2.1, 3.7, 0.3), 0.15)
  addWire(new Vector3(3.18, 4.6, 2.3), new Vector3(3.18, 4.4, -5.0), 0.5)
  addWire(new Vector3(-4.6, 4.0, 2.36), new Vector3(-4.55, 3.9, -3.2), 0.4)
  // west run, east run and the side street
  for (let w = 0; w < 2; w++) {
    addWire(new Vector3(-4.6 - 0.4 + w * 0.4, 4.0 - w * 0.04, 2.36), new Vector3(-9.6 - 0.3 + w * 0.4, 4.1 - w * 0.04, 2.35), 1.0)
  }
  for (let w = 0; w < 2; w++) {
    addWire(new Vector3(3.18 + w * 0.35, 4.52 - w * 0.05, 2.3), new Vector3(8.05 - 0.35 + w * 0.35, 4.45 - w * 0.05, 2.42), 1.0)
  }
  for (let w = 0; w < 2; w++) {
    addWire(new Vector3(8.05 + w * 0.25, 4.4 - w * 0.06, 2.42), new Vector3(8.05 + w * 0.25, 4.05 - w * 0.06, -6.2), 0.9)
  }
  // service lane cable from the warehouse to the shop roofs
  addWire(new Vector3(-5.3, 4.4, -4.6), new Vector3(-2.9, 3.6, -3.4), 0.4)
  // street lamp light
  const lampLight = new PointLight(0xffdda8, 10, 12, 2)
  lampLight.position.set(2.46, 3.75, 2.98)
  group.add(lampLight)
  // the west end and the side street get their own lamps
  const lampWest = new PointLight(0xffdda8, 9, 11, 2)
  lampWest.position.set(-10.32, 3.38, 3.03)
  group.add(lampWest)
  const lampSide = new PointLight(0xffdda8, 8, 10, 2)
  lampSide.position.set(7.33, 3.18, -5.52)
  group.add(lampSide)
  const lampEast = new PointLight(0xffdda8, 9, 11, 2)
  lampEast.position.set(7.33, 3.68, 3.1)
  group.add(lampEast)

  // ------------------------------------------------------------ traffic signals
  const sig = new Group()
  sig.position.set(3.18, 3.0, 2.3)
  const arm = box(0.9, 0.05, 0.05, pipeDark, -0.45, 0.1, 0.2)
  sig.add(arm)
  const head = signalHead(0.25)
  head.position.set(-0.85, 0.1, 0.35)
  const greens: MeshBasicMaterial[] = []
  ;[0x38d98a, 0xf0c94a, 0xff4d4d].forEach((color, i) => {
    const mat = new MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.18 })
    const face = new Mesh(new CircleGeometry(0.085, 14), mat)
    face.position.set(-0.2 + i * 0.2, 0, 0.095)
    head.add(face)
    vehicleLamp.push(mat)
  })
  const hood = box(0.82, 0.06, 0.2, wetMaterial(0x22262e, 0.4, 0.45), 0, 0.2, 0)
  head.add(hood)
  sig.add(head)
  const ped = pedSignal()
  ped.group.position.set(-0.35, -0.55, 0.3)
  sig.add(ped.group)
  group.add(sig)
  // second signal over the side street, on the east corner pole
  const sig2 = new Group()
  sig2.position.set(8.05, 3.0, 2.42)
  sig2.add(box(0.05, 0.05, 0.95, pipeDark, -0.12, 0.1, -0.55))
  const head2 = signalHead(Math.PI)
  head2.position.set(-0.2, 0.1, -0.98)
  ;[0x38d98a, 0xf0c94a, 0xff4d4d].forEach((color, i) => {
    const mat = new MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.18 })
    const face = new Mesh(new CircleGeometry(0.085, 14), mat)
    face.position.set(-0.2 + i * 0.2, 0, 0.095)
    head2.add(face)
    vehicleLamp.push(mat)
  })
  sig2.add(head2)
  const ped2 = pedSignal(ped.red, ped.green)
  ped2.group.position.set(0.3, -0.55, -0.35)
  ped2.group.rotation.y = Math.PI / 2
  sig2.add(ped2.group)
  group.add(sig2)
  // small far signal across the street at the west crosswalk
  const far = new Group()
  far.position.set(-8.4, 2.35, 6.95)
  far.add(cylinder(0.05, 0.06, 2.35, 8, poleMat, 0, 1.17, 0))
  const farHead = signalHead(Math.PI)
  farHead.position.set(-0.1, 0, 0)
  farHead.scale.setScalar(0.7)
  ;[0x38d98a, 0xf0c94a, 0xff4d4d].forEach((color, i) => {
    const mat = new MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.18 })
    const face = new Mesh(new CircleGeometry(0.085, 12), mat)
    face.position.set(-0.2 + i * 0.2, 0, 0.1)
    farHead.add(face)
    farVehicle.push(mat)
  })
  far.add(farHead)
  group.add(far)

  // ------------------------------------------------------------ road signs
  const signPost = new Group()
  signPost.position.set(-3.6, 0.075, 2.18)
  signPost.add(cylinder(0.035, 0.04, 2.4, 8, metal, 0, 1.2, 0))
  const stop = plane(0.62, 0.62, new MeshBasicMaterial({ map: stopSignTexture(), transparent: true, toneMapped: false, side: DoubleSide }), 0, 2.02, 0.04)
  signPost.add(stop)
  const plate = plane(0.78, 0.2, new MeshBasicMaterial({ map: streetPlateTexture(), toneMapped: false, side: DoubleSide }), 0, 1.62, 0.03)
  signPost.add(plate)
  group.add(signPost)

  const parking = plane(0.42, 0.42, new MeshBasicMaterial({ map: parkingSignTexture(), toneMapped: false, side: DoubleSide }), -8.0, 1.55, 7.05)
  parking.rotation.y = Math.PI
  const parkingPost = cylinder(0.03, 0.035, 1.5, 8, metal, -2.7, 0.8, 4.93)
  group.add(parking, parkingPost)

  // ------------------------------------------------------------ guardrail
  const rail = new Group()
  const railZ = 2.44
  for (let i = 0; i < 4; i++) {
    const px = -3.78 + i * 0.42
    rail.add(cylinder(0.026, 0.03, 0.86, 8, whitePaint, px, 0.43, railZ))
    rail.add(box(0.06, 0.05, 0.06, wetMaterial(0xd94b4b, 0.4, 0.2), px, 0.72, railZ))
  }
  for (const y of [0.55, 0.82]) {
    const bar = cylinder(0.022, 0.022, 1.32, 8, whitePaint, -3.15, y, railZ).rotateZ(Math.PI / 2)
    rail.add(bar)
  }
  group.add(rail)

  // ------------------------------------------------------------ bulletin board
  const board = new Group()
  board.position.set(-3.28, 0.0, 1.42)
  board.add(cylinder(0.02, 0.022, 1.7, 6, metal, -0.3, 0.85, 0))
  board.add(cylinder(0.02, 0.022, 1.7, 6, metal, 0.3, 0.85, 0))
  board.add(box(0.78, 0.6, 0.06, wetMaterial(0x4a3b2a, 0.5, 0.2), 0, 1.34, 0))
  board.add(plane(0.72, 0.54, new MeshBasicMaterial({ map: boardTexture(), toneMapped: false }), 0, 1.34, 0.035))
  board.add(box(0.86, 0.03, 0.14, wetMaterial(0x3a2c1e, 0.5, 0.2), 0, 1.66, 0.03))
  group.add(board)

  // ------------------------------------------------------------ shop banner (nobori)
  const bannerTex = makeTexture(256, 640, (ctx) => {
    ctx.fillStyle = '#f7f2e3'
    ctx.fillRect(0, 0, 256, 640)
    ctx.fillStyle = '#0d8264'
    ctx.fillRect(0, 0, 256, 26)
    ctx.fillRect(0, 614, 256, 26)
    ctx.fillStyle = '#16453a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '900 74px "Noto Sans CJK JP",sans-serif'
    ;['お', 'に', 'ぎ', 'り'].forEach((c, i) => ctx.fillText(c, 128, 100 + i * 82))
    ctx.fillStyle = '#d9731f'
    ctx.font = '900 62px "Trebuchet MS",Arial'
    ctx.fillText('¥110', 128, 470)
    ctx.fillStyle = '#3d7d69'
    ctx.font = '700 26px "Trebuchet MS",Arial'
    ctx.fillText('HOSHIZORA', 128, 540)
  })
  const nobori = new Group()
  nobori.position.set(2.0, 0.075, 0.62)
  nobori.add(cylinder(0.018, 0.02, 1.6, 6, metal, 0, 0.8, 0))
  nobori.add(box(0.04, 0.03, 0.34, metal, 0, 1.56, -0.15))
  const cloth = plane(0.34, 0.9, new MeshBasicMaterial({ map: bannerTex, toneMapped: false, side: DoubleSide }), 0, 1.1, -0.3)
  cloth.rotation.y = Math.PI / 2
  nobori.add(cloth)
  group.add(nobori)

  // ------------------------------------------------------------ ground AC for the shop
  const ac = new Group()
  ac.position.set(2.5, 0.075, -2.95)
  ac.add(box(0.62, 0.5, 0.36, toonMaterial(0xb6b0a1, { tint: 'neutral' }), 0, 0.55, 0))
  ac.add(cylinder(0.15, 0.15, 0.02, 16, wetMaterial(0x2c313b, 0.5, 0.4), 0, 0.58, -0.19).rotateX(Math.PI / 2))
  ac.add(box(0.06, 0.3, 0.06, pipeDark, -0.24, 0.32, -0.1))
  group.add(ac)

  // ------------------------------------------------------------ neighbour house
  const house = new Group()
  const wallMat = toonMaterial(0xb8b0a0, { tint: 'cool' })
  house.add(box(1.1, 2.5, 3.7, wallMat, -4.45, 1.25, -1.65))
  // tiled roof
  const roofMat = new MeshStandardMaterial({ map: roofTileTexture(), roughness: 0.55, metalness: 0.25 })
  const roofA = box(1.3, 0.08, 2.1, roofMat, -4.45, 2.86, -0.75)
  roofA.rotation.x = 0.24
  const roofB = box(1.3, 0.08, 2.1, roofMat, -4.45, 2.86, -2.55)
  roofB.rotation.x = -0.24
  house.add(roofA, roofB)
  house.add(box(1.4, 0.1, 0.14, wetMaterial(0x3d424c, 0.5, 0.3), -4.45, 2.98, -1.65))
  // lit window onto the alley
  house.add(box(0.06, 0.9, 1.0, warmFrame, -3.905, 1.55, -0.9))
  const win = plane(0.92, 0.8, new MeshBasicMaterial({ map: houseWindow(), toneMapped: false }), -3.87, 1.55, -0.9, 0, Math.PI / 2)
  house.add(win)
  house.add(box(0.05, 0.05, 1.04, wetMaterial(0xe8dfc9, 0.4, 0.2), -3.9, 1.97, -0.9))
  house.add(box(0.05, 0.05, 1.04, wetMaterial(0xe8dfc9, 0.4, 0.2), -3.9, 1.13, -0.9))
  // bar door + noren
  house.add(box(0.06, 1.9, 0.82, wetMaterial(0x3f2c22, 0.55, 0.15), -3.9, 1.02, -2.1))
  house.add(plane(0.72, 0.34, new MeshStandardMaterial({ color: 0x2c3f6e, roughness: 0.8, side: DoubleSide }), -3.86, 1.62, -2.1, 0, Math.PI / 2))
  // wall AC
  house.add(box(0.36, 0.5, 0.62, toonMaterial(0xb9b3a3, { tint: 'neutral' }), -3.82, 2.3, -0.2))
  house.add(cylinder(0.12, 0.12, 0.02, 14, wetMaterial(0x2c313b, 0.5, 0.4), -3.63, 2.32, -0.2).rotateZ(Math.PI / 2))
  // mailbox + step + plants
  house.add(box(0.24, 0.3, 0.16, wetMaterial(0x5a5f6a, 0.4, 0.5), -3.88, 0.95, 0.02))
  house.add(box(0.5, 0.12, 0.24, wetMaterial(0x8a8f98, 0.5, 0.2), -3.78, 0.14, -2.1))
  for (let i = 0; i < 3; i++) {
    const pot = cylinder(0.09, 0.11, 0.16, 10, toonMaterial(0x9a6a4a), -3.72, 0.16, -1.55 + i * 0.22)
    house.add(pot)
    house.add(sphere(0.12, toonMaterial(0x3f6b45), -3.72, 0.33, -1.55 + i * 0.22, 8))
  }
  // downpipe
  house.add(cylinder(0.04, 0.04, 2.4, 8, pipeDark, -3.87, 1.35, 0.18))
  // west gable: one more lit window + pipe so the alley view has a face, not a slab
  house.add(box(0.05, 0.88, 0.96, wetMaterial(0xe8dfc9, 0.4, 0.2), -4.99, 1.52, -1.95))
  house.add(plane(0.8, 0.72, new MeshBasicMaterial({ map: houseWindow(), toneMapped: false }), -5.02, 1.52, -1.95, 0, -Math.PI / 2))
  house.add(box(0.05, 0.05, 1.0, wetMaterial(0xe8dfc9, 0.4, 0.2), -5.0, 1.98, -1.95))
  house.add(cylinder(0.04, 0.04, 2.2, 8, pipeDark, -5.01, 1.15, -0.15))
  house.add(box(0.5, 0.14, 0.62, wetMaterial(0x8a8f98, 0.5, 0.2), -4.85, 0.13, 0.6))
  group.add(house)

  // ------------------------------------------------------------ neon bar sign + lantern
  const neonMat = new MeshBasicMaterial({ map: neonTexture(), toneMapped: false, transparent: true, blending: AdditiveBlending, depthWrite: false })
  const neon = plane(0.9, 0.45, neonMat, -3.84, 2.36, -1.05, 0, Math.PI / 2)
  group.add(neon)
  group.add(box(0.04, 0.5, 0.96, wetMaterial(0x2a2d36, 0.5, 0.3), -3.87, 2.36, -1.05))
  const barLight = new PointLight(0xff7fb0, 3, 3.2, 2)
  barLight.position.set(-3.7, 2.2, -1.0)
  group.add(barLight)
  // paper lantern by the bar door
  const lantern = new Group()
  lantern.position.set(-3.66, 1.86, -2.1)
  lantern.add(cylinder(0.001, 0.001, 0.12, 4, pipeDark, 0, 0.36, 0))
  const lanternBody = cylinder(0.15, 0.15, 0.34, 14, new MeshBasicMaterial({ color: 0xff9a6a, toneMapped: false }), 0, 0.14, 0)
  lantern.add(lanternBody)
  lantern.add(box(0.16, 0.02, 0.16, wetMaterial(0x2c1e16, 0.5, 0.2), 0, 0.31, 0))
  lantern.add(box(0.16, 0.02, 0.16, wetMaterial(0x2c1e16, 0.5, 0.2), 0, -0.03, 0))
  group.add(lantern)
  const lanternLight = new PointLight(0xffa06a, 2, 3, 2)
  lanternLight.position.set(-3.55, 2.0, -2.1)
  group.add(lanternLight)

  // ------------------------------------------------------------ alley clutter
  const crateMat = toonMaterial(0xa87b4a, { tint: 'warm' })
  const crates = new Group()
  crates.position.set(-3.55, 0.0, -3.95)
  crates.add(box(0.5, 0.3, 0.36, crateMat, 0, 0.15, 0))
  crates.add(box(0.5, 0.3, 0.36, crateMat, 0.08, 0.45, 0.02))
  crates.add(box(0.44, 0.26, 0.3, crateMat, -0.02, 0.73, 0))
  for (let i = 0; i < 4; i++) crates.add(cylinder(0.045, 0.045, 0.26, 8, wetMaterial(0x2f5a3a, 0.3, 0.4), -0.16 + i * 0.1, 0.9, 0))
  crates.add(box(0.2, 0.3, 0.2, wetMaterial(0x1f3b2a, 0.6, 0.1), 0.55, 0.15, 0.1))
  const bag = sphere(0.16, wetMaterial(0xdfe3e8, 0.6, 0.05), -0.55, 0.14, 0.05, 8)
  bag.scale.set(1, 0.7, 0.9)
  crates.add(bag)
  group.add(crates)

  // a few posters stuck on the shop's alley wall
  for (let i = 0; i < 2; i++) {
    const p = plane(0.4, 0.55, new MeshBasicMaterial({ map: posterTexture(i + 2), toneMapped: false }), -2.855, 1.5 + i * 0.02, -1.9 - i * 0.55, 0, -Math.PI / 2)
    group.add(p)
  }

  return { group, vehicleLamp, pedRed: ped.red, pedGreen: ped.green, farVehicle, neon: neonMat, barLight }
}

const warmFrame = toonMaterial(0xd8cfae, { tint: 'warm' })

function houseWindow(): Texture {
  return makeTexture(512, 448, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 448)
    g.addColorStop(0, '#ffcf8a')
    g.addColorStop(1, '#e89a58')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 448)
    ctx.fillStyle = 'rgba(60,40,25,0.5)'
    ctx.fillRect(0, 0, 512, 16)
    ctx.fillRect(252, 0, 8, 448)
    ctx.fillRect(0, 200, 512, 10)
    // curtains
    ctx.fillStyle = 'rgba(140,60,50,0.65)'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(120, 160, 40, 448)
    ctx.lineTo(0, 448)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(512, 0)
    ctx.quadraticCurveTo(400, 180, 480, 448)
    ctx.lineTo(512, 448)
    ctx.closePath()
    ctx.fill()
    // a lamp and shelf silhouette
    ctx.fillStyle = 'rgba(60,40,30,0.55)'
    ctx.fillRect(120, 300, 180, 12)
    ctx.fillRect(150, 220, 14, 80)
    ctx.beginPath()
    ctx.arc(157, 214, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,240,200,0.9)'
    ctx.beginPath()
    ctx.arc(157, 214, 14, 0, Math.PI * 2)
    ctx.fill()
  })
}
