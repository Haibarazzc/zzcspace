/** Konbini shell: walls, storefront glass, auto sliding door, awning, sign
 *  bands, blade sign, roof clutter and all the warm interior light sources. */
import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  AdditiveBlending,
  PointLight,
  RepeatWrapping,
  SpotLight,
  Vector3,
} from 'three'
import { COL, STORE } from './palette'
import {
  addOutline,
  bladeTexture,
  box,
  cylinder,
  dropletTexture,
  glassMaterial,
  glowMaterial,
  makeTexture,
  plane,
  signTexture,
  signWideTexture,
  glowTexture,
  streakTexture,
  toonMaterial,
  wetMaterial,
} from './toon'

export interface StoreParts {
  group: Group
  doorLeft: Group
  doorRight: Group
  signMats: MeshBasicMaterial[]
  rainMats: MeshBasicMaterial[]
  flickerLights: PointLight[]
}

const alu = wetMaterial(0x8d97a8, 0.32, 0.72)
const darkAlu = wetMaterial(0x333846, 0.4, 0.55)
const shell = toonMaterial(COL.cream, { tint: 'neutral' })
const concrete = toonMaterial(COL.concrete)
const glass = glassMaterial(COL.glass, 0.05)
const rainTex = (() => {
  const t = dropletTexture()
  t.wrapS = RepeatWrapping
  t.wrapT = RepeatWrapping
  t.repeat.set(3.6, 2.4)
  return t
})()

function glassRain(w: number, h: number): Mesh {
  const mat = new MeshBasicMaterial({
    color: 0xbcd8f0,
    alphaMap: rainTex,
    transparent: true,
    opacity: 0.17,
    depthWrite: false,
    side: DoubleSide,
  })
  return plane(w, h, mat)
}

function pane(w: number, h: number, x: number, y: number, z: number, ry = 0): Mesh {
  const m = plane(w, h, glass, x, y, z, 0, ry)
  m.castShadow = false
  return m
}

function mullion(x: number, z: number, h: number) {
  return box(0.075, h, 0.11, alu, x, 0.18 + h / 2, z)
}

function doorPanel(width: number): Group {
  const p = new Group()
  p.add(box(width, 0.05, 0.045, alu, 0, 2.37, 0))
  p.add(box(width, 0.09, 0.05, darkAlu, 0, 0.06, 0))
  p.add(box(0.05, 2.32, 0.045, alu, -width / 2 + 0.025, 1.2, 0))
  p.add(box(0.05, 2.32, 0.045, alu, width / 2 - 0.025, 1.2, 0))
  const glassPlane = pane(width - 0.1, 2.2, 0, 1.24, 0)
  p.add(glassPlane)
  const rain = glassRain(width - 0.1, 2.2)
  rain.position.set(0, 1.24, 0.03)
  p.add(rain)
  // door handle + opening sticker
  p.add(box(0.035, 0.5, 0.03, alu, width / 2 - 0.12, 1.15, 0.04))
  const sticker = plane(0.16, 0.24, new MeshBasicMaterial({ color: 0x2f8f6d }), width / 2 - 0.09, 1.02, 0.035)
  sticker.rotation.y = Math.PI
  p.add(sticker)
  return p
}

function acUnit(x: number, z: number, rot: number): Group {
  const g = new Group()
  g.position.set(x, 3.64, z)
  g.rotation.y = rot
  const body = box(0.86, 0.62, 0.5, toonMaterial(0xb8b3a4, { tint: 'neutral' }), 0, 0.31, 0)
  g.add(body)
  g.add(addOutline(body, 0.009))
  g.add(cylinder(0.21, 0.21, 0.03, 18, wetMaterial(0x1c2028, 0.5, 0.6), 0, 0.34, 0.26).rotateX(Math.PI / 2))
  for (let i = 0; i < 4; i++) {
    const blade = box(0.34, 0.02, 0.05, wetMaterial(0x555b66, 0.5, 0.5), 0, 0.34, 0.28)
    blade.rotation.z = (i / 4) * Math.PI
    g.add(blade)
  }
  g.add(box(0.5, 0.05, 0.04, wetMaterial(0xc9c4b5, 0.4, 0.2), 0, 0.06, 0.26))
  return g
}

