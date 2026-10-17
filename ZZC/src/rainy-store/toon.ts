/** Cel-shading kit: toon gradients, ink outlines, geometry helpers and every
 *  hand-painted canvas texture used by the rainy konbini diorama. */
import {
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  PlaneGeometry,
  RGBAFormat,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  type Material,
  type Side,
  type Texture,
} from 'three'

export const FONT_JP =
  '"Noto Sans CJK JP","Noto Sans JP","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif'
export const FONT_LATIN = '"Avenir Next","Trebuchet MS","Helvetica Neue",Arial,sans-serif'

/* ------------------------------------------------------------------ toon */

export type Tint = 'cool' | 'warm' | 'neutral'

function gradientMap(stops: number[]): DataTexture {
  const data = new Uint8Array(stops.length * 4)
  stops.forEach((hex, i) => {
    const c = new Color(hex).convertSRGBToLinear()
    data[i * 4] = Math.round(c.r * 255)
    data[i * 4 + 1] = Math.round(c.g * 255)
    data[i * 4 + 2] = Math.round(c.b * 255)
    data[i * 4 + 3] = 255
  })
  const tex = new DataTexture(data, stops.length, 1, RGBAFormat)
  tex.minFilter = NearestFilter
  tex.magFilter = NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

export const TINTS: Record<Tint, DataTexture> = {
  cool: gradientMap([0x5c6a9c, 0x93a2cc, 0xc7d3ec, 0xf2f3ff]),
  warm: gradientMap([0x6e4c3c, 0xc68a58, 0xffc98a, 0xfff6e0]),
  neutral: gradientMap([0x4f4f60, 0x8f8fa0, 0xcdc8bf, 0xfff6e9]),
}

export interface ToonOptions {
  tint?: Tint
  emissive?: number
  emissiveIntensity?: number
  map?: Texture
  transparent?: boolean
  opacity?: number
  side?: Side
  vertexColors?: boolean
}

export function toonMaterial(color: number, opts: ToonOptions = {}): MeshToonMaterial {
  return new MeshToonMaterial({
    color,
    gradientMap: TINTS[opts.tint ?? 'cool'],
    map: opts.map,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? 0,
    vertexColors: opts.vertexColors,
  })
}

export function wetMaterial(color: number, roughness = 0.28, metalness = 0.55, opacity = 1): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    roughness,
    metalness,
    transparent: opacity < 1,
    opacity,
    envMapIntensity: 1,
  })
}

export function flatMaterial(color: number, opts: { transparent?: boolean; opacity?: number; side?: Side; map?: Texture } = {}) {
  return new MeshBasicMaterial({
    color,
    map: opts.map,
    transparent: opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? 0,
  })
}

export function glowMaterial(color: number, opacity = 1, map?: Texture): MeshBasicMaterial {
  const m = new MeshBasicMaterial({
    color,
    map,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    blending: map ? 1 : 0,
  })
  return m
}

/* ---------------------------------------------------------------- outline */

const outlineMats = new Map<string, ShaderMaterial>()

export function outlineMaterial(thickness = 0.012, color = 0x0b0813): ShaderMaterial {
  const key = `${thickness}:${color}`
  let mat = outlineMats.get(key)
  if (!mat) {
    mat = new ShaderMaterial({
      uniforms: { uThickness: { value: thickness }, uColor: { value: new Color(color) } },
      vertexShader: `
        uniform float uThickness;
        void main() {
          vec3 p = position + normal * uThickness;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        void main() { gl_FragColor = vec4(uColor, 1.0); }`,
      side: BackSide,
      toneMapped: false,
      fog: false,
    })
    outlineMats.set(key, mat)
  }
  return mat
}

/** Inverted-hull ink line. Only use on solid geometry (never on planes/sprites). */
export function addOutline<T extends Mesh>(mesh: T, thickness = 0.012): T {
  const ink = new Mesh(mesh.geometry, outlineMaterial(thickness))
  ink.castShadow = false
  ink.receiveShadow = false
  ink.frustumCulled = mesh.frustumCulled
  mesh.add(ink)
  return mesh
}

/* --------------------------------------------------------------- geometry */

export function box(w: number, h: number, d: number, mat: Material, x = 0, y = 0, z = 0): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function plane(w: number, h: number, mat: Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): Mesh {
  const mesh = new Mesh(new PlaneGeometry(w, h), mat)
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, ry, rz)
  mesh.receiveShadow = true
  return mesh
}

export function cylinder(rt: number, rb: number, h: number, seg: number, mat: Material, x = 0, y = 0, z = 0): Mesh {
  const mesh = new Mesh(new CylinderGeometry(rt, rb, h, seg, 1), mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function sphere(r: number, mat: Material, x = 0, y = 0, z = 0, seg = 14): Mesh {
  const mesh = new Mesh(new SphereGeometry(r, seg, Math.max(8, seg / 2)), mat)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/* ----------------------------------------------------------------- canvas */

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export interface TextOptions {
  weight?: string
  align?: CanvasTextAlign
  font?: string
  tracking?: number
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: TextOptions = {},
) {
  ctx.fillStyle = color
  ctx.textAlign = opts.align ?? 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `${opts.weight ?? '700'} ${size}px ${opts.font ?? FONT_JP}`
  if (!opts.tracking) {
    ctx.fillText(str, x, y)
    return
  }
  const chars = [...str]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + opts.tracking * (chars.length - 1)
  let cx = x
  if (ctx.textAlign === 'center') cx -= total / 2
  else if (ctx.textAlign === 'right') cx -= total
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y)
    cx += widths[i] + opts.tracking!
  })
}

