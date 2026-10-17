/** The rest of the block: a two-storey apartment, the warehouse behind it,
 *  the neighbour house, the little ramen shop across the side street, the
 *  coin laundry and izakaya on the far pavement, the shrine pocket, the back
 *  lot and the coin-parking corner. */
import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  PointLight,
  Vector3,
  type Texture,
} from 'three'
import {
  FONT_JP,
  FONT_LATIN,
  TINTS,
  box,
  cylinder,
  drawText,
  makeTexture,
  plane,
  roofTileTexture,
  roundRect,
  sphere,
  toonMaterial,
  wetMaterial,
} from './toon'

export interface BlocksParts {
  group: Group
  /** window / sign materials whose brightness cycles through the night */
  windowMats: MeshBasicMaterial[]
  /** points where steam keeps puffing (ramen pot, vents) */
  steamSpots: Vector3[]
  /** warm lantern materials that flicker slightly */
  lanternMats: MeshBasicMaterial[]
  /** parked-car slots for streetlife (x, z, rotation) */
  parkingSpots: { x: number; z: number; rot: number }[]
}

const corrugated = makeTexture(256, 256, (ctx) => {
  ctx.fillStyle = '#7f8794'
  ctx.fillRect(0, 0, 256, 256)
  for (let x = 0; x < 256; x += 16) {
    const g = ctx.createLinearGradient(x, 0, x + 16, 0)
    g.addColorStop(0, 'rgba(255,255,255,0.16)')
    g.addColorStop(0.45, 'rgba(20,24,32,0.28)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.08)')
    g.addColorStop(1, 'rgba(20,24,32,0.3)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, 16, 256)
  }
  ctx.fillStyle = 'rgba(40,46,58,0.5)'
  for (let y = 0; y < 256; y += 128) ctx.fillRect(0, y, 256, 3)
}, [3, 1.4])

const wallPaper = makeTexture(256, 256, (ctx) => {
  ctx.fillStyle = '#b9b2a4'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(90,84,76,${0.03 + Math.random() * 0.05})`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 22, 1 + Math.random() * 2)
  }
  ctx.fillStyle = 'rgba(70,66,62,0.16)'
  for (let y = 0; y < 256; y += 64) ctx.fillRect(0, y, 256, 2)
}, [2, 1])

function toonMap(color: number, map: Texture, tint: 'cool' | 'warm' | 'neutral' = 'cool') {
  return new MeshToonMaterial({ color, map, gradientMap: TINTS[tint] })
}

const windowMats: MeshBasicMaterial[] = []

/* ------------------------------------------------------------------ windows */

/** hand-painted lit window; kind picks the interior silhouette */
function litWindow(w: number, h: number, kind: number, cool = false): Mesh {
  const tex = makeTexture(256, 256, (ctx) => {
    const warm = ['#ffd18a', '#ffdca6', '#ffe7c2', '#ffc078']
    const coolCol = ['#8fd4dd', '#a9c9ff', '#c6e2ff', '#7fb6d8']
    const top = cool ? coolCol[kind % 4] : warm[kind % 4]
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, top)
    g.addColorStop(1, cool ? '#4a7898' : '#d08a4c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    // frame
    ctx.strokeStyle = 'rgba(48,38,30,0.55)'
    ctx.lineWidth = 14
    ctx.strokeRect(7, 7, 242, 242)
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(128, 7)
    ctx.lineTo(128, 249)
    ctx.moveTo(7, 128)
    ctx.lineTo(249, 128)
    ctx.stroke()
    if (kind % 4 === 0) {
      // curtains + lamp
      ctx.fillStyle = 'rgba(150,70,64,0.6)'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(110, 120, 44, 256)
      ctx.lineTo(0, 256)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(256, 0)
      ctx.quadraticCurveTo(150, 130, 214, 256)
      ctx.lineTo(256, 256)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(80,54,36,0.5)'
      ctx.fillRect(96, 196, 76, 8)
      ctx.fillRect(108, 150, 10, 48)
      ctx.beginPath()
      ctx.arc(113, 142, 18, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,250,225,0.85)'
      ctx.beginPath()
      ctx.arc(113, 142, 11, 0, Math.PI * 2)
      ctx.fill()
    } else if (kind % 4 === 1) {
      // blinds + shelf
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      for (let y = 0; y < 110; y += 12) ctx.fillRect(0, y, 256, 6)
      ctx.fillStyle = 'rgba(70,50,36,0.45)'
      ctx.fillRect(30, 168, 196, 10)
      ctx.fillRect(30, 210, 196, 10)
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = `rgba(${90 + i * 22},${70 + i * 14},${60 + i * 10},0.5)`
        ctx.fillRect(38 + i * 38, 178, 24, 30)
        ctx.fillRect(38 + i * 38, 220, 24, 30)
      }
    } else if (kind % 4 === 2) {
      // tatami room with low table
      ctx.fillStyle = 'rgba(214,186,138,0.45)'
      ctx.fillRect(20, 150, 216, 96)
      ctx.fillStyle = 'rgba(66,52,40,0.55)'
      ctx.fillRect(76, 196, 104, 10)
      ctx.fillRect(84, 206, 8, 34)
      ctx.fillRect(164, 206, 8, 34)
      ctx.fillStyle = 'rgba(255,245,220,0.9)'
      ctx.fillRect(190, 60, 26, 40)
    } else {
      // shoji lattice
      ctx.fillStyle = 'rgba(60,44,32,0.5)'
      for (let x = 20; x < 240; x += 32) ctx.fillRect(x, 0, 4, 256)
      for (let y = 20; y < 240; y += 32) ctx.fillRect(0, y, 256, 4)
      ctx.fillStyle = 'rgba(255,220,170,0.3)'
      ctx.fillRect(0, 0, 256, 256)
    }
    // rain droplets on the outer pane
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.22})`
      ctx.beginPath()
      ctx.ellipse(Math.random() * 256, Math.random() * 256, 1.5, 3 + Math.random() * 4, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  const mat = new MeshBasicMaterial({ map: tex, toneMapped: false })
  return plane(w, h, mat, 0, 0, 0)
}

function windowAt(
  parent: Group,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  face: 'z' | '-z' | 'x' | '-x',
  kind = 0,
  cool = false,
): Mesh {
  const m = litWindow(w, h, kind, cool)
  const mat = m.material
  if (mat instanceof MeshBasicMaterial) windowMats.push(mat)
  if (face === 'z') m.position.set(x, y, z)
  else if (face === '-z') {
    m.position.set(x, y, z)
    m.rotation.y = Math.PI
  } else if (face === 'x') {
    m.position.set(x, y, z)
    m.rotation.y = Math.PI / 2
  } else {
    m.position.set(x, y, z)
    m.rotation.y = -Math.PI / 2
  }
  parent.add(m)
  return m
}

function frame(parent: Group, w: number, h: number, d: number, x: number, y: number, z: number, color = 0x2f333c) {
  parent.add(box(w, d, h, toonMaterial(color, { tint: 'neutral' }), x, y, z))
}

/* ------------------------------------------------------------------ pieces */

function signTexture(text: string, sub: string, bg: string, fg: string, glow = false): CanvasTexture {
  return makeTexture(512, 160, (ctx) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, 512, 160)
    if (glow) {
      const g = ctx.createLinearGradient(0, 0, 0, 160)
      g.addColorStop(0, 'rgba(255,255,255,0.22)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 512, 160)
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(0, 150, 512, 10)
    drawText(ctx, text, 256, 70, 74, fg, { align: 'center', font: FONT_JP, weight: '900' })
    if (sub) drawText(ctx, sub, 256, 126, 22, fg, { align: 'center', font: FONT_LATIN, weight: '700', tracking: 2 })
  })
}

function signBoard(parent: Group, w: number, h: number, text: string, sub: string, bg: string, fg: string, x: number, y: number, z: number, face: 'z' | '-z' | 'x' | '-x', glow = true) {
  const mat = new MeshBasicMaterial({ map: signTexture(text, sub, bg, fg, glow), toneMapped: false })
  const m = plane(w, h, mat, x, y, z)
  if (face === '-z') m.rotation.y = Math.PI
  else if (face === 'x') m.rotation.y = Math.PI / 2
  else if (face === '-x') m.rotation.y = -Math.PI / 2
  parent.add(m)
  return m
}

function acUnit(parent: Group, x: number, y: number, z: number, face: 'x' | '-x' | 'z' | '-z' = 'z', scale = 1) {
  const g = new Group()
  g.position.set(x, y, z)
  g.scale.setScalar(scale)
  if (face === '-x') g.rotation.y = -Math.PI / 2
  else if (face === 'x') g.rotation.y = Math.PI / 2
  else if (face === '-z') g.rotation.y = Math.PI
  g.add(box(0.62, 0.46, 0.3, toonMaterial(0xbab4a6, { tint: 'neutral' }), 0, 0.23, 0))
  g.add(box(0.66, 0.05, 0.34, wetMaterial(0x3a3f49, 0.5, 0.4), 0, 0.48, 0))
  const fan = cylinder(0.16, 0.16, 0.02, 14, wetMaterial(0x2c313b, 0.5, 0.4), -0.13, 0.24, 0.16)
  fan.rotation.x = Math.PI / 2
  g.add(fan)
  g.add(box(0.06, 0.28, 0.06, wetMaterial(0x3d424c, 0.5, 0.4), 0.26, 0.14, 0.1))
  parent.add(g)
}

function downpipe(parent: Group, x: number, z: number, h: number) {
  parent.add(cylinder(0.045, 0.045, h, 8, wetMaterial(0x4a4f59, 0.5, 0.35), x, h / 2, z))
  for (let i = 0; i < Math.floor(h / 1.4); i++) {
    parent.add(box(0.1, 0.05, 0.1, wetMaterial(0x3d424c, 0.5, 0.4), x, 0.8 + i * 1.4, z))
  }
  parent.add(cylinder(0.06, 0.05, 0.3, 8, wetMaterial(0x3d424c, 0.5, 0.35), x, 0.16, z + 0.1).rotateX(0.6))
}

/* ------------------------------------------------------------------ apartment */

function apartment(): Group {
  const g = new Group()
  const cx = -7.125
  const cz = -1.82
  const w = 3.55
  const d = 3.75
  const body = box(w, 5.4, d, toonMap(0xcfc8b8, wallPaper), cx, 2.7, cz)
  g.add(body)
  // dark tiled plinth + floor bands
  g.add(box(w + 0.06, 0.5, d + 0.06, toonMaterial(0x5d5a56, { tint: 'neutral' }), cx, 0.25, cz))
  g.add(box(w + 0.05, 0.12, d + 0.05, toonMaterial(0x8f8b82, { tint: 'neutral' }), cx, 2.62, cz))
  // roof + parapet + tank
  g.add(box(w + 0.2, 0.16, d + 0.2, toonMaterial(0x6f6b64, { tint: 'neutral' }), cx, 5.48, cz))
  for (const [px, pz, pw, pd] of [
    [cx, cz + d / 2 + 0.07, w + 0.2, 0.14],
    [cx, cz - d / 2 - 0.07, w + 0.2, 0.14],
    [cx + w / 2 + 0.07, cz, 0.14, d + 0.2],
    [cx - w / 2 - 0.07, cz, 0.14, d + 0.2],
  ] as const) {
    g.add(box(pw, 0.34, pd, toonMaterial(0xa39d92, { tint: 'neutral' }), px, 5.72, pz))
  }
  const tank = cylinder(0.5, 0.5, 0.92, 14, toonMaterial(0xc7cbd2, { tint: 'neutral' }), cx - 0.9, 6.2, cz - 0.8)
  g.add(tank)
  g.add(box(0.06, 1.0, 0.06, wetMaterial(0x43484f, 0.5, 0.4), cx - 0.9, 5.5, cz - 1.28))
  g.add(box(0.06, 1.0, 0.06, wetMaterial(0x43484f, 0.5, 0.4), cx - 0.9, 5.5, cz - 0.32))
  g.add(cylinder(0.16, 0.16, 0.3, 12, wetMaterial(0x5f6672, 0.5, 0.4), cx + 1.05, 5.65, cz - 1.2))
  // antenna mast
  g.add(cylinder(0.02, 0.03, 1.8, 6, wetMaterial(0x5a606a, 0.5, 0.4), cx + 1.3, 6.5, cz - 0.2))
  g.add(box(0.9, 0.02, 0.02, wetMaterial(0x5a606a, 0.5, 0.4), cx + 1.3, 7.1, cz - 0.2))

  // ---- external corridor on the south face
  const corZ = cz + d / 2
  g.add(box(w, 0.14, 0.78, toonMaterial(0x9d978b, { tint: 'neutral' }), cx, 2.58, corZ + 0.39))
  g.add(box(w, 0.05, 0.05, wetMaterial(0x3c414b, 0.45, 0.4), cx, 3.32, corZ + 0.75))
  g.add(box(w, 0.04, 0.04, wetMaterial(0x3c414b, 0.45, 0.4), cx, 3.02, corZ + 0.75))
  for (let i = 0; i <= 6; i++) {
    g.add(box(0.05, 0.8, 0.05, wetMaterial(0x3c414b, 0.45, 0.4), cx - w / 2 + 0.05 + i * (w - 0.1) / 6, 2.98, corZ + 0.75))
  }
  // upper doors + windows + name plates
  const doorX = [cx - 1.28, cx - 0.36, cx + 0.56, cx + 1.28]
  doorX.forEach((dx, i) => {
    g.add(box(0.62, 1.9, 0.06, toonMaterial(i % 2 ? 0x8d8578 : 0x9b9285, { tint: 'warm' }), dx, 3.6, corZ + 0.03))
    g.add(box(0.08, 0.08, 0.05, new MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }), dx + 0.22, 3.62, corZ + 0.07))
    g.add(plane(0.2, 0.11, new MeshBasicMaterial({ map: namePlate(i), toneMapped: false }), dx - 0.2, 3.9, corZ + 0.075))
    windowAt(g, 0.72, 0.66, dx + 0.02, 4.6, corZ + 0.02, 'z', i, i === 1)
  })
  // ground floor: two doors + windows
  g.add(box(0.7, 2.0, 0.06, toonMaterial(0x6f6355, { tint: 'warm' }), cx - 1.05, 1.05, corZ + 0.03))
  g.add(box(0.08, 0.08, 0.05, new MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }), cx - 0.75, 1.05, corZ + 0.07))
  g.add(box(0.4, 0.22, 0.1, new MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.5, metalness: 0.5 }), cx - 1.32, 1.5, corZ + 0.1))
  windowAt(g, 1.0, 0.8, cx + 0.55, 1.62, corZ + 0.02, 'z', 2, false)
  windowAt(g, 0.9, 0.7, cx + 1.3, 0.95, corZ + 0.02, 'z', 3, false)
  // stair up to the corridor at the west end
  const stairX = cx - w / 2 + 0.55
  for (let i = 0; i < 9; i++) {
    g.add(box(0.86, 0.07, 0.16, wetMaterial(0x8d929c, 0.5, 0.25), stairX, 0.22 + i * 0.27, corZ + 0.1 + i * 0.075))
  }
  g.add(box(0.05, 1.1, 0.78, wetMaterial(0x3c414b, 0.45, 0.4), stairX - 0.45, 1.6, corZ + 0.42))
  g.add(box(0.05, 0.05, 0.8, wetMaterial(0x3c414b, 0.45, 0.4), stairX - 0.45, 2.16, corZ + 0.42))

  // laundry poles with washing on the corridor
  for (let i = 0; i < 2; i++) {
    const px = cx - 0.85 + i * 1.5
    g.add(cylinder(0.02, 0.02, 0.9, 6, wetMaterial(0x6f737c, 0.5, 0.4), px, 3.7, corZ + 0.62).rotateZ(Math.PI / 2))
    const clothCols = [0xf2e6d2, 0x9fb8cc, 0xd6b3a6]
    for (let j = 0; j < 3; j++) {
      g.add(plane(0.2, 0.42, new MeshStandardMaterial({ color: clothCols[j], roughness: 0.9, side: 2 }), px - 0.3 + j * 0.3, 3.42, corZ + 0.62))
    }
  }
  // AC units + meters + pipes on the front
  acUnit(g, cx + 1.55, 2.66, corZ + 0.2, 'z', 0.9)
  acUnit(g, cx - 1.5, 0.12, corZ + 0.2, 'z', 0.9)
  g.add(box(0.3, 0.42, 0.14, toonMaterial(0xc4c0b6, { tint: 'neutral' }), cx + 1.62, 1.5, corZ + 0.1))
  g.add(box(0.05, 0.5, 0.05, wetMaterial(0x40454f, 0.5, 0.4), cx + 1.62, 1.5, corZ + 0.16))
  // post boxes + nameboard by the ground doors
  g.add(box(0.5, 0.34, 0.16, wetMaterial(0x6a707c, 0.45, 0.5), cx + 0.02, 1.28, corZ + 0.13))
  for (let i = 0; i < 3; i++) g.add(plane(0.12, 0.08, new MeshBasicMaterial({ map: namePlate(i + 1), toneMapped: false }), cx - 0.12 + i * 0.15, 1.3, corZ + 0.215))
  // downpipes on both corners
  downpipe(g, cx - w / 2 + 0.06, corZ + 0.05, 5.3)
  downpipe(g, cx + w / 2 - 0.06, cz - d / 2 - 0.03, 5.3)
  // security light over the stair
  g.add(box(0.16, 0.1, 0.12, wetMaterial(0x3d424c, 0.4, 0.5), stairX + 0.1, 3.0, corZ + 0.12))
  const lampMat = new MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })
  g.add(box(0.12, 0.04, 0.08, lampMat, stairX + 0.1, 2.95, corZ + 0.14))
  const light = new PointLight(0xffcf94, 2.4, 5, 2)
  light.position.set(stairX + 0.2, 2.7, corZ + 0.7)
  g.add(light)
  // bicycles parked under the stairs
  const bike = parkedBike(0x4c6f8a)
  bike.position.set(cx - 1.5, 0.075, corZ + 0.75)
  bike.rotation.y = -0.2
  g.add(bike)
  return g
}