export function buildStore(): StoreParts {
  const group = new Group()
  const signMats: MeshBasicMaterial[] = []
  const rainMats: MeshBasicMaterial[] = []

  // ------------------------------------------------------------ structure
  group.add(box(0.14, 3.5, 3.6, concrete, -2.77, 1.85, -1.5)) // west wall
  group.add(box(4.94, 3.5, 0.14, shell, -0.3, 1.85, -3.37)) // back wall
  group.add(box(0.14, 3.5, 1.8, shell, 2.17, 1.85, -2.4)) // east wall, solid part
  group.add(box(0.14, 3.5, 0.12, shell, 2.17, 1.85, 0.24)) // east corner column
  group.add(box(4.8, 0.82, 0.16, shell, -0.3, 3.09, 0.38)) // fascia behind the sign

  // tiled plinth
  const plinthMat = wetMaterial(0x3b3f4b, 0.45, 0.35)
  group.add(box(4.96, 0.26, 0.1, plinthMat, -0.3, 0.13, 0.36))
  group.add(box(0.1, 0.26, 3.62, plinthMat, 2.245, 0.13, -1.5))

  // ------------------------------------------------------------ storefront
  const frontColumns = [-2.7, STORE.doorX0, STORE.doorX1, 2.1]
  for (const x of frontColumns) group.add(box(0.1, 2.68, 0.12, alu, x, 1.44, 0.36))
  group.add(box(4.8, 0.1, 0.14, darkAlu, -0.3, 0.15, 0.36)) // sill
  group.add(box(4.8, 0.09, 0.14, alu, -0.3, 2.775, 0.36)) // head rail
  group.add(box(1.24, 0.09, 0.14, alu, 0.3, 2.525, 0.36)) // door header
  group.add(mullion(-1.51, 0.36, 2.56))
  group.add(mullion(1.505, 0.36, 2.56))

  const panes: [number, number, number][] = [
    [1.03, -2.1, 1.48],
    [1.06, -0.94, 1.48],
    [1.0, 1.5, 1.48],
  ]
  for (const [w, x, y] of panes) group.add(pane(w, 2.56, x, y, 0.36))
  // transom above the sliding door
  group.add(pane(1.12, 0.24, 0.3, 2.66, 0.36))

  // east-facing glass wall
  group.add(box(0.12, 0.1, 1.68, darkAlu, 2.1, 0.15, -0.66))
  group.add(box(0.12, 0.09, 1.68, alu, 2.1, 2.775, -0.66))
  group.add(box(0.12, 2.6, 0.07, alu, 2.1, 1.46, -0.66))
  group.add(pane(1.66, 2.56, 2.1, 1.48, -0.66, Math.PI / 2))
  const eastRain = glassRain(1.66, 2.56)
  eastRain.position.set(2.13, 1.48, -0.66)
  eastRain.rotation.y = Math.PI / 2
  group.add(eastRain)
  rainMats.push((eastRain.material as MeshBasicMaterial))

  // droplets on the fixed front panes
  const frontRain = glassRain(4.66, 2.56)
  frontRain.position.set(-0.3, 1.48, 0.374)
  group.add(frontRain)
  rainMats.push(frontRain.material as MeshBasicMaterial)

  // painted sheen bands so the glass reads as wet even without a specular lobe
  const sheenTex = streakTexture()
  const sheen = (w: number, h: number, x: number, y: number, z: number, ry: number, rz: number, opacity: number) => {
    const m = new MeshBasicMaterial({
      color: 0xcfe4ff,
      map: sheenTex,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    return plane(w, h, m, x, y, z, 0, ry, rz)
  }
  group.add(sheen(1.9, 2.5, -1.72, 1.5, 0.377, 0, 0.2, 0.085))
  group.add(sheen(1.1, 2.4, 1.28, 1.45, 0.377, 0, -0.26, 0.06))
  group.add(sheen(1.3, 2.4, 2.115, 1.5, -0.8, Math.PI / 2, 0.22, 0.07))

  // warm bloom card just behind the glass: the shop must glow from far away
  const glowMat = new MeshBasicMaterial({
    map: glowTexture(),
    color: 0xffbe86,
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  })
  group.add(plane(5.4, 2.7, glowMat, -0.3, 1.45, 0.33))
  group.add(plane(3.4, 2.7, glowMat, 2.02, 1.45, -0.66, 0, Math.PI / 2))

  // ------------------------------------------------------------ sliding door
  const doorLeft = doorPanel(0.6)
  doorLeft.position.set(-0.02, STORE.floorY, 0.41)
  const doorRight = doorPanel(0.6)
  doorRight.position.set(0.62, STORE.floorY, 0.41)
  group.add(doorLeft, doorRight)
  for (const d of [doorLeft, doorRight]) {
    const child = d.children.find((c) => c instanceof Mesh && c.material instanceof MeshBasicMaterial && (c.material as MeshBasicMaterial).alphaMap)
    if (child) rainMats.push((child as Mesh).material as MeshBasicMaterial)
  }
  doorLeft.userData.closedX = -0.02
  doorLeft.userData.openX = -0.63
  doorRight.userData.closedX = 0.62
  doorRight.userData.openX = 1.23

  // threshold strip + mat
  group.add(box(1.3, 0.03, 0.2, wetMaterial(0x6c7280, 0.3, 0.6), 0.3, 0.09, 0.46))
  const mat = plane(1.45, 0.72, new MeshBasicMaterial({ map: makeTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#2b2e39'
    ctx.fillRect(0, 0, 512, 256)
    ctx.strokeStyle = '#454a5a'
    ctx.lineWidth = 8
    ctx.strokeRect(14, 14, 484, 228)
    ctx.fillStyle = '#d8d2c2'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '800 58px "Trebuchet MS",Arial,sans-serif'
    ctx.fillText('WELCOME', 256, 104)
    ctx.font = '700 32px "Noto Sans CJK JP",sans-serif'
    ctx.fillStyle = '#c9b98d'
    ctx.fillText('いらっしゃいませ', 256, 174)
  }), toneMapped: false }), 0.3, 0.078, 0.95, -Math.PI / 2)
  group.add(mat)

  // ------------------------------------------------------------ awning
  const awningTex = makeTexture(256, 64, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#efe6d2' : '#158066'
      ctx.fillRect(i * 32, 0, 32, 64)
    }
  }, [3, 1])
  const awning = box(1.9, 0.035, 0.9, toonMaterial(0xffffff, { map: awningTex }), 0.3, 2.66, 0.72)
  awning.rotation.x = 0.2
  group.add(awning)
  group.add(addOutline(awning, 0.008))
  const valance = plane(1.9, 0.2, new MeshBasicMaterial({ map: awningTex, side: DoubleSide }), 0.3, 2.53, 1.16)
  group.add(valance)
  // awning support arms
  group.add(box(0.035, 0.035, 0.86, alu, -0.5, 2.66, 0.7).rotateX(0.2))
  group.add(box(0.035, 0.035, 0.86, alu, 1.1, 2.66, 0.7).rotateX(0.2))

  // ------------------------------------------------------------ signage
  const frontSignMat = new MeshBasicMaterial({ map: signTexture(), toneMapped: false })
  const eastSignMat = new MeshBasicMaterial({ map: signWideTexture(), toneMapped: false })
  signMats.push(frontSignMat, eastSignMat)
  group.add(box(4.98, 0.7, 0.1, new MeshStandardMaterial({ color: 0xece6d6, roughness: 0.5 }), -0.3, 3.16, 0.42))
  group.add(plane(4.98, 0.7, frontSignMat, -0.3, 3.16, 0.472))
  group.add(box(0.09, 0.7, 3.95, new MeshStandardMaterial({ color: 0xece6d6, roughness: 0.5 }), 2.25, 3.16, -1.45))
  const eastSign = plane(3.95, 0.7, eastSignMat, 2.297, 3.16, -1.45, 0, Math.PI / 2)
  group.add(eastSign)
  // thin warm light strip under the sign
  group.add(box(4.9, 0.03, 0.03, new MeshBasicMaterial({ color: 0x9a7a58, toneMapped: false }), -0.3, 2.8, 0.44))

  // corner blade sign (24H)
  const bladeMat = new MeshBasicMaterial({ map: bladeTexture(), toneMapped: false, side: DoubleSide })
  signMats.push(bladeMat)
  const blade = plane(0.42, 0.63, bladeMat, 2.36, 2.45, 0.6)
  group.add(blade)
  group.add(box(0.3, 0.035, 0.035, alu, 2.28, 2.79, 0.46))
  group.add(box(0.035, 0.7, 0.035, alu, 2.2, 2.45, 0.6))

  // ------------------------------------------------------------ roof
  const roofMat = wetMaterial(0x565b68, 0.42, 0.3)
  const roof = box(4.96, 0.14, 3.72, roofMat, -0.3, 3.57, -1.5)
  group.add(roof)
  const parapetMat = toonMaterial(0x8f8b7e, { tint: 'neutral' })
  group.add(box(4.96, 0.26, 0.12, parapetMat, -0.3, 3.77, -3.36))
  group.add(box(0.12, 0.26, 3.72, parapetMat, -2.72, 3.77, -1.5))
  group.add(box(0.12, 0.26, 3.72, parapetMat, 2.12, 3.77, -1.5))
  group.add(box(4.96, 0.26, 0.12, parapetMat, -0.3, 3.77, 0.3))
  group.add(acUnit(-1.35, -2.4, 0))
  group.add(acUnit(0.7, -2.7, 0))
  const vent = cylinder(0.07, 0.07, 0.9, 10, wetMaterial(0x7a8190, 0.4, 0.5), 1.75, 4.0, -2.95)
  group.add(vent)
  const ventCap = cylinder(0.12, 0.12, 0.06, 10, wetMaterial(0x5a6070, 0.4, 0.5), 1.75, 4.47, -2.95)
  group.add(ventCap)
  // antenna mast
  const mast = cylinder(0.025, 0.03, 1.7, 8, wetMaterial(0x9aa0ac, 0.35, 0.7), -2.0, 4.5, -2.6)
  group.add(mast)
  for (const [y, w] of [[4.6, 0.7], [4.95, 0.55], [5.25, 0.4]]) {
    group.add(box(w, 0.025, 0.025, wetMaterial(0x9aa0ac, 0.35, 0.7), -2.0, y, -2.6))
  }

  // ------------------------------------------------------------ wall details
  const pipeMat = wetMaterial(0x8b909c, 0.4, 0.55)
  const downPipe = cylinder(0.055, 0.055, 3.3, 10, pipeMat, -2.9, 1.75, 0.22)
  group.add(downPipe)
  group.add(cylinder(0.07, 0.07, 0.1, 10, pipeMat, -2.9, 3.42, 0.22))
  // vent grilles on the alley wall
  for (const y of [1.1, 2.3]) {
    const grille = box(0.04, 0.34, 0.62, new MeshStandardMaterial({ color: 0x3d424e, roughness: 0.6, metalness: 0.4 }), -2.87, y, -1.2)
    group.add(grille)
    for (let i = 0; i < 5; i++) group.add(box(0.02, 0.018, 0.56, wetMaterial(0x6c7280, 0.5, 0.4), -2.895, y - 0.12 + i * 0.06, -1.2))
  }
  // meter box
  group.add(box(0.14, 0.42, 0.3, wetMaterial(0x9a9483, 0.55, 0.2), -2.9, 1.85, 0.05))
  // staff door on the back wall
  group.add(box(0.86, 2.02, 0.07, wetMaterial(0x4a4f5c, 0.45, 0.45), 1.2, 1.11, -3.46))
  group.add(box(0.05, 0.5, 0.05, alu, 1.56, 1.15, -3.42))
  const staffSign = plane(0.5, 0.16, new MeshBasicMaterial({ map: makeTexture(256, 82, (ctx) => {
    ctx.fillStyle = '#d9c47a'
    ctx.fillRect(0, 0, 256, 82)
    ctx.fillStyle = '#2f2a1c'
    ctx.font = '700 30px "Noto Sans CJK JP",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('関係者以外 立入禁止', 128, 42)
  }) }), 1.2, 2.2, -3.452)
  staffSign.rotation.y = Math.PI
  group.add(staffSign)
  // alley wall lamp
  group.add(box(0.2, 0.2, 0.24, wetMaterial(0x3f4450, 0.4, 0.5), -2.92, 2.32, 0.05))
  group.add(box(0.06, 0.14, 0.18, new MeshBasicMaterial({ color: 0xffd79a, toneMapped: false }), -3.0, 2.3, 0.05))

  // ------------------------------------------------------------ ceiling
  const ceiling = box(4.58, 0.06, 3.36, toonMaterial(0xdcd6c6, { tint: 'warm' }), -0.3, 2.93, -1.5)
  ceiling.castShadow = false
  group.add(ceiling)

  // ------------------------------------------------------------ interior lights
  const lights: PointLight[] = []
  const addPoint = (x: number, y: number, z: number, color: number, intensity: number, distance: number) => {
    const l = new PointLight(color, intensity, distance, 2)
    l.position.set(x, y, z)
    group.add(l)
    lights.push(l)
    return l
  }
  addPoint(-1.2, 2.55, -0.8, 0xffd2a0, 15, 6.5)
  addPoint(0.9, 2.5, -1.9, 0xffd9ae, 12.5, 6.5)
  addPoint(-1.5, 2.2, -2.6, 0xfff0d0, 6, 4)
  addPoint(1.6, 1.9, -0.9, 0xfff4e2, 2.2, 3.5)
  addPoint(0.3, 2.15, -0.55, 0xffd9a0, 3, 2.6)

  const spots: SpotLight[] = []
  const addSpot = (x: number, targetX: number) => {
    const s = new SpotLight(0xffd6a0, 9.5, 8, 0.9, 0.75, 2)
    s.position.set(x, 2.62, 0.2)
    const t = new Vector3(targetX, 0, 3.1)
    s.target.position.copy(t)
    group.add(s, s.target)
    spots.push(s)
  }
  addSpot(-1.5, -1.9)
  addSpot(0.6, 0.9)

  // small warm spill under the awning
  addPoint(0.3, 2.4, 1.2, 0xffc98a, 1.4, 3.2)
  // alley wall lamp light
  const alley = new PointLight(0xffcf9a, 2, 4, 2)
  alley.position.set(-3.0, 2.2, 0.1)
  group.add(alley)
  lights.push(alley)

  // flickering strip under the sign
  const flicker = new PointLight(0xffe6c0, 1.2, 2.6, 2)
  flicker.position.set(-0.3, 2.72, 0.85)
  group.add(flicker)

  // corner trims catch the neon a little
  const trimMat = wetMaterial(0xcfd6e2, 0.3, 0.6)
  group.add(box(0.06, 3.45, 0.06, trimMat, -2.69, 1.83, 0.36))
  group.add(box(0.06, 3.45, 0.06, trimMat, 2.09, 1.83, 0.36))

  // east wall poster
  const eastPoster = plane(0.7, 0.95, new MeshBasicMaterial({ map: makeTexture(256, 384, (ctx) => {
    ctx.fillStyle = '#0d6b56'
    ctx.fillRect(0, 0, 256, 384)
    ctx.fillStyle = '#f6f1e2'
    ctx.fillRect(14, 14, 228, 356)
    ctx.fillStyle = '#d9731f'
    ctx.font = '900 96px "Noto Sans CJK JP",sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('¥110', 128, 170)
    ctx.fillStyle = '#16453a'
    ctx.font = '700 44px "Noto Sans CJK JP",sans-serif'
    ctx.fillText('おにぎり', 128, 250)
    ctx.font = '600 24px "Noto Sans CJK JP",sans-serif'
    ctx.fillStyle = '#5c8b7a'
    ctx.fillText('ほしぞらマート', 128, 320)
  }) }), 2.247, 1.35, 0.6, 0, Math.PI / 2)
  group.add(eastPoster)

  // ---- east (storeroom) wall: plinth, downpipe, vent, lit side window
  const eastWallX = 2.1
  const tileMat = toonMaterial(0x4a5468)
  for (let i = 0; i < 4; i++) {
    group.add(box(0.03, 0.5, 0.44, tileMat, eastWallX + 0.015, 0.25, -3.1 + i * 0.44))
  }
  group.add(cylinder(0.055, 0.055, 3.1, 8, wetMaterial(0x6f7a8c, 0.34, 0.6), eastWallX + 0.07, 1.6, -3.18))
  group.add(box(0.06, 0.5, 0.06, wetMaterial(0x6f7a8c, 0.34, 0.6), eastWallX + 0.07, 0.35, -3.12))
  const ventMat = new MeshStandardMaterial({ color: 0x1b2130, roughness: 0.6, metalness: 0.3 })
  const grille = plane(0.46, 0.3, ventMat, eastWallX + 0.02, 2.62, -2.15, 0, Math.PI / 2)
  group.add(grille)
  for (let i = 0; i < 4; i++) {
    group.add(box(0.02, 0.02, 0.42, alu, eastWallX + 0.03, 2.53 + i * 0.06, -2.15))
  }
  // frosted storeroom window with a warm tube behind it
  group.add(box(0.06, 0.62, 0.72, alu, eastWallX + 0.03, 1.72, -2.62))
  const sideWin = plane(0.6, 0.5, glowMaterial(0xffe0ab, 0.55), eastWallX + 0.071, 1.72, -2.62, 0, Math.PI / 2)
  group.add(sideWin)
  for (let i = 0; i < 3; i++) {
    group.add(box(0.02, 0.5, 0.02, alu, eastWallX + 0.08, 1.72, -2.82 + i * 0.2))
  }
  group.add(plane(0.34, 0.42, new MeshBasicMaterial({ map: makeTexture(128, 160, (ctx) => {
    ctx.fillStyle = '#20303f'
    ctx.fillRect(0, 0, 128, 160)
    ctx.fillStyle = '#cfe6d2'
    ctx.fillRect(10, 10, 108, 62)
    ctx.fillStyle = '#1c4a38'
    ctx.font = '900 26px "Noto Sans CJK JP",sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('防犯', 64, 55)
    ctx.fillStyle = '#f0f4f8'
    ctx.font = '700 13px "Noto Sans CJK JP",sans-serif'
    ctx.fillText('カメラ作動中', 64, 100)
    ctx.fillStyle = '#d8a13c'
    ctx.font = '900 22px "Noto Sans CJK JP",sans-serif'
    ctx.fillText('24H', 64, 136)
  }), toneMapped: false }), eastWallX + 0.02, 1.15, -2.1, 0, Math.PI / 2))

  return {
    group,
    doorLeft,
    doorRight,
    signMats,
    rainMats,
    flickerLights: [flicker, ...lights.slice(0, 1)],
  }
}
