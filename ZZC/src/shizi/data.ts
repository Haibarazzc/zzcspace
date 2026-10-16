export type PoseId = 'stand' | 'cheer' | 'glance'
export type ViewMode = 'overview' | 'front' | 'side' | 'top'
export type CameraShot = { mode: ViewMode; focus: number | null; revision: number }

export const features = [
  { name: '日轮鬃', en: 'SUNBURST MANE', note: '鬃毛', copy: '鬃如日轮，向光而生。', detail: '层层鬃瓣环住笑脸，暖橙色呼应南科大视觉标识。像向阳展开的日轮，把朝气与乐观写进狮小新的每一次亮相。', point: [0.9, 2.35, 0.04] as [number, number, number], camera: [1.7, 2.35, 3.8] as [number, number, number] },
  { name: '额上新', en: 'FOREHEAD TUFT', note: '额饰', copy: '额前一束，尖尖地亮着。', detail: '额前的毛饰向上舒展，与形象中融入的“新”字一起，呼应致新书院“致新”的初心，也延续南科大敢于探索的创新基因。', point: [0, 2.63, 0.68] as [number, number, number], camera: [0.45, 2.65, 3.4] as [number, number, number] },
  { name: '笑颜', en: 'OPEN SMILE', note: '表情', copy: '圆眼亮着，舌尖带着笑。', detail: '深棕圆眼映着两点微光，白牙与粉舌托起明亮的笑容。圆鼓鼓的脸颊少了距离感，让阳光与乐观有了亲近的模样。', point: [0, 1.93, 0.88] as [number, number, number], camera: [0.3, 1.94, 3.85] as [number, number, number] },
  { name: '院徽', en: 'COLLEGE MARK', note: '胸口', copy: '胸口一枚，写着致新书院。', detail: '胸前的院徽写着致新书院，也让狮子的寓意有了归处：以勇气面对未知，以担当凝聚同伴，在共同成长中涵养领导力。', point: [0, 0.92, 0.54] as [number, number, number], camera: [0.15, 0.96, 2.85] as [number, number, number] },
  { name: '短肢', en: 'STUBBY LIMBS', note: '手脚', copy: '手短腿短，站成一团暖意。', detail: '短短的双臂举起欢呼，也延续原画中的亲切姿态。白色手套象征友善与礼貌，以包容之心传递书院的人文温度。', point: [0.6, 0.76, 0.25] as [number, number, number], camera: [1.9, 0.98, 2.4] as [number, number, number] },
  { name: '尾穗', en: 'TAIL TUFT', note: '尾巴', copy: '细尾弯成一笔，把身影收住。', detail: '细尾从背后弯出，末梢收成棕色的尖尖一束。正面能看见它露在身侧，绕到背后，弧线与连接的位置便都清楚了。', point: [1.04, 0.62, -0.68] as [number, number, number], camera: [2.4, 1.1, -2.5] as [number, number, number] },
] as const


export const poses = {
  stand: { label: '静立', sub: '六视之静', background: '#c4cebf', sun: '#fff0d0', sunPower: 2.8, ambient: 0.72, lamp: 0.4, exposure: 1.02, position: [3.4, 6.4, 4.6] as [number, number, number] },
  cheer: { label: '欢呼', sub: '举手向光', background: '#d8cbb2', sun: '#ffc48a', sunPower: 3.3, ambient: 0.88, lamp: 0.85, exposure: 1.06, position: [2.4, 7.2, 4.8] as [number, number, number] },
  glance: { label: '回望', sub: '侧面看狮', background: '#344459', sun: '#d5def8', sunPower: 1.45, ambient: 0.4, lamp: 1.5, exposure: 0.98, position: [-4.2, 5.4, -2.2] as [number, number, number] },
}