function namePlate(seed: number): CanvasTexture {
  const names = ['佐藤', '中村', '小林', 'ハイツ星', '2号室', '管理人']
  return makeTexture(128, 64, (ctx) => {
    ctx.fillStyle = '#efe9dc'
    ctx.fillRect(0, 0, 128, 64)
    ctx.strokeStyle = '#8b7f6a'
    ctx.lineWidth = 3
    ctx.strokeRect(2, 2, 124, 60)
    drawText(ctx, names[seed % names.length], 64, 38, 28, '#3b342a', { align: 'center', font: FONT_JP, weight: '700' })
  })
}

/* ------------------------------------------------------------------ warehouse */

function warehouse(): Group {
  const g = new Group()
  const cx = -7.8
  const cz = -7.8
  const w = 5.0
  const d = 5.2
  g.add(box(w, 6.0, d, toonMap(0xb9bec8, corrugated), cx, 3.0, cz))
  g.add(box(w + 0.12, 0.3, d + 0.12, toonMaterial(0x707580, { tint: 'neutral' }), cx, 0.15, cz))
  // roof + vents + rails
  g.add(box(w + 0.2, 0.16, d + 0.2, toonMaterial(0x666b76, { tint: 'neutral' }), cx, 6.06, cz))
  for (const [vx, vz] of [
    [cx - 1.4, cz - 1.2],
    [cx + 1.2, cz + 1.1],
  ] as const) {
    g.add(cylinder(0.22, 0.26, 0.5, 10, wetMaterial(0x5c6270, 0.5, 0.4), vx, 6.36, vz))
    g.add(cylinder(0.3, 0.3, 0.08, 10, wetMaterial(0x3d424c, 0.5, 0.4), vx, 6.6, vz))
  }
  // roller shutter + dock ramp on the lane side
  const sz = cz + d / 2 + 0.03
  g.add(box(2.7, 2.6, 0.1, toonMaterial(0x9aa0ab, { tint: 'neutral' }), cx + 0.4, 1.35, sz))
  for (let i = 0; i < 13; i++) g.add(box(2.6, 0.05, 0.04, toonMaterial(0x8b919c, { tint: 'neutral' }), cx + 0.4, 0.2 + i * 0.19, sz + 0.06))
  g.add(box(2.9, 0.22, 0.22, wetMaterial(0x494e58, 0.5, 0.4), cx + 0.4, 2.78, sz + 0.04))
  g.add(box(3.0, 0.12, 0.9, toonMaterial(0x7d7f84, { tint: 'neutral' }), cx + 0.4, 0.07, sz + 0.45))
  signBoard(g, 1.5, 0.34, '荷捌き場', 'DELIVERY 2', '#e8e3d6', '#3b4048', cx + 0.4, 2.2, sz + 0.08, 'z', false)
  // small lit office window
  windowAt(g, 0.7, 0.55, cx - 1.75, 2.2, sz, 'z', 1, true)
  // security lamp + camera
  g.add(box(0.2, 0.12, 0.16, wetMaterial(0x3d424c, 0.4, 0.5), cx + 1.9, 3.2, sz + 0.1))
  g.add(box(0.16, 0.05, 0.1, new MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false }), cx + 1.9, 3.14, sz + 0.13))
  const light = new PointLight(0xfff0c8, 3.2, 6, 2)
  light.position.set(cx + 1.9, 3.0, sz + 1.1)
  g.add(light)
  // ladder + downpipe + junction boxes
  const lx = cx - w / 2 + 0.3
  g.add(box(0.05, 6.0, 0.05, wetMaterial(0x5a606a, 0.5, 0.4), lx, 3.0, sz + 0.12))
  g.add(box(0.05, 6.0, 0.05, wetMaterial(0x5a606a, 0.5, 0.4), lx + 0.34, 3.0, sz + 0.12))
  for (let i = 0; i < 16; i++) g.add(box(0.36, 0.03, 0.03, wetMaterial(0x5a606a, 0.5, 0.4), lx + 0.17, 0.5 + i * 0.36, sz + 0.12))
  downpipe(g, cx + w / 2 - 0.15, sz + 0.02, 6.0)
  g.add(box(0.36, 0.5, 0.16, toonMaterial(0xb8bcc4, { tint: 'neutral' }), cx - 2.2, 1.4, sz + 0.08))
  // ---- west face (this is what the diorama sees when it is spun around)
  const wx = cx - w / 2 - 0.03
  signBoard(g, 2.4, 0.66, '星宮運輸', 'HOSHIMIYA LOGISTICS', '#e6e2d8', '#2b3038', wx, 4.4, cz + 0.6, '-x', false)
  windowAt(g, 0.5, 0.5, wx, 2.9, cz - 1.5, '-x', 2, true)
  g.add(box(0.14, 0.1, 0.16, wetMaterial(0x3d424c, 0.4, 0.5), wx - 0.06, 3.6, cz + 1.9))
  g.add(box(0.06, 0.05, 0.12, new MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false }), wx - 0.12, 3.55, cz + 1.9))
  for (let i = 0; i < 3; i++) g.add(box(0.06, 6.0, 0.06, wetMaterial(0x7a808a, 0.5, 0.4), wx - 0.02, 3.0, cz - 2.0 + i * 0.22))
  // roof floodlight bar
  g.add(box(1.0, 0.1, 0.16, wetMaterial(0x3d424c, 0.4, 0.5), cx + 1.0, 6.18, sz - 0.2))
  g.add(box(0.9, 0.04, 0.12, new MeshBasicMaterial({ color: 0xffe6bb, toneMapped: false }), cx + 1.0, 6.12, sz - 0.2))
  return g
}

