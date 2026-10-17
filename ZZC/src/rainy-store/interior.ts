/** The bright heart of the model: shelving, drink wall, bento case, oden,
 *  register, coffee machine, magazines and every warm little light indoors. */
import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three'
import { PRODUCT_COLORS, STORE } from './palette'
import {
  bannerTexture,
  box,
  clockTexture,
  cylinder,
  decalTexture,
  interiorFloorTexture,
  magazineTexture,
  posterTexture,
  screenTexture,
  sphere,
  toonMaterial,
  wetMaterial,
} from './toon'

const warmToon = (color: number) => toonMaterial(color, { tint: 'warm' })
const shelfMat = warmToon(0xd9d3c2)
const shelfEdge = wetMaterial(0x8d97a8, 0.35, 0.5)
const glow = (color: number) => new MeshBasicMaterial({ color, toneMapped: false })

export function buildInterior(): Group {
  const g = new Group()
  const floorY = STORE.floorY

  // ---------------------------------------------------------------- floor
  const floorMat = new MeshStandardMaterial({
    map: interiorFloorTexture(3),
    color: 0xffe9c9,
    roughness: 0.36,
    metalness: 0.32,
    envMapIntensity: 0.7,
  })
  const floor = new Mesh(new PlaneGeometry(4.58, 3.36), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(-0.3, floorY, -1.5)
  floor.receiveShadow = true
  g.add(floor)
  g.add(box(4.58, 0.12, 0.03, wetMaterial(0x4a4f5c, 0.4, 0.4), -0.3, 0.16, 0.275))
  g.add(box(0.03, 0.12, 3.3, wetMaterial(0x4a4f5c, 0.4, 0.4), -2.58, 0.16, -1.5))

  // ---------------------------------------------------------------- ceiling lightboxes
  for (const z of [-0.95, -1.85, -2.75]) {
    const panel = new Mesh(new PlaneGeometry(3.1, 0.3), glow(0xfff3dc))
    panel.rotation.x = Math.PI / 2
    panel.position.set(-0.55, 2.888, z)
    g.add(panel)
    g.add(box(3.2, 0.05, 0.36, warmToon(0xcfc8b6), -0.55, 2.912, z))
  }

  // ---------------------------------------------------------------- drink fridge (back wall)
  const fridgeX0 = -2.58
  const fridgeX1 = 0.86
  const fridgeZ = -3.18
  const fridge = new Group()
  fridge.add(box(fridgeX1 - fridgeX0, 2.18, 0.06, warmToon(0xf1e6cf), (fridgeX0 + fridgeX1) / 2, floorY + 1.09, fridgeZ + 0.07))
  fridge.add(box(fridgeX1 - fridgeX0 + 0.08, 2.24, 0.22, warmToon(0xe5dcc6), (fridgeX0 + fridgeX1) / 2, floorY + 1.1, fridgeZ))
  const inner = glow(0xfff7e6)
  const backPanel = new Mesh(new PlaneGeometry(fridgeX1 - fridgeX0 - 0.08, 2.05), inner)
  backPanel.position.set((fridgeX0 + fridgeX1) / 2, floorY + 1.12, fridgeZ + 0.2)
  fridge.add(backPanel)
  const colors = [0x4aa3df, 0xff7f50, 0x6fcf74, 0xf4d35e, 0xd45d9b, 0x7c6bd4, 0xf0f0f0, 0x9fd8ff]
  for (let door = 0; door < 3; door++) {
    const dx = fridgeX0 + 0.14 + door * 1.12
    for (let row = 0; row < 4; row++) {
      const y = floorY + 0.38 + row * 0.5
      fridge.add(box(1.06, 0.035, 0.34, shelfEdge, dx + 0.5, y, fridgeZ + 0.24))
      for (let b = 0; b < 7; b++) {
        const color = colors[(door * 3 + row * 2 + b) % colors.length]
        const bottle = cylinder(0.036, 0.034, 0.2, 8, warmToon(color), dx + 0.1 + b * 0.14, y + 0.12, fridgeZ + 0.24)
        fridge.add(bottle)
        fridge.add(box(0.06, 0.05, 0.055, glow(0xffffff), dx + 0.1 + b * 0.14, y + 0.1, fridgeZ + 0.24))
      }
      const strip = new Mesh(new PlaneGeometry(1.06, 0.03), glow(0xffe7b8))
      strip.rotation.x = Math.PI / 2
      strip.position.set(dx + 0.5, y - 0.02, fridgeZ + 0.2)
      fridge.add(strip)
    }
    // glass door + frame + handle
    fridge.add(box(1.1, 2.06, 0.03, new MeshStandardMaterial({ color: 0xa9d8e8, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.4 }), dx + 0.5, floorY + 1.1, fridgeZ + 0.42))
    fridge.add(box(0.035, 2.1, 0.05, shelfEdge, dx - 0.02, floorY + 1.1, fridgeZ + 0.42))
    fridge.add(box(0.035, 2.1, 0.05, shelfEdge, dx + 1.02, floorY + 1.1, fridgeZ + 0.42))
    fridge.add(box(1.08, 0.04, 0.05, shelfEdge, dx + 0.5, floorY + 0.06, fridgeZ + 0.42))
    fridge.add(box(1.08, 0.04, 0.05, shelfEdge, dx + 0.5, floorY + 2.14, fridgeZ + 0.42))
    fridge.add(box(0.03, 0.5, 0.03, shelfEdge, dx + 0.9, floorY + 1.2, fridgeZ + 0.46))
  }
  // price rail along the bottom of the drink wall
  fridge.add(box(fridgeX1 - fridgeX0, 0.08, 0.04, glow(0xfff0cf), (fridgeX0 + fridgeX1) / 2, floorY + 0.16, fridgeZ + 0.45))
  g.add(fridge)

  // ---------------------------------------------------------------- back wall posters + clock
  for (let i = 0; i < 3; i++) {
    const poster = new Mesh(new PlaneGeometry(0.5, 0.62), new MeshBasicMaterial({ map: posterTexture(i + 1), toneMapped: false }))
    poster.position.set(-1.6 + i * 0.72, 2.44, -3.27)
    g.add(poster)
  }
  const clock = new Mesh(new CircleGeometry(0.16, 24), new MeshBasicMaterial({ map: clockTexture() }))
  clock.position.set(0.5, 2.44, -3.26)
  g.add(clock)
  g.add(box(0.34, 0.34, 0.03, warmToon(0xe6dfcc), 0.5, 2.44, -3.28))

  // ---------------------------------------------------------------- staff door + exit sign
  const staff = box(0.74, 2.05, 0.05, wetMaterial(0x4c5260, 0.45, 0.4), 1.35, floorY + 1.03, -3.27)
  g.add(staff)
  g.add(box(0.05, 0.45, 0.04, shelfEdge, 1.62, floorY + 1.05, -3.23))
  const exit = new Mesh(new PlaneGeometry(0.34, 0.14), glow(0x62e0a0))
  exit.position.set(1.35, 2.32, -3.25)
  g.add(exit)
  g.add(box(0.38, 0.19, 0.03, warmToon(0x2f4a3d), 1.35, 2.32, -3.26))

  // ---------------------------------------------------------------- gondola shelves
  function gondola(cx: number, cz: number, length: number, height: number) {
    const unit = new Group()
    const w = 0.52
    unit.add(box(w, 0.06, length, shelfEdge, cx, floorY + 0.03, cz))
    unit.add(box(w, height, 0.04, shelfMat, cx, floorY + height / 2, cz - length / 2))
    unit.add(box(w, height, 0.04, shelfMat, cx, floorY + height / 2, cz + length / 2))
    unit.add(box(0.04, height, length, shelfMat, cx - w / 2 + 0.02, floorY + height / 2, cz))
    unit.add(box(0.04, height, length, shelfMat, cx + w / 2 - 0.02, floorY + height / 2, cz))
    const levels = 4
    for (let l = 1; l <= levels; l++) {
      const y = floorY + (height / (levels + 1)) * l
      unit.add(box(w - 0.05, 0.025, length - 0.05, shelfMat, cx, y, cz))
      unit.add(box(w - 0.02, 0.05, length - 0.05, glow(0xfff1d4), cx, y - 0.04, cz))
      for (const side of [-1, 1]) {
        const n = Math.floor((length - 0.12) / 0.115)
        for (let i = 0; i < n; i++) {
          const color = PRODUCT_COLORS[(i * 3 + l + (side > 0 ? 5 : 0)) % PRODUCT_COLORS.length]
          const z = cz - length / 2 + 0.09 + i * 0.115
          const kind = (i + l) % 5
          if (kind === 0) {
            unit.add(box(0.07, 0.13, 0.08, warmToon(color), cx + side * 0.16, y + 0.08, z))
          } else if (kind === 1) {
            unit.add(cylinder(0.04, 0.04, 0.15, 8, warmToon(color), cx + side * 0.16, y + 0.09, z))
          } else if (kind === 2) {
            unit.add(box(0.09, 0.05, 0.09, warmToon(color), cx + side * 0.16, y + 0.04, z))
            unit.add(box(0.09, 0.04, 0.09, warmToon(0xf3ead4), cx + side * 0.16, y + 0.09, z))
          } else if (kind === 3) {
            unit.add(cylinder(0.045, 0.045, 0.11, 8, warmToon(color), cx + side * 0.16, y + 0.07, z))
            unit.add(cylinder(0.048, 0.048, 0.02, 8, warmToon(0xf6f0dd), cx + side * 0.16, y + 0.13, z))
          } else {
            unit.add(box(0.1, 0.02, 0.09, warmToon(color), cx + side * 0.16, y + 0.02, z))
          }
        }
      }
      // little price tags
      unit.add(box(0.02, 0.03, 0.8, glow(0xfff8e6), cx + (l % 2 ? w / 2 : -w / 2), y + 0.01, cz))
    }
    // header strip on top
    unit.add(box(w + 0.02, 0.14, length + 0.02, glow(0xffe3ad), cx, floorY + height + 0.06, cz))
    // POP poster on the aisle-facing end cap so the end never reads as a blank slab
    const pop = new Mesh(
      new PlaneGeometry(w - 0.1, 0.5),
      new MeshBasicMaterial({ map: posterTexture(cz < -1.7 ? 1 : 2), toneMapped: false }),
    )
    pop.position.set(cx, floorY + 0.82, cz + length / 2 + 0.025)
    unit.add(pop)
    return unit
  }
  g.add(gondola(-0.95, -1.6, 1.75, 1.38))
  g.add(gondola(0.05, -1.6, 1.75, 1.38))

  // ---------------------------------------------------------------- magazine rack (front window, left)
  const mags = new Group()
  mags.add(box(0.85, 0.7, 0.62, shelfMat, -2.12, floorY + 0.35, -0.24))
  for (let i = 0; i < 3; i++) {
    const strip = new Mesh(new PlaneGeometry(0.78, 0.16), new MeshBasicMaterial({ map: magazineTexture(i % 2), toneMapped: false }))
    strip.position.set(-2.12, floorY + 0.32 + i * 0.16, 0.07 + i * 0.045)
    strip.rotation.x = -0.24
    mags.add(strip)
    mags.add(box(0.82, 0.02, 0.1, shelfEdge, -2.12, floorY + 0.23 + i * 0.16, 0.1 + i * 0.045))
  }
  mags.add(box(0.88, 0.03, 0.64, glow(0xfff1d0), -2.12, floorY + 0.72, -0.24))
  g.add(mags)

  // ---------------------------------------------------------------- register counter (west wall)
  const counter = new Group()
  const cx = -2.34
  counter.add(box(0.58, 0.92, 1.32, warmToon(0xe9e1cd), cx, floorY + 0.46, -1.22))
  counter.add(box(0.62, 0.05, 1.36, wetMaterial(0x8a6b4f, 0.3, 0.25), cx, floorY + 0.94, -1.22))
  counter.add(box(0.6, 0.1, 1.34, shelfEdge, cx, floorY + 0.08, -1.22))
  // cash drawer / register body
  counter.add(box(0.34, 0.16, 0.42, wetMaterial(0x3a3f4b, 0.4, 0.4), cx + 0.06, floorY + 1.04, -1.35))
  counter.add(box(0.34, 0.04, 0.3, wetMaterial(0x9aa0ac, 0.3, 0.6), cx + 0.06, floorY + 1.12, -1.35))
  // POS monitor
  counter.add(box(0.05, 0.22, 0.05, wetMaterial(0x2f333d, 0.35, 0.5), cx + 0.06, floorY + 1.2, -1.35))
  const pos = new Mesh(new PlaneGeometry(0.3, 0.24), new MeshBasicMaterial({ map: screenTexture('pos'), toneMapped: false }))
  pos.position.set(cx + 0.04, floorY + 1.3, -1.35)
  pos.rotation.y = Math.PI / 2
  counter.add(pos)
  counter.add(box(0.03, 0.26, 0.34, wetMaterial(0x1f232b, 0.4, 0.4), cx + 0.06, floorY + 1.28, -1.35))
  // card terminal + receipt printer
  counter.add(box(0.14, 0.06, 0.2, wetMaterial(0x2c313b, 0.4, 0.3), cx + 0.1, floorY + 1.02, -1.0))
  counter.add(box(0.16, 0.12, 0.24, wetMaterial(0xd7d2c4, 0.5, 0.2), cx + 0.08, floorY + 1.06, -1.62))
  counter.add(box(0.1, 0.02, 0.2, glow(0x9ff0c8), cx + 0.08, floorY + 1.12, -1.62))
  // small basket stack
  for (let i = 0; i < 3; i++) counter.add(box(0.3, 0.06, 0.22, warmToon(0xd94f6a), cx - 0.12, floorY + 1.0 + i * 0.07, -0.75))

  // oden pot at the front end of the counter
  const oden = new Group()
  oden.add(box(0.44, 0.16, 0.34, wetMaterial(0xb9bec9, 0.35, 0.6), 0, 0.08, 0))
  for (let i = 0; i < 6; i++) {
    oden.add(cylinder(0.065, 0.06, 0.1, 12, wetMaterial(0x8f96a2, 0.3, 0.5), -0.14 + (i % 3) * 0.14, 0.13, -0.07 + Math.floor(i / 3) * 0.14))
    oden.add(cylinder(0.05, 0.05, 0.03, 10, warmToon(0xd9a24a), -0.14 + (i % 3) * 0.14, 0.19, -0.07 + Math.floor(i / 3) * 0.14))
  }
  oden.add(box(0.46, 0.03, 0.36, new MeshStandardMaterial({ color: 0xdfe9ee, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.4 }), 0, 0.24, 0))
  oden.position.set(cx + 0.08, floorY + 0.96, -0.62)
  counter.add(oden)
  // hot snack warmer on the counter
  counter.add(box(0.34, 0.26, 0.3, new MeshStandardMaterial({ color: 0xd8b26a, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.5 }), cx + 0.06, floorY + 1.1, -1.9))
  for (let i = 0; i < 3; i++) counter.add(sphere(0.05, warmToon(0xc9782f), cx + 0.06, floorY + 1.03, -1.98 + i * 0.08, 8))
  g.add(counter)

  // cigarette wall rack
  const rack = new Group()
  rack.add(box(0.06, 1.2, 1.35, warmToon(0xe4dcc8), -2.64, floorY + 1.72, -1.3))
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 8; col++) {
      const color = PRODUCT_COLORS[(row * 8 + col) % PRODUCT_COLORS.length]
      rack.add(box(0.05, 0.1, 0.09, warmToon(color), -2.6, floorY + 1.22 + row * 0.17, -1.9 + col * 0.16))
    }
    rack.add(box(0.06, 0.02, 1.3, shelfEdge, -2.59, floorY + 1.18 + row * 0.17, -1.3))
  }
  rack.add(box(0.02, 1.15, 1.3, new MeshStandardMaterial({ color: 0xd7ecf5, transparent: true, opacity: 0.18, roughness: 0.05 }), -2.55, floorY + 1.75, -1.3))
  rack.add(box(0.04, 0.2, 1.32, glow(0xfff0cc), -2.58, floorY + 2.28, -1.3))
  g.add(rack)

  // ---------------------------------------------------------------- open bento case (east wall)
  const bento = new Group()
  bento.add(box(0.3, 0.5, 1.05, warmToon(0xece4d1), 1.88, floorY + 0.25, -2.2))
  bento.add(box(0.32, 0.05, 1.07, glow(0xffeecf), 1.88, floorY + 0.52, -2.2))
  for (let row = 0; row < 3; row++) {
    const y = floorY + 0.52 + row * 0.3
    bento.add(box(0.28, 0.025, 1.0, shelfEdge, 1.88, y, -2.2))
    for (let i = 0; i < 4; i++) {
      const z = -2.6 + i * 0.24
      bento.add(box(0.2, 0.06, 0.2, warmToon(0x2f2a22), 1.88, y + 0.04, z))
      bento.add(box(0.17, 0.035, 0.17, warmToon([0xe6a35a, 0xc94a3a, 0xe8d9a8, 0x8fae5a][(i + row) % 4]), 1.88, y + 0.075, z))
    }
    bento.add(box(0.02, 0.028, 0.98, glow(0xfff5e2), 1.75, y - 0.01, -2.2))
  }
  bento.add(box(0.28, 0.05, 1.05, warmToon(0xd8ceb8), 1.88, floorY + 1.44, -2.2))
  bento.add(box(0.3, 0.16, 1.05, glow(0xffe2ac), 1.88, floorY + 1.36, -2.2))
  g.add(bento)

  // ---------------------------------------------------------------- ice cream freezer
  const ice = new Group()
  ice.add(box(0.8, 0.78, 0.58, warmToon(0xe8eef2), 0.95, floorY + 0.39, -2.45))
  ice.add(box(0.78, 0.06, 0.52, glow(0xcfe9ff), 0.95, floorY + 0.8, -2.45))
  for (let i = 0; i < 4; i++) ice.add(box(0.14, 0.05, 0.2, warmToon(PRODUCT_COLORS[i + 3]), 0.95 - 0.24 + (i % 2) * 0.42, floorY + 0.86, -2.55 + Math.floor(i / 2) * 0.22))
  ice.add(box(0.82, 0.02, 0.56, new MeshStandardMaterial({ color: 0xbfe0f5, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3 }), 0.95, floorY + 0.91, -2.45))
  g.add(ice)

  // ---------------------------------------------------------------- ATM (east wall)
  const atm = new Group()
  atm.add(box(0.36, 1.55, 0.55, warmToon(0xd6d9db), 1.88, floorY + 0.78, -1.32))
  atm.add(box(0.06, 0.9, 0.5, warmToon(0x9aa2a8), 1.69, floorY + 0.9, -1.32))
  const screen = new Mesh(new PlaneGeometry(0.32, 0.3), new MeshBasicMaterial({ map: screenTexture('atm'), toneMapped: false }))
  screen.position.set(1.69, floorY + 1.22, -1.32)
  screen.rotation.y = -Math.PI / 2
  atm.add(screen)
  atm.add(box(0.03, 0.2, 0.36, wetMaterial(0x4c525e, 0.35, 0.4), 1.67, floorY + 0.92, -1.32))
  atm.add(box(0.04, 0.08, 0.2, glow(0x8fe0b0), 1.66, floorY + 1.62, -1.32))
  g.add(atm)

  // ---------------------------------------------------------------- coffee corner (east wall)
  const coffee = new Group()
  coffee.add(box(0.4, 0.9, 0.95, warmToon(0xdad3c1), 1.86, floorY + 0.45, -0.75))
  coffee.add(box(0.42, 0.04, 0.97, wetMaterial(0x6f5844, 0.3, 0.25), 1.86, floorY + 0.92, -0.75))
  // machine
  coffee.add(box(0.3, 0.55, 0.42, warmToon(0xb8443a), 1.84, floorY + 1.24, -0.92))
  coffee.add(box(0.26, 0.2, 0.02, glow(0x40201c), 1.84, floorY + 1.2, -0.7))
  coffee.add(box(0.12, 0.1, 0.06, wetMaterial(0x2b2f38, 0.4, 0.4), 1.84, floorY + 1.12, -0.66))
  coffee.add(box(0.22, 0.03, 0.3, glow(0xff9c6b), 1.84, floorY + 1.44, -0.92))
  for (let i = 0; i < 3; i++) coffee.add(cylinder(0.026, 0.026, 0.05, 8, warmToon(0xf3ece0), 1.74 + i * 0.05, floorY + 0.97, -0.52))
  coffee.add(box(0.3, 0.06, 0.02, glow(0x8fe0b0), 1.84, floorY + 1.53, -0.92))
  g.add(coffee)

  // ---------------------------------------------------------------- hot snack case (near the door)
  const hot = new Group()
  hot.add(box(0.52, 0.72, 0.42, warmToon(0xc7a15c), 1.15, floorY + 0.36, -0.24))
  for (let i = 0; i < 4; i++) hot.add(sphere(0.055, warmToon(0xc9822f), 1.02 + (i % 2) * 0.2, floorY + 0.78, -0.34 + Math.floor(i / 2) * 0.16, 8))
  hot.add(box(0.52, 0.02, 0.42, glow(0xffd79a), 1.15, floorY + 0.72, -0.24))
  hot.add(box(0.46, 0.34, 0.34, new MeshStandardMaterial({ color: 0xe4c78f, transparent: true, opacity: 0.34, roughness: 0.06, metalness: 0.45 }), 1.15, floorY + 0.94, -0.24))
  g.add(hot)

  // ---------------------------------------------------------------- hanging banners
  for (const [x, z] of [[-1.35, -0.42], [0.35, -0.42]] as const) {
    const banner = new Mesh(new PlaneGeometry(0.56, 0.7), new MeshBasicMaterial({ map: bannerTexture(), toneMapped: false, side: DoubleSide }))
    banner.position.set(x, 2.12, z)
    g.add(banner)
    g.add(box(0.58, 0.02, 0.02, shelfEdge, x, 2.49, z))
    g.add(box(0.52, 0.02, 0.02, shelfEdge, x, 1.76, z))
  }

  // ---------------------------------------------------------------- floor decals + mat
  const decalMat = new MeshBasicMaterial({ map: decalTexture(), transparent: true, toneMapped: false, depthWrite: false })
  for (const [x, z, rot] of [[0.55, -1.15, 0], [0.7, -2.35, 0.1]] as const) {
    const d = new Mesh(new PlaneGeometry(0.42, 1.05), decalMat)
    d.rotation.x = -Math.PI / 2
    d.rotation.z = rot
    d.position.set(x, floorY + 0.004, z)
    g.add(d)
  }
  const inMat = new Mesh(new PlaneGeometry(1.3, 0.6), new MeshStandardMaterial({ color: 0x36414c, roughness: 0.7 }))
  inMat.rotation.x = -Math.PI / 2
  inMat.position.set(0.3, floorY + 0.003, -0.12)
  g.add(inMat)
  // wet footprints
  const printMat = new MeshBasicMaterial({ color: 0x2c3540, transparent: true, opacity: 0.28, depthWrite: false })
  for (let i = 0; i < 5; i++) {
    const p = new Mesh(new CircleGeometry(0.055, 8), printMat)
    p.rotation.x = -Math.PI / 2
    p.scale.set(0.7, 1.5, 1)
    p.position.set(0.34 + (i % 2 ? 0.12 : -0.02), floorY + 0.005, -0.28 - i * 0.22)
    g.add(p)
  }

  // ---------------------------------------------------------------- snack display under the window
  const front = new Group()
  front.add(box(0.95, 0.66, 0.5, warmToon(0xe4dbc6), -2.12, floorY + 0.33, -0.9))
  for (let row = 0; row < 2; row++) {
    front.add(box(0.9, 0.02, 0.46, shelfEdge, -2.12, floorY + 0.4 + row * 0.26, -0.9))
    for (let i = 0; i < 6; i++) {
      front.add(sphere(0.04, warmToon(PRODUCT_COLORS[(i + row) % PRODUCT_COLORS.length]), -2.46 + i * 0.14, floorY + 0.05 + row * 0.26 + 0.42, -1.05, 8))
    }
  }
  g.add(front)

  // onigiri near the window
  for (let i = 0; i < 4; i++) {
    const rice = sphere(0.055, warmToon(0xf6f1e2), -2.45 + i * 0.13, floorY + 0.44, -0.6, 8)
    rice.scale.set(0.9, 1.25, 0.8)
    g.add(rice)
    g.add(box(0.07, 0.045, 0.02, warmToon(0x27352c), -2.45 + i * 0.13, floorY + 0.415, -0.56))
  }

  // interior light spill strip above the window (a bright interior valance)
  const valance = new Mesh(new PlaneGeometry(4.4, 0.1), glow(0xfff0d4))
  valance.position.set(-0.3, 2.72, 0.2)
  valance.rotation.y = Math.PI
  g.add(valance)

  return g
}