export function makeTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  repeat?: [number, number],
): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  draw(ctx)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  if (repeat) {
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(repeat[0], repeat[1])
  }
  return tex
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, colors: string[], max = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[i % colors.length]
    const s = Math.random() * max + 0.4
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s)
  }
}

/* --------------------------------------------------------------- textures */

export function asphaltTexture(repeat: number): CanvasTexture {
  return makeTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#242a3b'
    ctx.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.05)'
      ctx.beginPath()
      ctx.ellipse(Math.random() * 512, Math.random() * 512, Math.random() * 90 + 20, Math.random() * 40 + 10, Math.random() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    speckle(ctx, 512, 512, 2200, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.18)', 'rgba(150,170,210,0.05)'], 1.8)
    ctx.strokeStyle = 'rgba(10,12,18,0.55)'
    ctx.lineWidth = 1.4
    for (let i = 0; i < 8; i++) {
      ctx.beginPath()
      let x = Math.random() * 512
      let y = Math.random() * 512
      ctx.moveTo(x, y)
      for (let s = 0; s < 6; s++) {
        x += Math.random() * 40 - 20
        y += Math.random() * 40 - 20
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    const wet = ctx.createLinearGradient(0, 0, 512, 512)
    wet.addColorStop(0, 'rgba(120,150,200,0.05)')
    wet.addColorStop(0.5, 'rgba(0,0,0,0)')
    wet.addColorStop(1, 'rgba(120,150,200,0.04)')
    ctx.fillStyle = wet
    ctx.fillRect(0, 0, 512, 512)
  }, [repeat, repeat])
}

export function sidewalkTexture(repeatX: number, repeatY: number): CanvasTexture {
  return makeTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#5b6377'
    ctx.fillRect(0, 0, 512, 512)
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const shade = 0.9 + Math.random() * 0.16
        ctx.fillStyle = `rgb(${Math.round(90 * shade)},${Math.round(99 * shade)},${Math.round(118 * shade)})`
        ctx.fillRect(tx * 128 + 3, ty * 128 + 3, 122, 122)
        ctx.strokeStyle = 'rgba(35,40,54,0.9)'
        ctx.lineWidth = 4
        ctx.strokeRect(tx * 128 + 2, ty * 128 + 2, 124, 124)
      }
    }
    speckle(ctx, 512, 512, 1800, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.12)'], 1.5)
    const sheen = ctx.createLinearGradient(0, 0, 0, 512)
    sheen.addColorStop(0, 'rgba(150,180,230,0.06)')
    sheen.addColorStop(1, 'rgba(20,30,50,0.16)')
    ctx.fillStyle = sheen
    ctx.fillRect(0, 0, 512, 512)
  }, [repeatX, repeatY])
}

export function tactileTexture(repeatX: number, repeatY: number): CanvasTexture {
  return makeTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#c99f2c'
    ctx.fillRect(0, 0, 128, 128)
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const cx = 16 + x * 32
        const cy = 16 + y * 32
        const g = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 8)
        g.addColorStop(0, '#f2cf66')
        g.addColorStop(1, '#a87f1d')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, 7, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    speckle(ctx, 128, 128, 160, ['rgba(90,60,10,0.2)', 'rgba(255,240,180,0.25)'], 1.4)
  }, [repeatX, repeatY])
}