/* ------------------------------------------------------------------ house */

function house2(): Group {
  const g = new Group()
  const cx = -3.25
  const cz = -7.45
  const w = 3.3
  const d = 4.5
  g.add(box(w, 5.0, d, toonMap(0xd0c6b2, wallPaper), cx, 2.5, cz))
  g.add(box(w + 0.08, 0.4, d + 0.08, toonMaterial(0x6c665c, { tint: 'neutral' }), cx, 0.2, cz))
  // gable roof, ridge along x
  const roofMat = new MeshStandardMaterial({ map: roofTileTexture(), roughness: 0.55, metalness: 0.25 })
  g.add(box(w + 0.7, 0.1, d / 2 + 0.4, roofMat, cx, 5.32, cz + d / 4).rotateX(0.3))
  g.add(box(w + 0.7, 0.1, d / 2 + 0.4, roofMat, cx, 5.32, cz - d / 4).rotateX(-0.3))
  g.add(box(w + 0.8, 0.1, 0.16, wetMaterial(0x3d424c, 0.5, 0.3), cx, 5.62, cz))
  // front (south) windows + door
  const fz = cz + d / 2 + 0.02
  g.add(box(0.7, 2.0, 0.06, toonMaterial(0x4b3a2a, { tint: 'warm' }), cx - 0.9, 1.05, fz))
  g.add(box(0.06, 0.06, 0.06, new MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false }), cx - 0.62, 1.05, fz + 0.05))
  g.add(box(0.9, 0.08, 0.42, wetMaterial(0x3a3f49, 0.5, 0.4), cx - 0.9, 2.12, fz + 0.2))
  windowAt(g, 0.95, 0.75, cx + 0.72, 1.55, fz, 'z', 0, false)
  windowAt(g, 1.0, 0.8, cx - 0.7, 3.9, fz, 'z', 2, false)
  windowAt(g, 0.8, 0.8, cx + 0.77, 3.9, fz, 'z', 1, false)
  // balcony rail on the upper floor
  g.add(box(2.0, 0.05, 0.4, toonMaterial(0x8d8578, { tint: 'neutral' }), cx + 0.3, 3.42, fz + 0.2))
  for (let i = 0; i < 6; i++) g.add(box(0.035, 0.62, 0.035, wetMaterial(0x4a4f59, 0.5, 0.4), cx - 0.6 + i * 0.36, 3.75, fz + 0.38))
  g.add(box(2.0, 0.045, 0.045, wetMaterial(0x4a4f59, 0.5, 0.4), cx + 0.3, 4.04, fz + 0.38))
  // garden wall + hedge + gate + path
  g.add(box(w + 0.2, 0.55, 0.12, toonMaterial(0x7d7466, { tint: 'neutral' }), cx, 0.28, fz + 1.35))
  g.add(box(0.55, 1.5, 0.06, wetMaterial(0x3d3a34, 0.5, 0.3), cx - 0.9, 0.85, fz + 1.4))
  const hedge = toonMaterial(0x3c5c43, { tint: 'cool' })
  for (let i = 0; i < 4; i++) g.add(box(0.55, 0.6, 0.5, hedge, cx + 0.2 + i * 0.62, 0.42, fz + 1.75))
  g.add(plane(0.9, 1.4, toonMaterial(0x5c5a56, { tint: 'neutral' }), cx - 0.9, 0.078, fz + 1.0, -Math.PI / 2))
  // AC, pipes, meter, small light
  acUnit(g, cx + 1.4, 2.4, fz + 0.05, 'z', 0.95)
  downpipe(g, cx - w / 2 + 0.08, fz + 0.05, 4.9)
  downpipe(g, cx + w / 2 - 0.06, cz - d / 2 - 0.02, 4.9)
  g.add(box(0.28, 0.4, 0.12, toonMaterial(0xc4c0b6, { tint: 'neutral' }), cx + 1.45, 1.3, fz + 0.06))
  // door lamp
  g.add(box(0.14, 0.09, 0.1, wetMaterial(0x3d424c, 0.4, 0.5), cx - 0.9, 2.2, fz + 0.12))
  g.add(box(0.1, 0.03, 0.06, new MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }), cx - 0.9, 2.16, fz + 0.14))
  const light = new PointLight(0xffcf94, 1.8, 4, 2)
  light.position.set(cx - 0.9, 2.1, fz + 0.6)
  g.add(light)
  // potted plants + bike
  for (let i = 0; i < 3; i++) {
    g.add(cylinder(0.1, 0.12, 0.2, 10, toonMaterial(0x9a6a4a), cx + 0.1 + i * 0.26, 0.1, fz + 0.55))
    g.add(sphere(0.14, toonMaterial(0x416a48), cx + 0.1 + i * 0.26, 0.32, fz + 0.55, 8))
  }
  return g
}

