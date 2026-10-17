/** Street life around the block: bus shelter, phone booth, post box, hydrant,
 *  vending machines, parked and passing cars, cats, scooter, traffic cones. */
import {
  AdditiveBlending,
  CircleGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  TorusGeometry,
  Vector3,
} from 'three'
import {
  FONT_JP,
  FONT_LATIN,
  box,
  cylinder,
  drawText,
  glowTexture,
  makeTexture,
  plane,
  roundRect,
  sphere,
  toonMaterial,
  vendingTexture,
  wetMaterial,
} from './toon'

export interface StreetParts {
  group: Group
  /** white kei-truck that keeps driving past on the main street */
  passingCar: Group
  passingWheels: Group[]
  /** cats with a swishing tail */
  cats: { group: Group; tail: Group }[]
  /** headlight cone + lamps of the parked cars, to shimmer in the wet */
  vendingLights: PointLight[]
}

const metal = wetMaterial(0x8a919e, 0.35, 0.72)
const pipeDark = wetMaterial(0x40454f, 0.45, 0.4)

/* ------------------------------------------------------------------ helpers */

function vending(x: number, z: number, rotY: number, kind: 0 | 1, y = 0.075) {
  const g = new Group()
  g.position.set(x, y, z)
  g.rotation.y = rotY
  g.add(box(0.72, 1.78, 0.62, toonMaterial(0xdfe3e6, { tint: 'neutral' }), 0, 0.89, 0))
  g.add(plane(0.66, 1.62, new MeshBasicMaterial({ map: vendingTexture(kind), toneMapped: false }), 0, 0.94, 0.315))
  g.add(box(0.024, 1.7, 0.6, wetMaterial(kind ? 0x8a2a24 : 0x1d5c85, 0.35, 0.4), -0.372, 0.9, 0))
  g.add(box(0.024, 1.7, 0.6, wetMaterial(kind ? 0x8a2a24 : 0x1d5c85, 0.35, 0.4), 0.372, 0.9, 0))
  g.add(box(0.66, 0.04, 0.05, new MeshBasicMaterial({ color: kind ? 0xffb1a0 : 0xa8e4ff, toneMapped: false }), 0, 1.8, 0.3))
  g.add(plane(0.7, 0.9, new MeshBasicMaterial({ map: glowTexture(), color: kind ? 0xff9c86 : 0x9fdcff, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false, toneMapped: false }), 0, 0.95, 0.42))
  return g
}

function busTimetable(): Mesh {
  const tex = makeTexture(256, 384, (ctx) => {
    ctx.fillStyle = '#f2eee2'
    ctx.fillRect(0, 0, 256, 384)
    ctx.fillStyle = '#2f5a86'
    ctx.fillRect(0, 0, 256, 54)
    ctx.fillStyle = '#f2eee2'
    ctx.font = '900 26px "Noto Sans CJK JP",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('星宮循環線', 128, 30)
    const rows = ['6  12  18  24', '32  40  48  56', '7  15  23  31', '39  47  55', '8  16  24  32']
    ctx.font = '700 20px "Trebuchet MS",Arial'
    ctx.fillStyle = '#3d4450'
    ctx.textAlign = 'left'
    rows.forEach((r, i) => {
      ctx.fillStyle = i % 2 ? '#e7e1d2' : '#dcd6c6'
      ctx.fillRect(14, 76 + i * 52, 228, 40)
      ctx.fillStyle = '#3d4450'
      ctx.font = '700 22px "Noto Sans CJK JP",sans-serif'
      ctx.fillText(i === 0 ? '6時' : `${i + 6}時`, 22, 98 + i * 52)
      ctx.font = '700 20px "Trebuchet MS",Arial'
      ctx.fillText(r, 78, 98 + i * 52)
    })
    ctx.fillStyle = '#8a3a34'
    ctx.fillRect(28, 350, 200, 24)
    ctx.fillStyle = '#f2eee2'
    ctx.font = '700 14px "Noto Sans CJK JP",sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('運賃 後払い', 128, 363)
  })
  return plane(0.72, 1.06, new MeshBasicMaterial({ map: tex, toneMapped: false }), 0, 1.32, 0)
}