export function gutterTexture(repeatX: number): CanvasTexture {
  return makeTexture(256, 128, (ctx) => {
    ctx.fillStyle = '#20242f'
    ctx.fillRect(0, 0, 256, 128)
    ctx.fillStyle = '#151821'
    for (let i = 0; i < 8; i++) {
      roundRect(ctx, 12 + i * 30, 16, 16, 96, 5)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(160,175,200,0.25)'
    ctx.lineWidth = 2
    ctx.strokeRect(2, 2, 252, 124)
    ctx.fillStyle = 'rgba(190,205,230,0.15)'
    for (let i = 0; i < 8; i++) ctx.fillRect(12 + i * 30, 16, 2, 96)
  }, [repeatX, 1])
}

export function signTexture(): CanvasTexture {
  return makeTexture(1024, 256, (ctx) => {
    ctx.fillStyle = '#f7f2e3'
    ctx.fillRect(0, 0, 1024, 256)
    ctx.fillStyle = '#0d8264'
    ctx.fillRect(0, 0, 1024, 16)
    ctx.fillStyle = '#f0a13c'
    ctx.fillRect(0, 16, 1024, 7)
    ctx.fillStyle = '#0d8264'
    ctx.fillRect(0, 228, 1024, 16)
    ctx.fillStyle = '#f0a13c'
    ctx.fillRect(0, 244, 1024, 7)

    ctx.fillStyle = '#0b7458'
    ctx.beginPath()
    ctx.arc(92, 126, 58, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#f7f2e3'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(92, 126, 50, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#fdf9ee'
    // small four point star mark
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? 34 : 10
      ctx.lineTo(92 + Math.cos(a) * r, 126 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()

    drawText(ctx, 'ほしぞらマート', 172, 100, 82, '#16453a', { weight: '900' })
    drawText(ctx, 'HOSHIZORA MART', 176, 172, 27, '#3d7d69', { tracking: 8, font: FONT_LATIN, weight: '700' })
    drawText(ctx, '24 HOURS  ·  ATM  ·  COPY  ·  宅配', 176, 204, 21, '#6a8f84', { tracking: 2 })

    ctx.fillStyle = '#0b7458'
    roundRect(ctx, 906, 82, 78, 88, 12)
    ctx.fill()
    drawText(ctx, '24', 945, 112, 46, '#fdf9ee', { align: 'center', weight: '900', font: FONT_LATIN })
    drawText(ctx, 'H', 945, 152, 26, '#f0a13c', { align: 'center', weight: '900', font: FONT_LATIN })
  })
}

/** Same artwork at 5.5:1 for the long east-facing sign band. */
export function signWideTexture(): CanvasTexture {
  return makeTexture(1400, 256, (ctx) => {
    ctx.fillStyle = '#f7f2e3'
    ctx.fillRect(0, 0, 1400, 256)
    ctx.fillStyle = '#0d8264'
    ctx.fillRect(0, 0, 1400, 16)
    ctx.fillStyle = '#f0a13c'
    ctx.fillRect(0, 16, 1400, 7)
    ctx.fillStyle = '#0d8264'
    ctx.fillRect(0, 228, 1400, 16)
    ctx.fillStyle = '#f0a13c'
    ctx.fillRect(0, 244, 1400, 7)
    ctx.fillStyle = '#0b7458'
    ctx.beginPath()
    ctx.arc(150, 126, 58, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fdf9ee'
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? 34 : 10
      ctx.lineTo(150 + Math.cos(a) * r, 126 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    drawText(ctx, 'ほしぞらマート', 238, 100, 90, '#16453a', { weight: '900' })
    drawText(ctx, 'HOSHIZORA MART — 24 HOURS', 244, 172, 27, '#3d7d69', { tracking: 9, font: FONT_LATIN, weight: '700' })
    drawText(ctx, 'ATM  ·  COPY  ·  宅配便  ·  コーヒー', 244, 206, 21, '#6a8f84', { tracking: 2 })
    ctx.fillStyle = '#0b7458'
    roundRect(ctx, 1282, 82, 78, 88, 12)
    ctx.fill()
    drawText(ctx, '24', 1321, 112, 46, '#fdf9ee', { align: 'center', weight: '900', font: FONT_LATIN })
    drawText(ctx, 'H', 1321, 152, 26, '#f0a13c', { align: 'center', weight: '900', font: FONT_LATIN })
  })
}

export function bladeTexture(): CanvasTexture {
  return makeTexture(256, 384, (ctx) => {
    ctx.fillStyle = '#f7f2e3'
    ctx.fillRect(0, 0, 256, 384)
    ctx.fillStyle = '#0d8264'
    ctx.fillRect(0, 0, 256, 20)
    ctx.fillStyle = '#f0a13c'
    ctx.fillRect(0, 20, 256, 8)
    drawText(ctx, '24', 128, 110, 132, '#16453a', { align: 'center', weight: '900', font: FONT_LATIN })
    drawText(ctx, 'H', 128, 196, 72, '#16453a', { align: 'center', weight: '900', font: FONT_LATIN })
    ctx.fillStyle = '#0d8264'
    ctx.fillRect(32, 252, 192, 4)
    drawText(ctx, 'OPEN', 128, 300, 44, '#f0a13c', { align: 'center', weight: '800', font: FONT_LATIN, tracking: 4 })
    drawText(ctx, '年中無休', 128, 350, 26, '#3d7d69', { align: 'center' })
  })
}

export function vendingTexture(kind: 0 | 1): CanvasTexture {
  return makeTexture(512, 1024, (ctx) => {
    const hot = kind === 1
    const head = ctx.createLinearGradient(0, 0, 512, 110)
    head.addColorStop(0, hot ? '#b7392f' : '#1f6fa0')
    head.addColorStop(1, hot ? '#7c1f1a' : '#123f60')
    ctx.fillStyle = head
    ctx.fillRect(0, 0, 512, 110)
    drawText(ctx, hot ? 'HOT & COLD' : 'DRINK', 34, 52, 52, '#ffffff', { weight: '900', font: FONT_LATIN, tracking: 2 })
    drawText(ctx, hot ? 'あたたかい飲みもの' : 'つめた〜い飲みもの', 34, 92, 24, '#cfe8f7')
    ctx.fillStyle = '#f2f7fa'
    ctx.fillRect(0, 110, 512, 650)
    const palette = ['#e2533f', '#2f7fc1', '#f0b52e', '#4caf72', '#7c5cd6', '#ef7fa8', '#ffffff', '#2d3a46']
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const cx = 64 + col * 128
        const cy = 208 + row * 186
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(cx - 60, cy - 66, 120, 140)
        ctx.strokeStyle = '#dce7ef'
        ctx.lineWidth = 2
        ctx.strokeRect(cx - 60, cy - 66, 120, 140)
        const can = palette[(row * 4 + col) % palette.length]
        const grad = ctx.createLinearGradient(cx - 28, 0, cx + 28, 0)
        grad.addColorStop(0, 'rgba(0,0,0,0.35)')
        grad.addColorStop(0.35, can)
        grad.addColorStop(0.7, can)
        grad.addColorStop(1, 'rgba(0,0,0,0.3)')
        ctx.fillStyle = grad
        roundRect(ctx, cx - 28, cy - 56, 56, 104, 14)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.fillRect(cx - 28, cy - 20, 56, 26)
        ctx.fillStyle = hot ? '#b7392f' : '#1f6fa0'
        ctx.fillRect(cx - 20, cy - 78, 40, 14)
        drawText(ctx, hot ? 'HOT' : 'COLD', cx + 24, cy - 71, 11, '#ffffff', { align: 'center', weight: '900', font: FONT_LATIN })
        drawText(ctx, '¥130', cx, cy + 66, 24, '#c2410c', { align: 'center', weight: '800', font: FONT_LATIN })
        ctx.fillStyle = hot ? '#c94a3d' : '#2f7fc1'
        ctx.beginPath()
        ctx.arc(cx, cy + 96, 13, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.beginPath()
        ctx.arc(cx, cy + 96, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.fillStyle = '#161f29'
    ctx.fillRect(0, 760, 512, 264)
    ctx.fillStyle = '#0a0f14'
    roundRect(ctx, 40, 796, 260, 74, 10)
    ctx.fill()
    ctx.fillStyle = '#203244'
    roundRect(ctx, 40, 796, 260, 22, 8)
    ctx.fill()
    ctx.fillStyle = '#e7edf2'
    roundRect(ctx, 340, 792, 120, 120, 8)
    ctx.fill()
    drawText(ctx, '100', 400, 830, 34, '#27313c', { align: 'center', weight: '900', font: FONT_LATIN })
    ctx.fillStyle = '#0a0f14'
    roundRect(ctx, 360, 852, 80, 16, 5)
    ctx.fill()
    drawText(ctx, 'つり銭', 400, 894, 20, '#27313c', { align: 'center' })
    drawText(ctx, hot ? 'HOSHIZORA COFFEE' : 'HOSHIZORA DRINK', 256, 960, 26, '#9fb6c8', { align: 'center', tracking: 4, font: FONT_LATIN })
    drawText(ctx, '24時間 いつでも', 256, 998, 18, '#6f8ba0', { align: 'center' })
  })
}

export function posterTexture(kind: number): CanvasTexture {
  return makeTexture(256, 384, (ctx) => {
    const themes = [
      ['#2f7a5b', '#7fd3a6', '#fff3cf'],
      ['#4a2f24', '#c98a58', '#ffe3b8'],
      ['#c1502c', '#f0a13c', '#fff0d0'],
      ['#1f4b82', '#5fa8e0', '#eaf5ff'],
    ]
    const [bg, accent, cream] = themes[kind % 4]
    const g = ctx.createLinearGradient(0, 0, 0, 384)
    g.addColorStop(0, bg)
    g.addColorStop(1, accent)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 384)
    ctx.globalAlpha = 0.18
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.arc(30 + i * 52, 60 + (i % 2) * 22, 40 + i * 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 3
    ctx.strokeRect(10, 10, 236, 364)

    if (kind % 4 === 0) {
      ctx.fillStyle = cream
      ctx.beginPath()
      ctx.moveTo(128, 96)
      ctx.lineTo(196, 200)
      ctx.lineTo(60, 200)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#20342d'
      ctx.fillRect(110, 150, 36, 38)
      drawText(ctx, 'おにぎり', 128, 250, 44, cream, { align: 'center', weight: '900' })
      drawText(ctx, '¥110', 128, 304, 52, '#ffd166', { align: 'center', weight: '900', font: FONT_LATIN })
      drawText(ctx, '新発売', 128, 348, 22, cream, { align: 'center', tracking: 6 })
    } else if (kind % 4 === 1) {
      ctx.fillStyle = '#f6ead6'
      roundRect(ctx, 78, 120, 100, 120, 14)
      ctx.fill()
      ctx.strokeStyle = '#f6ead6'
      ctx.lineWidth = 5
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(108 + i * 20, 104)
        ctx.bezierCurveTo(98 + i * 20, 84, 118 + i * 20, 76, 108 + i * 20, 56)
        ctx.stroke()
      }
      drawText(ctx, 'あったか', 128, 276, 42, '#fff3cf', { align: 'center', weight: '900' })
      drawText(ctx, 'コーヒー', 128, 322, 42, '#fff3cf', { align: 'center', weight: '900' })
      drawText(ctx, 'HOT 150', 128, 358, 22, '#f0c48a', { align: 'center', tracking: 3, font: FONT_LATIN })
    } else if (kind % 4 === 2) {
      ctx.fillStyle = '#f6d488'
      ctx.beginPath()
      ctx.ellipse(128, 170, 66, 52, 0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#8a3b1f'
      ctx.beginPath()
      ctx.ellipse(118, 174, 44, 32, 0.3, 0, Math.PI * 2)
      ctx.fill()
      drawText(ctx, 'からあげ', 128, 262, 46, '#fff4dc', { align: 'center', weight: '900' })
      drawText(ctx, '3個 ¥180', 128, 312, 34, '#ffe0a3', { align: 'center', weight: '900' })
      drawText(ctx, 'できたて', 128, 352, 22, '#fff4dc', { align: 'center', tracking: 8 })
    } else {
      drawText(ctx, 'ATM', 128, 156, 88, '#eaf5ff', { align: 'center', weight: '900', font: FONT_LATIN })
      drawText(ctx, '24時間', 128, 222, 34, '#eaf5ff', { align: 'center' })
      drawText(ctx, 'お使いいただけます', 128, 270, 18, '#cfe6ff', { align: 'center' })
      ctx.fillStyle = 'rgba(234,245,255,0.2)'
      roundRect(ctx, 48, 300, 160, 34, 8)
      ctx.fill()
      drawText(ctx, '¥ 引き出し', 128, 318, 18, '#eaf5ff', { align: 'center' })
    }
  })
}

export function magazineTexture(strip: number): CanvasTexture {
  return makeTexture(1024, 240, (ctx) => {
    ctx.fillStyle = '#c9c2b4'
    ctx.fillRect(0, 0, 1024, 240)
    const covers = [
      ['#e05c5c', '月刊 街角', '#fff4e8'],
      ['#2c6f8a', '暮らし', '#dff2f8'],
      ['#d9a13c', '旅の手帖', '#fff6dc'],
      ['#6c5aa8', 'アニメ', '#efe6ff'],
      ['#3f7f5a', '週刊 山', '#e6f6e8'],
      ['#b34e7e', 'ファッション', '#ffe9f2'],
    ]
    for (let i = 0; i < 4; i++) {
      const x = 6 + i * 253
      const c = covers[(strip * 4 + i) % covers.length]
      ctx.fillStyle = c[0]
      ctx.fillRect(x, 8, 241, 224)
      ctx.fillStyle = c[1]
      ctx.fillRect(x + 10, 24, 221, 46)
      drawText(ctx, c[1], x + 120, 48, 30, c[2], { align: 'center', weight: '900' })
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.beginPath()
      ctx.arc(x + 120, 140, 58, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = c[2]
      ctx.fillRect(x + 18, 190, 150, 8)
      ctx.fillRect(x + 18, 206, 108, 6)
      drawText(ctx, '¥680', x + 200, 208, 20, c[2], { align: 'center', weight: '800', font: FONT_LATIN })
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(x + 4, 8, 4, 224)
    }
  })
}

export function interiorFloorTexture(repeat: number): CanvasTexture {
  return makeTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#d6cbb4'
    ctx.fillRect(0, 0, 512, 512)
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const v = 0.94 + Math.random() * 0.1
        ctx.fillStyle = `rgb(${Math.round(214 * v)},${Math.round(203 * v)},${Math.round(180 * v)})`
        ctx.fillRect(tx * 128 + 2, ty * 128 + 2, 124, 124)
        ctx.strokeStyle = '#b6a88c'
        ctx.lineWidth = 3
        ctx.strokeRect(tx * 128 + 2, ty * 128 + 2, 124, 124)
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.lineWidth = 1
        ctx.strokeRect(tx * 128 + 5, ty * 128 + 5, 118, 118)
      }
    }
    speckle(ctx, 512, 512, 900, ['rgba(120,100,70,0.1)', 'rgba(255,250,235,0.2)'], 1.5)
  }, [repeat, repeat])
}

export function decalTexture(): CanvasTexture {
  return makeTexture(256, 640, (ctx) => {
    ctx.clearRect(0, 0, 256, 640)
    ctx.fillStyle = 'rgba(12,122,90,0.88)'
    ctx.beginPath()
    ctx.moveTo(128, 10)
    ctx.lineTo(222, 130)
    ctx.lineTo(166, 130)
    ctx.lineTo(166, 300)
    ctx.lineTo(90, 300)
    ctx.lineTo(90, 130)
    ctx.lineTo(34, 130)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 6
    ctx.stroke()
    drawText(ctx, 'おにぎり', 128, 370, 40, '#0c7a5a', { align: 'center', weight: '900' })
    drawText(ctx, 'おべんとう', 128, 424, 40, '#0c7a5a', { align: 'center', weight: '900' })
    drawText(ctx, '¥110〜', 128, 490, 38, '#f0a13c', { align: 'center', weight: '900' })
    drawText(ctx, 'HOSHIZORA MART', 128, 550, 18, 'rgba(12,122,90,0.55)', { align: 'center', tracking: 4, font: FONT_LATIN })
  })
}

export function doormatTexture(): CanvasTexture {
  return makeTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#2b2e39'
    ctx.fillRect(0, 0, 512, 256)
    ctx.strokeStyle = '#454a5a'
    ctx.lineWidth = 8
    ctx.strokeRect(14, 14, 484, 228)
    ctx.strokeStyle = '#3a3e4c'
    ctx.setLineDash([6, 6])
    ctx.lineWidth = 3
    ctx.strokeRect(30, 30, 452, 196)
    ctx.setLineDash([])
    drawText(ctx, 'WELCOME', 256, 104, 62, '#e8e2d2', { align: 'center', weight: '800', font: FONT_LATIN, tracking: 8 })
    drawText(ctx, 'いらっしゃいませ', 256, 176, 34, '#c9b98d', { align: 'center' })
  })
}

export function boardTexture(): CanvasTexture {
  return makeTexture(512, 384, (ctx) => {
    ctx.fillStyle = '#a97b4f'
    ctx.fillRect(0, 0, 512, 384)
    speckle(ctx, 512, 384, 1500, ['rgba(70,45,25,0.22)', 'rgba(255,225,180,0.15)'], 2.2)
    ctx.fillStyle = '#6f4c2c'
    ctx.fillRect(0, 0, 512, 28)
    ctx.fillRect(0, 356, 512, 28)
    const papers = [
      [30, 60, 0.06, '#f6f1e2'],
      [180, 44, -0.04, '#fdf7e8'],
      [330, 70, 0.03, '#fffdf2'],
      [66, 200, -0.03, '#f2ecdc'],
      [214, 222, 0.05, '#fff8e0'],
      [366, 196, -0.06, '#f8f2e0'],
    ] as const
    papers.forEach(([x, y, rot, color]) => {
      ctx.save()
      ctx.translate(x + 60, y + 70)
      ctx.rotate(rot)
      ctx.fillStyle = color
      ctx.fillRect(-58, -70, 116, 140)
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      ctx.fillRect(-58, 64, 116, 6)
      ctx.fillStyle = '#b0aa9a'
      for (let i = 0; i < 6; i++) ctx.fillRect(-44, -46 + i * 18, 74 - (i % 3) * 16, 5)
      ctx.fillStyle = '#c94f4f'
      ctx.beginPath()
      ctx.arc(0, -62, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })
  })
}

export function stopSignTexture(): CanvasTexture {
  return makeTexture(256, 256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256)
    ctx.fillStyle = '#c9302c'
    ctx.beginPath()
    ctx.moveTo(128, 224)
    ctx.lineTo(18, 28)
    ctx.lineTo(238, 28)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#f7f2e6'
    ctx.lineWidth = 12
    ctx.beginPath()
    ctx.moveTo(128, 200)
    ctx.lineTo(36, 44)
    ctx.lineTo(220, 44)
    ctx.closePath()
    ctx.stroke()
    drawText(ctx, '止まれ', 128, 96, 40, '#f7f2e6', { align: 'center', weight: '900' })
    drawText(ctx, 'STOP', 128, 140, 22, '#f7f2e6', { align: 'center', weight: '900', font: FONT_LATIN, tracking: 4 })
  })
}

export function parkingSignTexture(): CanvasTexture {
  return makeTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#1e4f9c'
    ctx.fillRect(0, 0, 256, 256)
    ctx.strokeStyle = '#e8f1ff'
    ctx.lineWidth = 10
    ctx.strokeRect(10, 10, 236, 236)
    drawText(ctx, 'P', 128, 118, 148, '#ffffff', { align: 'center', weight: '900', font: FONT_LATIN })
    drawText(ctx, '駐車場', 128, 210, 32, '#dceaff', { align: 'center' })
  })
}