/* ------------------------------------------------------------------ ramen shop */

function ramenShop(): { group: Group; lanternMat: MeshBasicMaterial; steam: Vector3 } {
  const g = new Group()
  const cx = 9.9
  const cz = -8.5
  const w = 2.0
  const d = 4.9
  g.add(box(w, 5.6, d, toonMap(0xbfb6a4, wallPaper), cx, 2.8, cz))
  g.add(box(w + 0.06, 0.34, d + 0.06, toonMaterial(0x5f584c, { tint: 'neutral' }), cx, 0.17, cz))
  g.add(box(w + 0.2, 0.16, d + 0.2, toonMaterial(0x6f6b64, { tint: 'neutral' }), cx, 5.66, cz))
  for (const [px, pz, pw, pd] of [
    [cx, cz + d / 2 + 0.06, w + 0.2, 0.12],
    [cx, cz - d / 2 - 0.06, w + 0.2, 0.12],
  ] as const) {
    g.add(box(pw, 0.3, pd, toonMaterial(0xa39d92, { tint: 'neutral' }), px, 5.86, pz))
  }
  // ---- front on the side street (west face)
  const fx = cx - w / 2 - 0.02
  // warm shop opening
  g.add(box(0.08, 1.55, 2.5, new MeshBasicMaterial({ color: 0xffdca6, toneMapped: false }), fx, 1.3, cz + 1.0))
  g.add(box(0.1, 0.12, 2.6, wetMaterial(0x4a3a2c, 0.5, 0.3), fx - 0.02, 2.1, cz + 1.0))
  // counter + stools (outside, on the pavement)
  g.add(box(0.4, 0.06, 2.4, wetMaterial(0x6b4a34, 0.5, 0.2), fx - 0.24, 1.02, cz + 1.0))
  g.add(box(0.3, 0.9, 2.3, wetMaterial(0x3b2c22, 0.6, 0.15), fx + 0.02, 0.55, cz + 1.0))
  for (let i = 0; i < 4; i++) {
    const sy = 0.66
    const sx = fx - 0.72
    const sz = cz + 0.15 + i * 0.58
    g.add(cylinder(0.03, 0.03, sy, 8, wetMaterial(0x3a3f49, 0.5, 0.5), sx, sy / 2, sz))
    g.add(cylinder(0.17, 0.17, 0.06, 12, toonMaterial(0xb03a34, { tint: 'warm' }), sx, sy, sz))
  }
  // noren strips over the opening
  for (let i = 0; i < 5; i++) {
    g.add(plane(0.42, 0.5, new MeshStandardMaterial({ color: 0x2f3d62, roughness: 0.9, side: 2 }), fx - 0.06, 2.36, cz - 0.02 + i * 0.52, 0, -Math.PI / 2))
  }
  // sign above
  signBoard(g, 1.6, 0.5, '麺処 こむぎ', 'RAMEN ・ GYOZA', '#1d2a44', '#ffe6b8', fx - 0.04, 2.9, cz + 1.0, '-x')
  // paper lantern + ticket machine + menu boards
  const lanternMat = new MeshBasicMaterial({ color: 0xff9a6a, toneMapped: false })
  const lantern = cylinder(0.13, 0.13, 0.3, 12, lanternMat, fx - 0.3, 2.02, cz - 1.5)
  g.add(lantern)
  g.add(box(0.14, 0.02, 0.14, wetMaterial(0x2c1e16, 0.5, 0.2), fx - 0.3, 2.2, cz - 1.5))
  g.add(box(0.34, 1.1, 0.5, toonMaterial(0xd8d2c4, { tint: 'neutral' }), fx - 0.34, 0.62, cz - 0.4))
  g.add(plane(0.28, 0.4, new MeshBasicMaterial({ map: screenTextureLocal('ticket'), toneMapped: false }), fx - 0.52, 0.85, cz - 0.4, 0, -Math.PI / 2))
  for (let i = 0; i < 2; i++) {
    g.add(plane(0.36, 0.5, new MeshBasicMaterial({ map: menuBoard(i), toneMapped: false }), fx - 0.16, 1.5, cz - 2.15 + i * 0.5, 0, -Math.PI / 2))
  }
  // 2F windows + balcony + AC
  windowAt(g, 0.8, 0.7, fx + 0.02, 4.2, cz + 1.2, '-x', 0, false)
  windowAt(g, 0.7, 0.7, fx + 0.02, 4.2, cz - 0.6, '-x', 3, false)
  g.add(box(0.36, 0.05, 2.4, toonMaterial(0x8d8578, { tint: 'neutral' }), fx - 0.18, 3.7, cz + 0.4))
  for (let i = 0; i < 7; i++) g.add(box(0.035, 0.5, 0.035, wetMaterial(0x4a4f59, 0.5, 0.4), fx - 0.34, 3.98, cz - 0.7 + i * 0.36))
  g.add(box(0.04, 0.045, 2.4, wetMaterial(0x4a4f59, 0.5, 0.4), fx - 0.34, 4.24, cz + 0.4))
  acUnit(g, fx - 0.1, 3.3, cz - 1.9, '-x', 0.8)
  downpipe(g, fx - 0.05, cz + d / 2 - 0.1, 5.5)
  // ---- south gable (faces the main street: the side the diorama camera sees)
  const sz = cz + d / 2 + 0.02
  windowAt(g, 0.9, 0.8, cx, 4.1, sz, 'z', 1, false)
  windowAt(g, 0.7, 0.6, cx, 2.5, sz, 'z', 2, false)
  signBoard(g, 0.95, 0.42, '麺', '', '#2a1a14', '#ffe0a8', cx, 3.2, sz + 0.03, 'z')
  g.add(box(0.2, 0.12, 0.2, new MeshBasicMaterial({ color: 0xffd8a0, toneMapped: false }), cx + 0.75, 3.0, sz + 0.1))
  acUnit(g, cx + 1.0, 1.7, sz + 0.05, 'z', 0.8)
  g.add(box(0.4, 1.9, 0.06, toonMaterial(0x4a3b2e, { tint: 'warm' }), cx - 0.7, 0.98, sz + 0.03))
  g.add(box(0.5, 0.12, 0.28, toonMaterial(0x7d7466, { tint: 'neutral' }), cx - 0.7, 0.06, sz + 0.18))
  for (let i = 0; i < 3; i++) g.add(box(0.32, 0.24, 0.28, toonMaterial(i % 2 ? 0x8a6a4a : 0x3f5a6a, { tint: 'warm' }), cx + 0.45, 0.12 + i * 0.24, sz + 0.26))
  const sLamp = new PointLight(0xffd0a0, 1.6, 4, 2)
  sLamp.position.set(cx - 0.4, 2.0, sz + 0.8)
  g.add(sLamp)
  // steam pot + warm light
  g.add(cylinder(0.16, 0.14, 0.24, 12, wetMaterial(0x9aa0aa, 0.4, 0.6), fx - 0.2, 1.18, cz + 1.75))
  const light = new PointLight(0xffb877, 3.4, 5, 2)
  light.position.set(fx - 0.6, 1.7, cz + 1.0)
  g.add(light)
  return { group: g, lanternMat, steam: new Vector3(fx - 0.25, 1.4, cz + 1.75) }
}