function busStop(): Group {
  const g = new Group()
  g.position.set(0.55, 0.075, 7.5)
  // shelter
  const frameMat = wetMaterial(0x8a919e, 0.4, 0.6)
  for (const px of [-1.05, 1.05]) {
    for (const pz of [-0.44, 0.42]) {
      g.add(cylinder(0.045, 0.045, 2.25, 8, frameMat, px, 1.12, pz))
    }
  }
  g.add(box(2.34, 0.08, 1.0, toonMaterial(0x5d6470, { tint: 'neutral' }), 0, 2.28, 0))
  g.add(box(2.4, 0.06, 1.06, wetMaterial(0x8a919e, 0.4, 0.6), 0, 2.34, 0))
  // back panel with glass + timetable
  g.add(box(2.28, 1.5, 0.05, new MeshBasicMaterial({ color: 0x9fd0e2, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }), 0, 1.42, -0.44))
  g.add(box(2.32, 0.06, 0.08, frameMat, 0, 2.16, -0.44))
  g.add(box(2.32, 0.06, 0.08, frameMat, 0, 0.66, -0.44))
  const board = new Group()
  board.position.set(0.62, 0, -0.4)
  board.add(busTimetable())
  g.add(board)
  // bench
  g.add(box(1.7, 0.07, 0.34, toonMaterial(0x8a6a4a, { tint: 'warm' }), -0.2, 0.44, -0.16))
  g.add(box(0.06, 0.44, 0.3, wetMaterial(0x3a3f49, 0.4, 0.5), -0.9, 0.22, -0.16))
  g.add(box(0.06, 0.44, 0.3, wetMaterial(0x3a3f49, 0.4, 0.5), 0.5, 0.22, -0.16))
  // ceiling lamp
  g.add(box(0.5, 0.05, 0.16, new MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false }), 0, 2.24, 0.1))
  const light = new PointLight(0xffe0b0, 2.6, 4.5, 2)
  light.position.set(0, 2.1, 0.2)
  g.add(light)
  // bus sign pole
  const pole = new Group()
  pole.position.set(-1.55, 0, 0.15)
  pole.add(cylinder(0.05, 0.055, 2.5, 8, metal, 0, 1.25, 0))
  const disc = cylinder(0.3, 0.3, 0.04, 20, new MeshBasicMaterial({ color: 0xe8e3d6, toneMapped: false }), 0, 2.32, 0)
  disc.rotation.x = Math.PI / 2
  pole.add(disc)
  const ring = new Mesh(new TorusGeometry(0.3, 0.022, 6, 22), toonMaterial(0x2f5a86, { tint: 'cool' }))
  ring.position.set(0, 2.32, 0)
  pole.add(ring)
  const signTex = makeTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#e8e3d6'
    ctx.beginPath()
    ctx.arc(64, 64, 62, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2f5a86'
    ctx.font = '900 64px "Noto Sans CJK JP",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('バス', 64, 58)
    ctx.font = '700 16px "Trebuchet MS",Arial'
    ctx.fillText('BUS STOP', 64, 100)
  })
  pole.add(plane(0.52, 0.52, new MeshBasicMaterial({ map: signTex, toneMapped: false }), 0, 2.32, 0.03))
  pole.add(plane(0.52, 0.52, new MeshBasicMaterial({ map: signTex, toneMapped: false }), 0, 2.32, -0.03, 0, Math.PI))
  g.add(pole)
  return g
}

function phoneBooth(): Group {
  const g = new Group()
  g.position.set(-6.9, 0.075, 1.6)
  const frameMat = wetMaterial(0x2f6b5e, 0.4, 0.5)
  g.add(box(0.86, 2.2, 0.86, new MeshBasicMaterial({ color: 0x9fd0e2, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }), 0, 1.1, 0))
  for (const [px, pz] of [
    [-0.43, -0.43],
    [0.43, -0.43],
    [-0.43, 0.43],
    [0.43, 0.43],
  ] as const) {
    g.add(box(0.07, 2.2, 0.07, frameMat, px, 1.1, pz))
  }
  g.add(box(0.94, 0.14, 0.94, frameMat, 0, 2.24, 0))
  g.add(box(0.9, 0.16, 0.9, frameMat, 0, 0.08, 0))
  g.add(box(0.7, 0.6, 0.06, frameMat, 0, 1.7, -0.42))
  // phone unit
  g.add(box(0.34, 0.5, 0.24, toonMaterial(0x3a3f49, { tint: 'neutral' }), 0, 1.28, -0.24))
  g.add(box(0.1, 0.2, 0.1, wetMaterial(0x22262e, 0.5, 0.4), 0.2, 1.3, -0.2))
  g.add(box(0.3, 0.24, 0.05, new MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false }), 0, 1.45, -0.36))
  g.add(box(0.16, 0.05, 0.1, new MeshBasicMaterial({ color: 0xbff0ff, toneMapped: false }), 0, 2.05, 0.1))
  const light = new PointLight(0xbfe6ff, 1.6, 3, 2)
  light.position.set(0, 1.9, 0.1)
  g.add(light)
  return g
}