export function roadPaintTexture(): CanvasTexture {
  return makeTexture(256, 256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256)
    drawText(ctx, 'P', 128, 132, 210, 'rgba(230,238,246,0.9)', { align: 'center', weight: '900', font: FONT_LATIN })
  })
}

export function plateTexture(): CanvasTexture {
  return makeTexture(1024, 160, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 1024, 160)
    g.addColorStop(0, '#c9a45c')
    g.addColorStop(0.45, '#e2c27e')
    g.addColorStop(0.7, '#a9853f')
    g.addColorStop(1, '#8a6a33')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1024, 160)
    ctx.strokeStyle = 'rgba(60,42,18,0.55)'
    ctx.lineWidth = 6
    ctx.strokeRect(10, 10, 1004, 140)
    drawText(ctx, '雨夜 · ほしぞらマート', 60, 72, 52, '#3b2a12', { weight: '900' })
    drawText(ctx, 'HOSHIZORA MART — RAINY CORNER', 64, 122, 24, '#5a4420', { tracking: 4, font: FONT_LATIN, weight: '700' })
    drawText(ctx, '1 / 1', 940, 80, 30, '#3b2a12', { align: 'right', weight: '800', font: FONT_LATIN })
    for (const x of [24, 1000]) {
      for (const y of [24, 136]) {
        ctx.fillStyle = '#6f5326'
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  })
}