function menuBoard(kind: number): CanvasTexture {
  return makeTexture(256, 384, (ctx) => {
    ctx.fillStyle = '#f4ecd8'
    ctx.fillRect(0, 0, 256, 384)
    ctx.strokeStyle = '#4a3a28'
    ctx.lineWidth = 8
    ctx.strokeRect(4, 4, 248, 376)
    ctx.fillStyle = '#3b2c1e'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const items = kind === 0 ? ['醤油', '味噌', '塩'] : ['餃子', 'チャーシュー', 'ビール']
    items.forEach((t, i) => ctx.fillText(t, 128, 90 + i * 80))
    ctx.font = '900 64px "Noto Sans CJK JP",sans-serif'
    items.forEach((t, i) => ctx.fillText(t, 128, 90 + i * 80))
    ctx.fillStyle = '#b03a34'
    ctx.fillRect(60, 330, 136, 30)
    ctx.fillStyle = '#f4ecd8'
    ctx.font = '700 22px "Trebuchet MS",Arial'
    ctx.fillText(kind === 0 ? '¥780〜' : '¥450〜', 128, 346)
  })
}

function screenTextureLocal(kind: 'ticket' | 'wash'): CanvasTexture {
  return makeTexture(256, 384, (ctx) => {
    ctx.fillStyle = kind === 'ticket' ? '#12202c' : '#0f2230'
    ctx.fillRect(0, 0, 256, 384)
    const g = ctx.createLinearGradient(0, 0, 0, 384)
    g.addColorStop(0, 'rgba(120,200,230,0.35)')
    g.addColorStop(1, 'rgba(30,60,90,0.1)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 384)
    ctx.fillStyle = '#bfe8ff'
    ctx.font = `700 ${kind === 'ticket' ? 26 : 30}px "Noto Sans CJK JP",sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(kind === 'ticket' ? '食券' : 'ご利用中', 128, 60)
    ctx.strokeStyle = 'rgba(190,230,255,0.5)'
    ctx.lineWidth = 3
    for (let i = 0; i < (kind === 'ticket' ? 4 : 3); i++) {
      roundRect(ctx, 24, 96 + i * 62, 208, 46, 8)
      ctx.stroke()
      ctx.fillStyle = 'rgba(190,230,255,0.7)'
      ctx.fillRect(38, 112 + i * 62, 80, 12)
      ctx.fillRect(140, 112 + i * 62, 80, 12)
    }
  })
}

/* ------------------------------------------------------------------ coin laundry */

function coinLaundry(): Group {
  const g = new Group()
  const cx = -8.15
  const cz = 9.55
  const w = 5.0
  const d = 2.4
  g.add(box(w, 3.4, d, toonMap(0xc6bfae, wallPaper), cx, 1.7, cz))
  g.add(box(w + 0.08, 0.3, d + 0.08, toonMaterial(0x5f584c, { tint: 'neutral' }), cx, 0.15, cz))
  g.add(box(w + 0.16, 0.14, d + 0.16, toonMaterial(0x6f6b64, { tint: 'neutral' }), cx, 3.47, cz))
  // parapet
  g.add(box(w + 0.16, 0.26, 0.1, toonMaterial(0xa39d92, { tint: 'neutral' }), cx, 3.62, cz + d / 2))
  g.add(box(w + 0.16, 0.26, 0.1, toonMaterial(0xa39d92, { tint: 'neutral' }), cx, 3.62, cz - d / 2))
  // low tank + vent
  g.add(cylinder(0.4, 0.4, 0.55, 12, toonMaterial(0xc7cbd2, { tint: 'neutral' }), cx + 1.3, 3.9, cz - 0.3))
  g.add(cylinder(0.14, 0.16, 0.3, 10, wetMaterial(0x5c6270, 0.5, 0.4), cx - 1.6, 3.72, cz + 0.4))
  // ---- shopfront on the north face
  const fz = cz - d / 2 - 0.02
  g.add(box(w - 0.4, 2.2, 0.08, new MeshBasicMaterial({ color: 0x243542, toneMapped: false }), cx, 1.35, fz))
  // glass + machines behind it
  for (let i = 0; i < 4; i++) {
    const mx = cx - 1.75 + i * 1.16
    g.add(box(0.86, 1.16, 0.5, toonMaterial(i % 2 ? 0xdfe6e8 : 0xc9d6dc, { tint: 'neutral' }), mx, 0.72, fz + 0.5))
    g.add(cylinder(0.24, 0.24, 0.06, 16, new MeshBasicMaterial({ color: i % 2 ? 0x9fdcff : 0xc9f0ff, toneMapped: false }), mx, 0.86, fz + 0.24).rotateX(Math.PI / 2))
    g.add(box(0.6, 0.16, 0.06, new MeshBasicMaterial({ color: 0xffe6bb, toneMapped: false }), mx, 1.3, fz + 0.24))
    g.add(box(0.08, 0.1, 0.05, new MeshBasicMaterial({ color: 0xff7a5a, toneMapped: false }), mx + 0.32, 1.32, fz + 0.24))
  }
  // glass panes with painted smudges
  g.add(box(w - 0.5, 2.0, 0.03, new MeshBasicMaterial({ color: 0x9fd0e2, transparent: true, opacity: 0.1, depthWrite: false, toneMapped: false }), cx, 1.3, fz - 0.05))
  // entrance
  g.add(box(0.9, 1.9, 0.06, new MeshBasicMaterial({ color: 0x8fb6c8, transparent: true, opacity: 0.3, toneMapped: false }), cx + 2.05, 0.96, fz - 0.06))
  g.add(box(1.0, 0.06, 0.06, wetMaterial(0x3c414b, 0.45, 0.4), cx + 2.05, 1.95, fz - 0.06))
  // sign band
  signBoard(g, 3.6, 0.62, 'コインランドリー', 'COIN LAUNDRY 24H', '#f2f6f8', '#1f7fa8', cx - 0.5, 2.78, fz - 0.08, '-z')
  // change machine + bench + basket stack
  g.add(box(0.4, 1.0, 0.4, toonMaterial(0xd8d2c4, { tint: 'neutral' }), cx - 2.15, 0.5, fz - 0.16))
  g.add(plane(0.3, 0.3, new MeshBasicMaterial({ map: screenTextureLocal('wash'), toneMapped: false }), cx - 2.15, 0.8, fz - 0.37, 0, Math.PI))
  g.add(box(1.2, 0.08, 0.34, toonMaterial(0x8a6a4a, { tint: 'warm' }), cx + 0.3, 0.42, fz - 0.3))
  g.add(box(0.08, 0.42, 0.3, toonMaterial(0x3a3f49, { tint: 'neutral' }), cx - 0.28, 0.21, fz - 0.3))
  g.add(box(0.08, 0.42, 0.3, toonMaterial(0x3a3f49, { tint: 'neutral' }), cx + 0.88, 0.21, fz - 0.3))
  // 2F windows + AC
  windowAt(g, 1.0, 0.8, cx - 1.2, 2.6, fz, '-z', 1, false)
  windowAt(g, 0.9, 0.8, cx + 0.4, 2.65, fz, '-z', 3, true)
  acUnit(g, cx + 1.9, 2.2, fz + 0.05, '-z', 0.9)
  downpipe(g, cx - w / 2 + 0.1, fz + 0.04, 3.4)
  // ---- back (south) wall clutter
  const bz = cz + d / 2 + 0.02
  downpipe(g, cx + w / 2 - 0.12, bz + 0.04, 3.4)
  acUnit(g, cx - 1.2, 1.4, bz + 0.05, 'z', 1)
  g.add(box(0.34, 0.46, 0.14, toonMaterial(0xc4c0b6, { tint: 'neutral' }), cx + 1.9, 1.3, bz + 0.08))
  // service door + step + lamp + meter + crates: the back of a Japanese shop
  g.add(box(0.8, 1.9, 0.06, toonMaterial(0x5f584c, { tint: 'neutral' }), cx + 2.35, 0.95, bz + 0.03))
  g.add(box(0.9, 0.12, 0.3, toonMaterial(0x8d8679, { tint: 'neutral' }), cx + 2.35, 0.06, bz + 0.2))
  g.add(box(0.16, 0.1, 0.16, new MeshBasicMaterial({ color: 0xffd8a0, toneMapped: false }), cx + 2.35, 2.0, bz + 0.1))
  windowAt(g, 0.85, 0.7, cx - 2.0, 2.6, bz, 'z', 1, false)
  windowAt(g, 0.7, 0.65, cx + 0.5, 2.65, bz, 'z', 2, true)
  g.add(box(0.4, 0.3, 0.3, toonMaterial(0x3f5a6a, { tint: 'cool' }), cx + 1.5, 0.15, bz + 0.25))
  g.add(box(0.4, 0.3, 0.3, toonMaterial(0x6a5a3f, { tint: 'warm' }), cx + 1.42, 0.45, bz + 0.25))
  g.add(plane(0.5, 0.7, new MeshBasicMaterial({ map: menuBoard(2), toneMapped: false }), cx - 0.9, 1.5, bz + 0.04))
  g.add(box(2.2, 0.07, 0.55, toonMaterial(0x8d8679, { tint: 'neutral' }), cx + 2.2, 2.24, bz + 0.28))
  for (let i = 0; i < 3; i++) {
    g.add(box(0.3, 0.24, 0.3, toonMaterial(i % 2 ? 0xc9d6dc : 0x8fb6c8, { tint: 'cool' }), cx + 1.35 + i * 0.05, 0.12 + i * 0.24, bz + 0.55))
  }
  const bin = parkedBike(0x8a7040)
  bin.position.set(cx - 2.6, 0, bz + 0.6)
  bin.rotation.y = Math.PI / 2 - 0.1
  g.add(bin)
  const backLamp = new PointLight(0xffcf94, 1.5, 4, 2)
  backLamp.position.set(cx + 1.6, 1.9, bz + 0.7)
  g.add(backLamp)
  // light spill
  const light = new PointLight(0x9fd8ff, 3.6, 6, 2)
  light.position.set(cx - 0.4, 2.2, fz - 0.9)
  g.add(light)
  return g
}

/* ------------------------------------------------------------------ izakaya */

function izakaya(): { group: Group; lanternMats: MeshBasicMaterial[] } {
  const g = new Group()
  const cx = 8.15
  const cz = 9.6
  const w = 4.6
  const d = 2.6
  g.add(box(w, 3.6, d, toonMap(0xb9a894, wallPaper), cx, 1.8, cz))
  g.add(box(w + 0.08, 0.32, d + 0.08, toonMaterial(0x5a4c3c, { tint: 'warm' }), cx, 0.16, cz))
  // tiled roof
  const roofMat = new MeshStandardMaterial({ map: roofTileTexture(), roughness: 0.55, metalness: 0.25 })
  g.add(box(w + 0.55, 0.1, d / 2 + 0.35, roofMat, cx, 3.72, cz + d / 4).rotateX(0.22))
  g.add(box(w + 0.55, 0.1, d / 2 + 0.35, roofMat, cx, 3.72, cz - d / 4).rotateX(-0.22))
  g.add(box(w + 0.65, 0.1, 0.14, wetMaterial(0x3d424c, 0.5, 0.3), cx, 3.98, cz))
  // ---- shopfront on the north face
  const fz = cz - d / 2 - 0.02
  g.add(box(2.6, 2.0, 0.08, new MeshBasicMaterial({ color: 0xffca8a, toneMapped: false }), cx, 1.15, fz))
  // wooden frame grid over the glowing front
  for (let i = 0; i < 4; i++) g.add(box(0.06, 2.0, 0.1, wetMaterial(0x4a3524, 0.6, 0.2), cx - 1.2 + i * 0.8, 1.15, fz - 0.05))
  g.add(box(2.7, 0.08, 0.12, wetMaterial(0x4a3524, 0.6, 0.2), cx, 1.56, fz - 0.05))
  // sliding door
  g.add(box(1.2, 1.85, 0.06, wetMaterial(0x3b2c22, 0.6, 0.15), cx + 1.6, 0.98, fz - 0.04))
  g.add(plane(0.5, 0.7, new MeshBasicMaterial({ color: 0xffe0b0, toneMapped: false }), cx + 1.35, 1.2, fz - 0.09))
  // noren over the door
  for (let i = 0; i < 3; i++) {
    g.add(plane(0.34, 0.42, new MeshStandardMaterial({ color: 0x5b2a2a, roughness: 0.9, side: 2 }), cx + 1.2 + i * 0.38, 1.72, fz - 0.12, 0, Math.PI))
  }
  // red lanterns
  const lanternMats: MeshBasicMaterial[] = []
  for (let i = 0; i < 2; i++) {
    const m = new MeshBasicMaterial({ color: 0xff7048, toneMapped: false })
    lanternMats.push(m)
    g.add(cylinder(0.16, 0.16, 0.34, 12, m, cx - 1.5 + i * 0.55, 1.9, fz - 0.28))
    g.add(box(0.18, 0.02, 0.18, wetMaterial(0x2c1e16, 0.5, 0.2), cx - 1.5 + i * 0.55, 2.08, fz - 0.28))
  }
  // sign + menu boards + crates
  signBoard(g, 2.2, 0.5, '居酒屋 かさね', 'SAKE ・ YAKITORI', '#2a1c16', '#ffcf94', cx - 0.5, 2.5, fz - 0.08, '-z')
  for (let i = 0; i < 2; i++) {
    g.add(plane(0.3, 0.46, new MeshBasicMaterial({ map: menuBoard(i + 0), toneMapped: false }), cx + 0.2 + i * 0.44, 1.28, fz - 0.8, 0, Math.PI))
    g.add(cylinder(0.02, 0.02, 1.0, 6, wetMaterial(0x4a4f59, 0.5, 0.4), cx + 0.2 + i * 0.44, 0.5, fz - 0.82))
  }
  g.add(box(0.5, 0.32, 0.34, toonMaterial(0xa87b4a, { tint: 'warm' }), cx + 2.2, 0.16, fz - 0.3))
  for (let i = 0; i < 4; i++) g.add(cylinder(0.04, 0.04, 0.24, 8, wetMaterial(0x2f5a3a, 0.3, 0.4), cx + 2.1 + i * 0.09, 0.42, fz - 0.3))
  // 2F lattice windows
  windowAt(g, 1.1, 0.8, cx - 1.3, 2.6, fz, '-z', 3, false)
  windowAt(g, 0.9, 0.8, cx + 0.6, 2.6, fz, '-z', 0, false)
  acUnit(g, cx + 1.7, 2.3, fz + 0.05, '-z', 0.9)
  downpipe(g, cx - w / 2 + 0.1, fz + 0.04, 3.6)
  // ---- back wall (south): service door, pipes, crates, a bicycle
  const bz = cz + d / 2 + 0.02
  g.add(box(0.85, 1.95, 0.06, toonMaterial(0x4a3b2e, { tint: 'warm' }), cx + 1.7, 0.98, bz + 0.03))
  g.add(box(0.95, 0.12, 0.3, toonMaterial(0x7d7466, { tint: 'neutral' }), cx + 1.7, 0.06, bz + 0.2))
  g.add(box(0.18, 0.12, 0.18, new MeshBasicMaterial({ color: 0xffd8a0, toneMapped: false }), cx + 1.7, 2.06, bz + 0.1))
  windowAt(g, 0.9, 0.75, cx - 1.6, 2.55, bz, 'z', 1, false)
  windowAt(g, 0.7, 0.7, cx + 0.3, 2.6, bz, 'z', 0, true)
  acUnit(g, cx - 2.3, 1.5, bz + 0.05, 'z', 1)
  downpipe(g, cx + w / 2 - 0.1, bz + 0.04, 3.6)
  for (let i = 0; i < 3; i++) g.add(box(0.34, 0.26, 0.3, toonMaterial(i % 2 ? 0x8a6a4a : 0x3f5a6a, { tint: 'warm' }), cx - 1.9 + i * 0.05, 0.13 + i * 0.26, bz + 0.28))
  g.add(plane(0.5, 0.7, new MeshBasicMaterial({ map: menuBoard(1), toneMapped: false }), cx - 0.6, 1.45, bz + 0.04))
  // little eave over the back door so the wall does not read as one flat slab
  g.add(box(2.6, 0.08, 0.62, toonMaterial(0x4a3b2e, { tint: 'warm' }), cx + 1.6, 2.42, bz + 0.3))
  for (const bx of [cx + 0.5, cx + 2.6]) {
    g.add(box(0.06, 0.06, 0.5, wetMaterial(0x3a2c22, 0.6, 0.2), bx, 2.2, bz + 0.28))
  }
  signBoard(g, 0.38, 0.62, '酒', '', '#2a1c16', '#ffcf94', cx + 3.0, 1.9, bz + 0.05, 'z')
  const bike = parkedBike(0x3f5a6a)
  bike.position.set(cx - 2.5, 0, bz + 0.55)
  bike.rotation.y = Math.PI / 2 + 0.1
  g.add(bike)
  const backLamp = new PointLight(0xffb877, 1.8, 4.5, 2)
  backLamp.position.set(cx + 1.4, 1.9, bz + 0.8)
  g.add(backLamp)
  // side wall details (visible from the east)
  const ex = cx + w / 2 + 0.01
  windowAt(g, 0.7, 0.7, ex, 2.3, cz + 0.2, 'x', 2, false)
  downpipe(g, ex + 0.04, cz + d / 2 - 0.15, 3.6)
  g.add(box(0.14, 0.5, 0.36, toonMaterial(0xb8bcc4, { tint: 'neutral' }), ex + 0.06, 1.4, cz - 0.4))
  g.add(box(0.3, 0.42, 0.12, toonMaterial(0xc4c0b6, { tint: 'neutral' }), ex + 0.05, 0.9, cz + 0.7))
  // light
  const l1 = new PointLight(0xffa870, 3.2, 5, 2)
  l1.position.set(cx - 0.4, 1.7, fz - 1.0)
  g.add(l1)
  return { group: g, lanternMats }
}

/* ------------------------------------------------------------------ shrine */

function shrine(): Group {
  const g = new Group()
  const cx = -10.05
  const cz = -1.4
  // torii
  const vermilion = toonMaterial(0xc8412e, { tint: 'warm' })
  const dark = toonMaterial(0x2c2622, { tint: 'neutral' })
  const postZ = cz + 1.5
  for (const px of [cx - 0.7, cx + 0.7]) {
    g.add(cylinder(0.085, 0.1, 2.7, 10, vermilion, px, 1.35, postZ))
    g.add(cylinder(0.13, 0.13, 0.12, 10, dark, px, 0.06, postZ))
  }
  g.add(box(1.9, 0.14, 0.2, vermilion, cx, 2.62, postZ))
  g.add(box(2.1, 0.1, 0.24, dark, cx, 2.76, postZ))
  g.add(box(1.6, 0.1, 0.14, vermilion, cx, 2.2, postZ))
  g.add(box(0.06, 0.26, 0.06, vermilion, cx, 2.5, postZ))
  const plaque = plane(0.5, 0.3, new MeshBasicMaterial({ map: signTexture('星宮', 'HOSHIMIYA', '#2c2622', '#e8d6a8'), toneMapped: false }), cx, 2.44, postZ + 0.11)
  g.add(plaque)
  // stone lanterns
  for (const lx of [cx - 0.75, cx + 0.75]) {
    const lz = cz + 0.2
    g.add(box(0.34, 0.16, 0.34, toonMaterial(0x7d7a72, { tint: 'neutral' }), lx, 0.08, lz))
    g.add(cylinder(0.09, 0.11, 0.6, 8, toonMaterial(0x8d8a80, { tint: 'neutral' }), lx, 0.46, lz))
    g.add(box(0.36, 0.1, 0.36, toonMaterial(0x7d7a72, { tint: 'neutral' }), lx, 0.8, lz))
    g.add(box(0.28, 0.3, 0.28, new MeshBasicMaterial({ color: 0xffe0a8, toneMapped: false }), lx, 1.0, lz))
    g.add(cylinder(0.01, 0.32, 0.24, 4, toonMaterial(0x6f6a62, { tint: 'neutral' }), lx, 1.28, lz))
    g.add(cylinder(0.03, 0.03, 0.1, 6, toonMaterial(0x6f6a62, { tint: 'neutral' }), lx, 1.44, lz))
  }
  // hokora at the back
  const hz = cz - 1.5
  g.add(box(1.0, 0.3, 0.8, toonMaterial(0x7d7a72, { tint: 'neutral' }), cx, 0.15, hz))
  g.add(box(0.72, 0.72, 0.6, toonMaterial(0x6b4a34, { tint: 'warm' }), cx, 0.65, hz))
  g.add(plane(0.44, 0.44, new MeshBasicMaterial({ color: 0xffdca6, toneMapped: false }), cx, 0.72, hz + 0.31, 0, Math.PI))
  g.add(box(0.9, 0.09, 0.78, dark, cx, 1.0, hz + 0.1).rotateX(-0.18))
  g.add(box(0.9, 0.09, 0.78, dark, cx, 1.0, hz - 0.1).rotateX(0.18))
  // stone wall along the west edge + cedar
  for (let i = 0; i < 8; i++) {
    g.add(box(0.5, 0.5 + (i % 2) * 0.1, 0.5, toonMaterial(0x6f6c66, { tint: 'neutral' }), -10.75, 0.25, -3.2 + i * 0.55))
  }
  const cedar = toonMaterial(0x2f4a38, { tint: 'cool' })
  g.add(cylinder(0.08, 0.1, 2.2, 8, toonMaterial(0x4a3a2c, { tint: 'warm' }), -9.6, 1.1, -3.0))
  for (let i = 0; i < 3; i++) {
    const r = 0.85 - i * 0.2
    const cone = cylinder(0.02, r, 0.9, 8, cedar, -9.6, 2.0 + i * 0.55, -3.0)
    g.add(cone)
  }
  // offering box + fox pedestals
  g.add(box(0.5, 0.3, 0.32, dark, cx, 0.32, hz + 0.66))
  for (const sx of [cx - 0.62, cx + 0.62]) {
    g.add(box(0.26, 0.5, 0.26, toonMaterial(0x8d8a80, { tint: 'neutral' }), sx, 0.25, hz + 0.9))
    g.add(box(0.16, 0.26, 0.16, new MeshBasicMaterial({ color: 0xc9c2b4, toneMapped: false }), sx, 0.63, hz + 0.9))
  }
  const light = new PointLight(0xffb877, 2.2, 4.5, 2)
  light.position.set(cx, 1.4, hz + 0.8)
  g.add(light)
  return g
}

/* ------------------------------------------------------------------ service yard + parking */

function serviceYard(): Group {
  const g = new Group()
  // chain-link fence
  const fenceMat = new MeshStandardMaterial({ color: 0x9aa3ae, roughness: 0.5, metalness: 0.6, wireframe: true, transparent: true, opacity: 0.5 })
  g.add(plane(2.8, 1.4, fenceMat, 0.55, 0.72, -5.2, 0, 0))
  g.add(plane(4.2, 1.4, fenceMat, 2.0, 0.72, -7.3, 0, Math.PI / 2))
  for (let i = 0; i < 3; i++) g.add(cylinder(0.04, 0.04, 1.5, 6, wetMaterial(0x6a707c, 0.5, 0.5), -0.8 + i * 1.3, 0.75, -5.22))
  // bicycle racks
  for (let i = 0; i < 3; i++) {
    const rack = new Group()
    rack.position.set(-0.4 + i * 0.6, 0, -6.6)
    rack.add(box(0.06, 0.5, 0.5, wetMaterial(0x8a919e, 0.45, 0.6), 0, 0.25, 0))
    g.add(rack)
    const bike = parkedBike([0x4c6f8a, 0x7a5560, 0x5a6f4c][i])
    bike.position.set(-0.4 + i * 0.6, 0.075, -6.6)
    bike.rotation.y = Math.PI / 2
    g.add(bike)
  }
  // trash cage
  g.add(box(1.1, 0.9, 0.8, fenceMat, 1.4, 0.45, -7.9))
  for (let i = 0; i < 3; i++) {
    const bag = sphere(0.2, wetMaterial(0xdfe3e8, 0.6, 0.05), 1.1 + i * 0.26, 0.18, -7.86, 8)
    bag.scale.set(1, 0.7, 0.9)
    g.add(bag)
  }
  // propane tanks + shed
  for (let i = 0; i < 2; i++) {
    g.add(cylinder(0.16, 0.16, 0.66, 10, toonMaterial(0x9aa0aa, { tint: 'neutral' }), 0.2, 0.33 + i * 0.0, -8.7 + i * 0.4))
  }
  g.add(box(1.6, 1.9, 1.3, toonMap(0xb9bec8, corrugated), 1.6, 0.95, -9.0))
  g.add(box(1.7, 0.1, 1.4, toonMaterial(0x666b76, { tint: 'neutral' }), 1.6, 1.95, -9.0))
  g.add(box(0.7, 1.3, 0.06, wetMaterial(0x767c88, 0.5, 0.4), 1.6, 0.65, -8.32))
  return g
}

function coinParking(): Group {
  const g = new Group()
  const x0 = 8.95
  const x1 = 10.85
  // bay lines
  for (let i = 0; i < 5; i++) {
    const z = -4.8 + i * 1.28
    g.add(plane(x1 - x0, 0.08, new MeshBasicMaterial({ color: 0xcdd4de, transparent: true, opacity: 0.7 }), (x0 + x1) / 2, 0.012, z, -Math.PI / 2))
  }
  g.add(plane(0.09, 5.12, new MeshBasicMaterial({ color: 0xcdd4de, transparent: true, opacity: 0.7 }), x1 - 0.05, 0.012, -2.24, -Math.PI / 2))
  // bay numbers
  for (let i = 0; i < 4; i++) {
    const tex = makeTexture(64, 64, (ctx) => {
      ctx.fillStyle = '#cdd4de'
      ctx.font = '900 46px "Trebuchet MS",Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), 32, 36)
    })
    g.add(plane(0.34, 0.34, new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.75 }), x0 + 0.4, 0.013, -4.2 + i * 1.28, -Math.PI / 2))
  }
  // wheel stops
  for (let i = 0; i < 4; i++) g.add(box(0.18, 0.1, 1.0, toonMaterial(0x8b8f9a), x0 + 0.2, 0.05, -4.16 + i * 1.28))
  // fence at the base edge
  const fenceMat = new MeshStandardMaterial({ color: 0x9aa3ae, roughness: 0.5, metalness: 0.6, wireframe: true, transparent: true, opacity: 0.45 })
  g.add(plane(5.2, 1.3, fenceMat, 10.86, 0.66, -2.2, 0, Math.PI / 2))
  for (let i = 0; i < 4; i++) g.add(cylinder(0.04, 0.04, 1.4, 6, wetMaterial(0x6a707c, 0.5, 0.5), 10.84, 0.7, -4.7 + i * 1.7))
  // sign + ticket machine + vending
  const sgn = new Group()
  sgn.position.set(9.6, 0, 0.1)
  sgn.add(cylinder(0.05, 0.05, 1.9, 8, wetMaterial(0x6a707c, 0.5, 0.5), 0, 0.95, 0))
  sgn.add(box(1.0, 0.66, 0.08, toonMaterial(0xe8e3d6, { tint: 'neutral' }), 0, 1.72, 0))
  sgn.add(plane(0.94, 0.6, new MeshBasicMaterial({ map: signTexture('コインパーキング', '24H ・ 1F', '#e8e3d6', '#2f5a86'), toneMapped: false }), 0, 1.72, 0.05))
  g.add(sgn)
  g.add(box(0.36, 0.9, 0.3, toonMaterial(0xd8d2c4, { tint: 'neutral' }), 9.35, 0.45, -0.45))
  g.add(plane(0.24, 0.3, new MeshBasicMaterial({ map: screenTextureLocal('wash'), toneMapped: false }), 9.35, 0.66, -0.29, 0, Math.PI))
  return g
}

function parkedBike(color: number): Group {
  const g = new Group()
  const frame = wetMaterial(color, 0.3, 0.55)
  const tire = wetMaterial(0x1b1f27, 0.55, 0.2)
  for (const wx of [-0.5, 0.5]) {
    const w = new Group()
    w.position.set(wx, 0.3, 0)
    const t = cylinder(0.3, 0.3, 0.03, 16, tire, 0, 0, 0)
    t.rotation.z = Math.PI / 2
    w.add(t)
    const hub = cylinder(0.05, 0.05, 0.05, 8, wetMaterial(0x8a919e, 0.4, 0.7), 0, 0, 0)
    hub.rotation.z = Math.PI / 2
    w.add(hub)
    g.add(w)
  }
  g.add(box(0.9, 0.03, 0.03, frame, 0, 0.5, 0))
  g.add(box(0.03, 0.42, 0.03, frame, -0.32, 0.32, 0))
  g.add(box(0.03, 0.48, 0.03, frame, 0.34, 0.55, 0))
  g.add(box(0.24, 0.05, 0.1, wetMaterial(0x2a2420, 0.5, 0.2), -0.3, 0.82, 0))
  g.add(box(0.03, 0.03, 0.4, wetMaterial(0x8a919e, 0.4, 0.7), 0.4, 0.86, 0))
  g.add(box(0.3, 0.2, 0.24, new MeshStandardMaterial({ color: 0xb9c1c9, roughness: 0.5, metalness: 0.6, wireframe: true }), 0.42, 0.6, 0))
  return g
}

/* ------------------------------------------------------------------ assembly */

export function buildBlocks(): BlocksParts {
  const group = new Group()
  const steamSpots: Vector3[] = []
  const lanternMats: MeshBasicMaterial[] = []
  const parkingSpots: { x: number; z: number; rot: number }[] = []

  group.add(apartment())
  group.add(warehouse())
  group.add(house2())
  group.add(shrine())
  group.add(serviceYard())
  group.add(coinParking())

  const ramen = ramenShop()
  group.add(ramen.group)
  steamSpots.push(ramen.steam)
  lanternMats.push(ramen.lanternMat)

  group.add(coinLaundry())

  const iza = izakaya()
  group.add(iza.group)
  lanternMats.push(...iza.lanternMats)

  // parking slots: east coin parking (nose-in, facing the side street)
  for (let i = 0; i < 3; i++) parkingSpots.push({ x: 9.9, z: -4.16 + i * 1.28, rot: Math.PI / 2 })

  return { group, windowMats, steamSpots, lanternMats, parkingSpots }
}
