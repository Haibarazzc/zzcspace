// 校园沙盘建筑细节：窗格、勒脚、檐口、女儿墙、入口、屋顶设备。
// 所有建筑的细节按世界坐标烘焙进 2 个合并几何体（实心件 + 玻璃），
// 42 栋建筑只增加 2 个 draw call；细节网格关闭 raycast，指针事件仍落在
// 原来的墙体/屋顶盒子上，hover 高亮、点击选中、标签 sprite 的行为保持不变。
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export interface BuildingSpec {
  category: string
  wx: number
  wz: number
  tall: number
  wide: number
  depth: number
  seed: number
}

export const NO_RAYCAST = () => {}

const FLOOR_H = 2.7
const TRIM = '#e9dfca'
const PLINTH = '#d9cbb1'
const STEP = '#cfc1a6'
const EQUIP = '#d7d3c8'
const EQUIP_DARK = '#b8b3a7'
const GLASS_COLORS = ['#6b8da4', '#7d9fb4', '#5d7f97', '#93b2c4']
const GLASS_LIT = '#d6bf8c'

const colorCache = new Map<string, T.Color>()
function paint(geo: T.BufferGeometry, color: string) {
  let c = colorCache.get(color)
  if (!c) { c = new T.Color(color); colorCache.set(color, c) }
  const n = geo.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
  geo.setAttribute('color', new T.BufferAttribute(arr, 3))
  return geo
}

function addBox(parts: T.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
  const g = new T.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  parts.push(paint(g, color))
}

function addCyl(parts: T.BufferGeometry[], rTop: number, rBottom: number, h: number, x: number, y: number, z: number, color: string, seg = 8) {
  const g = new T.CylinderGeometry(rTop, rBottom, h, seg)
  g.translate(x, y, z)
  parts.push(paint(g, color))
}

// 立面小窗：PlaneGeometry 朝 +Z，rotateY 转到各立面外侧
function addPane(parts: T.BufferGeometry[], w: number, h: number, x: number, y: number, z: number, ry: number, color: string) {
  const g = new T.PlaneGeometry(w, h)
  g.rotateY(ry)
  g.translate(x, y, z)
  parts.push(paint(g, color))
}