export function dropletTexture(): CanvasTexture {
  return makeTexture(256, 512, (ctx) => {
    ctx.clearRect(0, 0, 256, 512)
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 512
      const r = Math.random() * 2.6 + 0.8
      const a = 0.35 + Math.random() * 0.5
      const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0.2, x, y, r)
      g.addColorStop(0, `rgba(255,255,255,${a})`)
      g.addColorStop(0.6, `rgba(210,235,255,${a * 0.6})`)
      g.addColorStop(1, 'rgba(160,200,230,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * (1 + Math.random() * 0.6), 0, 0, Math.PI * 2)
      ctx.fill()
      if (Math.random() < 0.22) {
        ctx.strokeStyle = `rgba(220,240,255,${0.18 + Math.random() * 0.2})`
        ctx.lineWidth = 0.8 + Math.random()
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + (Math.random() - 0.5) * 3, y + 24 + Math.random() * 70)
        ctx.stroke()
      }
    }
  })
}

export function rippleTexture(): CanvasTexture {
  return makeTexture(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128)
    const g = ctx.createRadialGradient(64, 64, 30, 64, 64, 60)
    g.addColorStop(0, 'rgba(200,225,255,0)')
    g.addColorStop(0.62, 'rgba(210,235,255,0.7)')
    g.addColorStop(0.78, 'rgba(230,245,255,0.25)')
    g.addColorStop(1, 'rgba(200,225,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(64, 64, 62, 0, Math.PI * 2)
    ctx.fill()
  })
}