function postBox(): Group {
  const g = new Group()
  g.position.set(-8.55, 0.075, 1.35)
  g.add(cylinder(0.22, 0.24, 1.1, 14, toonMaterial(0xb03a34, { tint: 'warm' }), 0, 0.55, 0))
  const dome = sphere(0.24, toonMaterial(0xb03a34, { tint: 'warm' }), 0, 1.1, 0, 14)
  dome.scale.set(1, 0.6, 1)
  g.add(dome)
  g.add(box(0.36, 0.06, 0.12, wetMaterial(0x2c1e16, 0.5, 0.2), 0, 1.02, 0.19))
  g.add(plane(0.2, 0.08, new MeshBasicMaterial({ color: 0xf0e8d8, toneMapped: false }), 0, 0.72, 0.234))
  return g
}

function hydrant(): Group {
  const g = new Group()
  g.position.set(2.6, 0.075, 6.95)
  g.add(cylinder(0.11, 0.13, 0.55, 10, toonMaterial(0xb03a34, { tint: 'warm' }), 0, 0.28, 0))
  g.add(cylinder(0.14, 0.14, 0.06, 10, toonMaterial(0x8a2a24, { tint: 'warm' }), 0, 0.57, 0))
  g.add(cylinder(0.05, 0.05, 0.3, 8, toonMaterial(0xb03a34, { tint: 'warm' }), 0.16, 0.36, 0).rotateZ(Math.PI / 2))
  g.add(cylinder(0.05, 0.05, 0.3, 8, toonMaterial(0xb03a34, { tint: 'warm' }), -0.16, 0.36, 0).rotateZ(Math.PI / 2))
  return g
}

/* ------------------------------------------------------------------ vehicles */

function wheel(r = 0.26): Group {
  const g = new Group()
  const tire = new Mesh(new TorusGeometry(r, 0.075, 8, 18), wetMaterial(0x1b1f27, 0.6, 0.15))
  g.add(tire)
  const hub = cylinder(r * 0.55, r * 0.55, 0.11, 12, wetMaterial(0x9aa0aa, 0.35, 0.75), 0, 0, 0)
  hub.rotation.x = Math.PI / 2
  g.add(hub)
  return g
}