function addBuilding(s: BuildingSpec, solids: T.BufferGeometry[], glass: T.BufferGeometry[]) {
  const { category, wx, wz, tall, wide, depth, seed } = s
  const rnd = (n: number) => {
    const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453
    return v - Math.floor(v)
  }
  const frontZ = depth / 2

  // 勒脚：一圈加宽的深色基座，建筑不再是直接插进桌面
  addBox(solids, wide + 0.7, 0.55, depth + 0.7, wx, 0.275, wz, PLINTH)
  // 檐口线脚：屋顶色板下沿一圈收边，避免立面直接撞上屋顶
  addBox(solids, wide + 0.35, 0.18, depth + 0.35, wx, tall - 0.22, wz, TRIM)

  // 女儿墙：沿屋顶色板边缘一圈，把分类色屋顶框成一块可辨的色块
  const py = tall + 0.9 + 0.22
  const px = (wide + 1.2) / 2 - 0.11
  const pz = (depth + 1.2) / 2 - 0.11
  addBox(solids, wide + 1.0, 0.44, 0.22, wx, py, wz + pz, TRIM)
  addBox(solids, wide + 1.0, 0.44, 0.22, wx, py, wz - pz, TRIM)
  addBox(solids, 0.22, 0.44, depth + 1.0, wx + px, py, wz, TRIM)
  addBox(solids, 0.22, 0.44, depth + 1.0, wx - px, py, wz, TRIM)

  // 入口：门洞（勒脚顶面起）+ 两级台阶 + 雨棚，主要楼加雨棚立柱
  addBox(solids, 1.7, 2.2, 0.16, wx, 0.55 + 1.1, wz + frontZ + 0.06, '#8a7663')
  addBox(solids, 3.8, 0.18, 0.7, wx, 0.09, wz + frontZ + 1.05, STEP)
  addBox(solids, 3.4, 0.36, 0.7, wx, 0.18, wz + frontZ + 0.62, STEP)
  addBox(solids, 3.6, 0.22, 1.25, wx, 3.05, wz + frontZ + 0.55, TRIM)
  if (category === 'academic' || category === 'admin') {
    addBox(solids, 0.14, 2.75, 0.14, wx - 1.5, 1.375, wz + frontZ + 1.05, TRIM)
    addBox(solids, 0.14, 2.75, 0.14, wx + 1.5, 1.375, wz + frontZ + 1.05, TRIM)
  }

  // 立面窗：教学/科研/行政用横向窗带（窄框密排），宿舍/运动用小窗阵列
  const punched = category === 'life' || category === 'sports' || category === 'dining'
  const floors = Math.max(1, Math.min(4, Math.round((tall - 1.0) / FLOOR_H)))
  const facades = [
    { width: wide, x: wx, z: wz + frontZ + 0.05, ry: 0, front: true },
    { width: wide, x: wx, z: wz - frontZ - 0.05, ry: Math.PI, front: false },
    { width: depth, x: wx + wide / 2 + 0.05, z: wz, ry: Math.PI / 2, front: false },
    { width: depth, x: wx - wide / 2 - 0.05, z: wz, ry: -Math.PI / 2, front: false },
  ]
  for (const f of facades) {
    const cols = punched
      ? Math.max(2, Math.min(5, Math.round(f.width / 1.9)))
      : Math.max(2, Math.min(7, Math.round(f.width / 1.25)))
    const span = f.width * (punched ? 0.78 : 0.84)
    const cell = span / cols
    const pw = punched ? Math.min(0.8, cell * 0.5) : Math.max(0.35, cell - 0.16)
    const ph = punched ? Math.min(0.95, cell * 0.55) : 0.85
    for (let row = 0; row < floors; row++) {
      const y = 1.55 + row * FLOOR_H
      if (y + ph / 2 > tall - 0.45) continue
      for (let c = 0; c < cols; c++) {
        const lat = -span / 2 + cell * (c + 0.5)
        // 一层正面中间留给门厅/雨棚
        if (f.front && row === 0 && Math.abs(lat) < 1.4) continue
        const lit = rnd(row * 37 + c * 11 + f.ry * 5) > 0.86
        const color = lit ? GLASS_LIT : GLASS_COLORS[(seed + row + c) % GLASS_COLORS.length]
        addPane(glass, pw, ph, f.x + Math.cos(f.ry) * lat, y, f.z - Math.sin(f.ry) * lat, f.ry, color)
      }
    }
  }

  // 屋顶设备：所有设备都落在女儿墙内，保持分类色屋顶仍然可辨
  const roofY = tall + 0.9
  const acCount = category === 'sports' ? 1 : 2
  const acSpots: Array<[number, number]> = [
    [-wide * 0.24, depth * 0.2],
    [wide * 0.24, depth * 0.2],
    [-wide * 0.08, depth * 0.12],
  ]
  for (let i = 0; i < acCount; i++) {
    const [ax, az] = acSpots[(seed + i) % acSpots.length]
    addBox(solids, 1.25, 0.7, 0.95, wx + ax, roofY + 0.35, wz + az, EQUIP)
    addBox(solids, 1.1, 0.08, 0.8, wx + ax, roofY + 0.74, wz + az, EQUIP_DARK)
  }

  if (category === 'academic') {
    // 楼梯间/设备房体块 + 细天线
    addBox(solids, wide * 0.34, 1.1, depth * 0.32, wx - wide * 0.1, roofY + 0.55, wz - depth * 0.2, TRIM)
    addCyl(solids, 0.05, 0.05, 1.8, wx + wide * 0.3, roofY + 0.9, wz - depth * 0.2, '#b3aeb0', 6)
  } else if (category === 'life') {
    // 宿舍屋顶水箱
    addCyl(solids, 0.82, 0.82, 1.15, wx - wide * 0.26, roofY + 0.72, wz - depth * 0.18, '#c7d2d4', 10)
    addBox(solids, 0.3, 0.15, 0.3, wx - wide * 0.26, roofY + 0.07, wz - depth * 0.18, EQUIP_DARK)
  } else if (category === 'dining') {
    // 厨房排烟
    for (const sx of [-1, 1]) {
      addCyl(solids, 0.24, 0.28, 1.3, wx + sx * wide * 0.18, roofY + 0.65, wz - depth * 0.2, '#b9b4a8', 8)
      addBox(solids, 0.72, 0.1, 0.72, wx + sx * wide * 0.18, roofY + 1.33, wz - depth * 0.2, EQUIP_DARK)
    }
  } else if (category === 'sports') {
    // 屋顶天窗（玻璃材质）
    addBox(glass, wide * 0.3, 0.1, depth * 0.24, wx, roofY + 0.05, wz - depth * 0.02, '#9bb8c8')
  } else if (category === 'admin') {
    addBox(solids, wide * 0.32, 1.2, depth * 0.3, wx + wide * 0.1, roofY + 0.6, wz - depth * 0.2, TRIM)
    addCyl(solids, 0.045, 0.045, 3.2, wx - wide * 0.3, roofY + 1.6, wz - depth * 0.18, '#b3aeb0', 6)
    addBox(solids, 0.9, 0.5, 0.04, wx - wide * 0.3, roofY + 3.0, wz - depth * 0.18, '#a8402f')
  }
}

export function buildCampusDetails(specs: BuildingSpec[]) {
  const solids: T.BufferGeometry[] = []
  const glass: T.BufferGeometry[] = []
  for (const spec of specs) addBuilding(spec, solids, glass)
  return {
    solids: mergeGeometries(solids)!,
    glass: mergeGeometries(glass)!,
  }
}