export function glowTexture(): CanvasTexture {
  return makeTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.16)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  })
}

export function streakTexture(): CanvasTexture {
  const tex = makeTexture(128, 512, (ctx) => {
    const v = ctx.createLinearGradient(0, 0, 0, 512)
    v.addColorStop(0, 'rgba(255,255,255,0.95)')
    v.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    v.addColorStop(0.7, 'rgba(255,255,255,0.12)')
    v.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, 128, 512)
    ctx.globalCompositeOperation = 'destination-in'
    const h = ctx.createLinearGradient(0, 0, 128, 0)
    h.addColorStop(0, 'rgba(255,255,255,0)')
    h.addColorStop(0.28, 'rgba(255,255,255,0.8)')
    h.addColorStop(0.5, 'rgba(255,255,255,1)')
    h.addColorStop(0.72, 'rgba(255,255,255,0.8)')
    h.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = h
    ctx.fillRect(0, 0, 128, 512)
  })
  return tex
}

export function woodTexture(): CanvasTexture {
  return makeTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#2a1c16'
    ctx.fillRect(0, 0, 512, 512)
    for (let p = 0; p < 4; p++) {
      ctx.fillStyle = p % 2 ? 'rgba(255,220,180,0.035)' : 'rgba(0,0,0,0.06)'
      ctx.fillRect(0, p * 128, 512, 128)
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, p * 128)
      ctx.lineTo(512, p * 128)
      ctx.stroke()
    }
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(${120 + Math.random() * 60},${80 + Math.random() * 30},${50 + Math.random() * 20},0.16)`
      ctx.lineWidth = 1 + Math.random() * 2
      ctx.beginPath()
      const y = Math.random() * 512
      ctx.moveTo(0, y)
      for (let x = 0; x <= 512; x += 64) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 6)
      ctx.stroke()
    }
  }, [4, 1])
}

export function roofTileTexture(): CanvasTexture {
  return makeTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#3a4150'
    ctx.fillRect(0, 0, 256, 256)
    for (let row = 0; row < 8; row++) {
      const y = row * 32
      ctx.fillStyle = row % 2 ? 'rgba(20,24,34,0.45)' : 'rgba(90,102,125,0.22)'
      ctx.fillRect(0, y, 256, 6)
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(0, y + 26, 256, 6)
      for (let col = 0; col < 8; col++) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)'
        ctx.fillRect(col * 32 + (row % 2) * 16, y, 2, 32)
      }
    }
    speckle(ctx, 256, 256, 400, ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.2)'], 1.6)
  }, [3, 3])
}

export function neonTexture(): CanvasTexture {
  return makeTexture(512, 256, (ctx) => {
    ctx.clearRect(0, 0, 512, 256)
    ctx.strokeStyle = 'rgba(255,95,162,0.14)'
    ctx.lineWidth = 10
    ctx.strokeRect(18, 18, 476, 220)
    ctx.shadowColor = '#ff5fa2'
    ctx.shadowBlur = 26
    drawText(ctx, 'こもれび', 256, 112, 84, '#ffd0e4', { align: 'center', weight: '900' })
    ctx.shadowBlur = 18
    drawText(ctx, 'BAR', 256, 190, 44, '#ff9cc4', { align: 'center', weight: '900', font: FONT_LATIN, tracking: 12 })
    ctx.shadowBlur = 0
  })
}

export function bannerTexture(): CanvasTexture {
  return makeTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#fbf6e8'
    ctx.fillRect(0, 0, 512, 256)
    ctx.fillStyle = '#0d8264'
    ctx.fillRect(0, 0, 512, 18)
    ctx.fillStyle = '#f0a13c'
    ctx.fillRect(0, 18, 512, 8)
    drawText(ctx, 'おにぎり', 250, 96, 70, '#16453a', { align: 'center', weight: '900' })
    drawText(ctx, '¥110', 250, 172, 64, '#d9731f', { align: 'center', weight: '900', font: FONT_LATIN })
    drawText(ctx, 'HOSHIZORA MART', 250, 224, 20, '#5c8b7a', { align: 'center', tracking: 5, font: FONT_LATIN })
    ctx.strokeStyle = 'rgba(120,100,70,0.35)'
    ctx.lineWidth = 2
    ctx.strokeRect(8, 8, 496, 240)
  })
}

export function binTexture(kind: number): CanvasTexture {
  return makeTexture(256, 160, (ctx) => {
    ctx.fillStyle = '#f1ece0'
    ctx.fillRect(0, 0, 256, 160)
    const labels = ['かん', 'ペットボトル', 'もえるゴミ']
    const colors = ['#2f7fc1', '#3f9e6a', '#d9843a']
    ctx.fillStyle = colors[kind % 3]
    ctx.fillRect(0, 0, 256, 30)
    drawText(ctx, labels[kind % 3], 128, 92, 36, '#2c2f38', { align: 'center', weight: '900' })
    drawText(ctx, ['CANS', 'PET', 'BURN'][kind % 3], 128, 132, 20, '#6c7180', { align: 'center', tracking: 4, font: FONT_LATIN })
    ctx.strokeStyle = '#c9c2b2'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, 252, 156)
  })
}

export function screenTexture(kind: 'pos' | 'atm'): CanvasTexture {
  return makeTexture(256, 256, (ctx) => {
    if (kind === 'pos') {
      ctx.fillStyle = '#071a18'
      ctx.fillRect(0, 0, 256, 256)
      ctx.fillStyle = '#0e2f2a'
      ctx.fillRect(0, 0, 256, 34)
      drawText(ctx, 'POS', 14, 17, 20, '#7ff0c8', { font: FONT_LATIN, weight: '800' })
      drawText(ctx, '21:42', 240, 17, 18, '#7ff0c8', { align: 'right', font: FONT_LATIN })
      const rows = [['おにぎり', '110'], ['コーヒー', '150'], ['からあげ', '180'], ['お茶', '130']]
      rows.forEach(([name, price], i) => {
        drawText(ctx, name, 16, 62 + i * 40, 22, '#cfe9de')
        drawText(ctx, price, 240, 62 + i * 40, 22, '#cfe9de', { align: 'right', font: FONT_LATIN })
      })
      ctx.fillStyle = '#7ff0c8'
      ctx.fillRect(12, 216, 232, 2)
      drawText(ctx, '合計', 16, 238, 20, '#8fd8c0')
      drawText(ctx, '¥570', 240, 238, 28, '#7ff0c8', { align: 'right', weight: '900', font: FONT_LATIN })
    } else {
      ctx.fillStyle = '#0a2b4c'
      ctx.fillRect(0, 0, 256, 256)
      ctx.fillStyle = '#0e3d69'
      ctx.fillRect(0, 0, 256, 22)
      drawText(ctx, 'HOSHIZORA BANK', 128, 12, 13, '#9fd4ff', { align: 'center', tracking: 2, font: FONT_LATIN })
      drawText(ctx, 'ATM', 128, 108, 84, '#eaf7ff', { align: 'center', weight: '900', font: FONT_LATIN })
      drawText(ctx, '24時間 ご利用ください', 128, 166, 18, '#b9dcf5', { align: 'center' })
      ctx.fillStyle = '#2f8fe0'
      roundRect(ctx, 62, 194, 132, 22, 6)
      ctx.fill()
      drawText(ctx, 'お引き出し', 128, 205, 13, '#ffffff', { align: 'center' })
    }
  })
}

export function clockTexture(): CanvasTexture {
  return makeTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#f2ede0'
    ctx.beginPath()
    ctx.arc(128, 128, 118, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#39404e'
    ctx.lineWidth = 10
    ctx.stroke()
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.strokeStyle = '#39404e'
      ctx.lineWidth = i % 3 === 0 ? 8 : 4
      ctx.beginPath()
      ctx.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96)
      ctx.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110)
      ctx.stroke()
    }
    // 21:42
    const hourA = ((21 % 12) / 12) * Math.PI * 2 + (42 / 60) * (Math.PI / 6) - Math.PI / 2
    const minA = (42 / 60) * Math.PI * 2 - Math.PI / 2
    ctx.strokeStyle = '#22303a'
    ctx.lineWidth = 12
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(128, 128)
    ctx.lineTo(128 + Math.cos(hourA) * 54, 128 + Math.sin(hourA) * 54)
    ctx.stroke()
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.moveTo(128, 128)
    ctx.lineTo(128 + Math.cos(minA) * 82, 128 + Math.sin(minA) * 82)
    ctx.stroke()
    ctx.fillStyle = '#22303a'
    ctx.beginPath()
    ctx.arc(128, 128, 9, 0, Math.PI * 2)
    ctx.fill()
    drawText(ctx, 'HOSHIZORA', 128, 172, 12, '#7d8494', { align: 'center', tracking: 2, font: FONT_LATIN })
  })
}

export function streetPlateTexture(): CanvasTexture {
  return makeTexture(512, 128, (ctx) => {
    ctx.fillStyle = '#1c4078'
    ctx.fillRect(0, 0, 512, 128)
    ctx.strokeStyle = '#dbe8f8'
    ctx.lineWidth = 6
    ctx.strokeRect(6, 6, 500, 116)
    drawText(ctx, 'ほしぞら 2丁目', 256, 58, 44, '#eef5ff', { align: 'center', weight: '900' })
    drawText(ctx, 'HOSHIZORA 2', 256, 104, 18, '#b9d2ef', { align: 'center', tracking: 4, font: FONT_LATIN })
  })
}

export function glassMaterial(tint = 0x9fd0e2, opacity = 0.14): MeshBasicMaterial {
  // hand-tinted anime glass: no specular lobe, so no blown highlights to fight with
  return new MeshBasicMaterial({
    color: tint,
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  })
}

export function emissiveMapMaterial(tex: Texture, color = 0xffffff): MeshBasicMaterial {
  return new MeshBasicMaterial({ map: tex, color, toneMapped: false })
}