function carLights(group: Group, head: number, tail: number) {
  const headMat = new MeshBasicMaterial({ color: head, toneMapped: false })
  const tailMat = new MeshBasicMaterial({ color: tail, toneMapped: false })
  const glow = new MeshBasicMaterial({ map: glowTexture(), color: head, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
  for (const sx of [-0.5, 0.5]) {
    group.add(box(0.2, 0.11, 0.05, headMat, sx, 0.55, 0.02))
    group.add(box(0.16, 0.09, 0.05, tailMat, sx, 0.55, 0.005))
    group.add(plane(0.5, 0.5, glow, sx * 1.05, 0.55, 0.28))
  }
}

function keiTruck(): { group: Group; wheels: Group[] } {
  const g = new Group()
  const bodyCol = 0xe8e6df
  // bed + cab
  g.add(box(1.42, 0.5, 1.72, toonMaterial(bodyCol, { tint: 'neutral' }), 0, 0.52, 0))
  g.add(box(1.36, 0.42, 0.86, toonMaterial(bodyCol, { tint: 'neutral' }), 0, 0.96, 0.44))
  g.add(box(1.3, 0.4, 0.78, new MeshBasicMaterial({ color: 0x2c3d4c, toneMapped: false }), 0, 1.16, 0.44))
  g.add(box(1.3, 0.36, 0.05, toonMaterial(bodyCol, { tint: 'neutral' }), 0, 1.16, 0.86))
  // bed sides
  g.add(box(1.42, 0.3, 0.05, toonMaterial(bodyCol, { tint: 'neutral' }), 0, 0.8, -0.86))
  g.add(box(0.05, 0.3, 1.7, toonMaterial(bodyCol, { tint: 'neutral' }), -0.71, 0.8, -0.02))
  g.add(box(0.05, 0.3, 1.7, toonMaterial(bodyCol, { tint: 'neutral' }), 0.71, 0.8, -0.02))
  g.add(box(1.3, 0.06, 1.6, toonMaterial(0x9aa0aa, { tint: 'neutral' }), 0, 0.78, -0.06))
  g.add(box(0.5, 0.25, 0.3, toonMaterial(0xb9c1c9, { tint: 'neutral' }), -0.2, 0.95, -0.2))
  // bumper
  g.add(box(1.46, 0.12, 0.12, wetMaterial(0x3a3f49, 0.4, 0.5), 0, 0.32, 0.88))
  carLights(g, 0xfff0c0, 0xff5a4a)
  const wheels: Group[] = []
  for (const [wx, wz] of [
    [-0.68, 0.55],
    [0.68, 0.55],
    [-0.68, -0.55],
    [0.68, -0.55],
  ] as const) {
    const w = wheel(0.24)
    w.position.set(wx, 0.26, wz)
    w.rotation.z = Math.PI / 2
    wheels.push(w)
    g.add(w)
  }
  return { group: g, wheels }
}

function keiCar(col: number): Group {
  const g = new Group()
  g.add(box(1.32, 0.62, 1.9, toonMaterial(col, { tint: 'neutral' }), 0, 0.62, 0))
  g.add(box(1.24, 0.5, 1.2, toonMaterial(col, { tint: 'neutral' }), 0, 1.16, -0.1))
  g.add(box(1.16, 0.4, 1.1, new MeshBasicMaterial({ color: 0x2c3d4c, toneMapped: false }), 0, 1.2, -0.1))
  g.add(box(1.34, 0.1, 0.1, wetMaterial(0x3a3f49, 0.4, 0.5), 0, 0.34, 0.95))
  g.add(box(1.34, 0.1, 0.1, wetMaterial(0x3a3f49, 0.4, 0.5), 0, 0.34, -0.95))
  carLights(g, 0xffeec0, 0x8a2a24)
  for (const [wx, wz] of [
    [-0.62, 0.62],
    [0.62, 0.62],
    [-0.62, -0.62],
    [0.62, -0.62],
  ] as const) {
    const w = wheel(0.24)
    w.position.set(wx, 0.26, wz)
    w.rotation.z = Math.PI / 2
    g.add(w)
  }
  return g
}

function scooter(): Group {
  const g = new Group()
  g.add(box(0.34, 0.16, 1.1, toonMaterial(0xd8d2c4, { tint: 'neutral' }), 0, 0.42, 0))
  g.add(box(0.36, 0.44, 0.4, toonMaterial(0xb03a34, { tint: 'warm' }), 0, 0.66, 0.3))
  g.add(box(0.3, 0.1, 0.1, wetMaterial(0x22262e, 0.5, 0.3), 0, 0.94, 0.4))
  g.add(box(0.05, 0.4, 0.05, metal, 0, 0.72, -0.42))
  for (const wz of [0.55, -0.5]) {
    const w = wheel(0.2)
    w.position.set(0, 0.22, wz)
    w.rotation.y = Math.PI / 2
    w.rotation.z = Math.PI / 2
    g.add(w)
  }
  // milk crate on the back
  g.add(box(0.36, 0.24, 0.3, toonMaterial(0x2f5a86, { tint: 'cool' }), 0, 1.02, -0.42))
  return g
}

/* ------------------------------------------------------------------ cat */

function cat(col: number): { group: Group; tail: Group } {
  const g = new Group()
  const fur = toonMaterial(col, { tint: 'neutral' })
  const dark = toonMaterial(0x1a1a20, { tint: 'neutral' })
  const body = sphere(0.17, fur, 0, 0.17, 0, 12)
  body.scale.set(1.0, 0.9, 1.4)
  g.add(body)
  const head = sphere(0.115, fur, 0, 0.29, 0.16, 12)
  g.add(head)
  for (const sx of [-0.07, 0.07]) {
    const ear = new Mesh(new ConeGeometry(0.045, 0.09, 4), fur)
    ear.position.set(sx, 0.38, 0.16)
    ear.rotation.y = Math.PI / 4
    g.add(ear)
    const eye = sphere(0.018, new MeshBasicMaterial({ color: 0xbff0b0, toneMapped: false }), sx * 0.9, 0.31, 0.255, 6)
    g.add(eye)
  }
  g.add(sphere(0.02, dark, 0, 0.275, 0.27, 6))
  for (let i = 0; i < 4; i++) {
    g.add(box(0.05, 0.12, 0.05, fur, i < 2 ? -0.08 : 0.08, 0.06, i % 2 ? 0.14 : -0.12))
  }
  const tail = new Group()
  tail.position.set(0, 0.2, -0.2)
  const t1 = cylinder(0.022, 0.028, 0.2, 6, fur, 0, 0.1, -0.03)
  t1.rotation.x = -0.5
  tail.add(t1)
  const t2 = cylinder(0.02, 0.022, 0.16, 6, fur, 0, 0.24, -0.11)
  t2.rotation.x = -1.1
  tail.add(t2)
  g.add(tail)
  return { group: g, tail }
}

/* ------------------------------------------------------------------ assembly */

export function buildStreetLife(parkingSpots: { x: number; z: number; rot: number }[]): StreetParts {
  const group = new Group()
  const cats: { group: Group; tail: Group }[] = []
  const vendingLights: PointLight[] = []

  group.add(busStop())
  group.add(phoneBooth())
  group.add(postBox())
  group.add(hydrant())

  // vending bank by the laundry
  const bank = new Group()
  bank.add(vending(0, 0, 0, 0))
  bank.add(vending(0.78, 0, 0, 1))
  bank.position.set(-4.55, 0.075, 8.55)
  bank.rotation.y = Math.PI
  group.add(bank)
  const bankLight = new PointLight(0xffa890, 2.0, 3.6, 2)
  bankLight.position.set(-4.2, 1.1, 8.1)
  group.add(bankLight)
  vendingLights.push(bankLight)

  // one more by the coin parking corner
  group.add(vending(10.15, 0.72, Math.PI, 0, 0.075))
  const cornerLight = new PointLight(0xa0dcff, 1.8, 3.4, 2)
  cornerLight.position.set(9.7, 1.1, 0.55)
  group.add(cornerLight)
  vendingLights.push(cornerLight)

  // parked cars in the coin-parking bays
  const paint = [0xd8d2c4, 0x2f5a86, 0x7a5560]
  parkingSpots.forEach((slot, i) => {
    const car = keiCar(paint[i % paint.length])
    car.position.set(slot.x, 0.012, slot.z)
    car.rotation.y = -Math.PI / 2 + 0.02
    group.add(car)
  })
  // one parallel-parked van on the main street
  const van = keiCar(0x8d949f)
  van.position.set(-6.4, 0.03, 5.8)
  van.rotation.y = Math.PI / 2
  group.add(van)
  // two more cars parked east of the junction so that stretch is not empty road
  const east1 = keiCar(0x6f7f8c)
  east1.position.set(9.15, 0.012, 6.15)
  east1.rotation.y = 0.015
  group.add(east1)
  const east2 = keiCar(0xb0a89a)
  east2.position.set(10.45, 0.012, 6.15)
  east2.rotation.y = -0.01
  group.add(east2)
  // scooters by the shop corner
  const sc1 = scooter()
  sc1.position.set(2.78, 0.075, -2.5)
  sc1.rotation.y = Math.PI / 2 + 0.1
  group.add(sc1)
  const sc2 = scooter()
  sc2.position.set(-4.0, 0.075, 1.1)
  sc2.rotation.y = Math.PI / 2 - 0.15
  group.add(sc2)

  // the passing kei-truck
  const passing = keiTruck()
  passing.group.position.set(-14, 0.03, 3.8)
  passing.group.rotation.y = Math.PI / 2
  group.add(passing.group)
  const headlight = new PointLight(0xfff0c8, 0, 9, 2)
  headlight.position.set(0, 0.55, 1.1)
  passing.group.add(headlight)

  // cats: one on the alley crates, one on the bus-stop bench
  const c1 = cat(0xd8c8b0)
  c1.group.position.set(-3.45, 0.9, -3.85)
  c1.group.rotation.y = 0.7
  group.add(c1.group)
  cats.push(c1)
  const c2 = cat(0x3a3f49)
  c2.group.position.set(0.1, 0.5, 7.3)
  c2.group.rotation.y = 2.4
  c2.group.scale.setScalar(0.92)
  group.add(c2.group)
  cats.push(c2)

  // traffic cones + barrier (a little road work by the junction)
  const coneCols = [0xf0642e, 0xf0642e, 0xf0642e]
  coneCols.forEach((c, i) => {
    const cone = new Mesh(new ConeGeometry(0.12, 0.34, 10), toonMaterial(c, { tint: 'warm' }))
    cone.position.set(4.6 + i * 0.5, 0.17, 2.45)
    group.add(cone)
    const base = box(0.26, 0.04, 0.26, toonMaterial(0x2c3038, { tint: 'neutral' }), 4.6 + i * 0.5, 0.02, 2.45)
    group.add(base)
    const band = new Mesh(new TorusGeometry(0.09, 0.016, 5, 12), new MeshBasicMaterial({ color: 0xf4f0e2, toneMapped: false }))
    band.position.set(4.6 + i * 0.5, 0.22, 2.45)
    band.rotation.x = Math.PI / 2
    group.add(band)
  })
  // barrier bar between the cones
  group.add(box(1.7, 0.09, 0.06, toonMaterial(0xf0c94a, { tint: 'warm' }), 5.05, 0.62, 2.45))
  for (const bx of [4.3, 5.8]) group.add(cylinder(0.03, 0.03, 0.62, 6, metal, bx, 0.31, 2.45))
  // a safety lamp on the barrier
  group.add(box(0.1, 0.14, 0.1, new MeshBasicMaterial({ color: 0xffb84a, toneMapped: false }), 5.05, 0.72, 2.45))

  // utility cabinets + banner poles on the pavement
  const cab = new Group()
  cab.position.set(-9.55, 0.075, 2.1)
  cab.add(box(0.5, 0.86, 0.34, toonMaterial(0xb2b6be, { tint: 'neutral' }), 0, 0.43, 0))
  cab.add(box(0.44, 0.5, 0.02, new MeshBasicMaterial({ color: 0xd8d2c4, toneMapped: false }), 0, 0.52, 0.18))
  group.add(cab)
  const cab2 = new Group()
  cab2.position.set(7.75, 0.075, 1.9)
  cab2.add(box(0.4, 0.7, 0.3, toonMaterial(0xb2b6be, { tint: 'neutral' }), 0, 0.35, 0))
  cab2.add(box(0.34, 0.28, 0.02, wetMaterial(0x5a606a, 0.5, 0.4), 0, 0.42, 0.16))
  group.add(cab2)

  // banners hung on the utility poles
  const bannerTex = makeTexture(128, 384, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 384)
    g.addColorStop(0, '#e8e3d6')
    g.addColorStop(1, '#cfc8b6')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 384)
    ctx.fillStyle = '#8a3a34'
    ctx.fillRect(0, 0, 128, 20)
    ctx.fillStyle = '#2f3d62'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '900 52px "Noto Sans CJK JP",sans-serif'
    ;['星', '宮', '二', '丁', '目', '祭'].forEach((c, i) => ctx.fillText(c, 64, 52 + i * 50))
    ctx.fillStyle = '#8a3a34'
    ctx.font = '700 18px "Trebuchet MS",Arial'
    ctx.fillText('AUTUMN', 64, 358)
  })
  for (const bx of [-2.6, 6.6]) {
    const b = plane(0.34, 1.0, new MeshBasicMaterial({ map: bannerTex, toneMapped: false, side: 2 }), bx, 2.5, 2.24)
    group.add(b)
    group.add(box(0.36, 0.02, 0.02, metal, bx, 3.02, 2.24))
  }

  // two street trees on the south pavement break up the long empty walk
  const leaf = toonMaterial(0x37543c, { tint: 'cool' })
  const trunkMat = toonMaterial(0x4a3a2c, { tint: 'warm' })
  for (const [tx, tz, s0] of [
    [-1.9, 9.3, 1.0],
    [4.6, 9.2, 1.15],
  ] as const) {
    const tg = new Group()
    tg.position.set(tx, 0.075, tz)
    tg.scale.setScalar(s0)
    tg.add(cylinder(0.09, 0.12, 2.0, 8, trunkMat, 0, 1.0, 0))
    tg.add(box(1.1, 0.12, 0.7, toonMaterial(0x6d665a, { tint: 'neutral' }), 0, 0.06, 0))
    for (let i = 0; i < 4; i++) {
      const r = 1.05 - i * 0.18
      const ball = sphere(r, leaf, 0, 2.2 + i * 0.5, 0, 10)
      ball.scale.y = 0.8
      tg.add(ball)
    }
    group.add(tg)
  }
  // hedge + low wall closing the small lot between the laundry and the izakaya
  const hedge = toonMaterial(0x2f4a37, { tint: 'cool' })
  for (let i = 0; i < 12; i++) group.add(box(0.58, 0.5, 0.5, hedge, -4.9 + i * 0.6, 0.33, 10.35))
  group.add(box(7.2, 0.44, 0.12, toonMaterial(0x6d665a, { tint: 'neutral' }), -1.0, 0.22, 10.62))

  return { group, passingCar: passing.group, passingWheels: passing.wheels, cats, vendingLights }
}
