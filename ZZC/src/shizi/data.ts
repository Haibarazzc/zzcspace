export type PoseId = 'stand' | 'cheer' | 'glance'
export type ViewMode = 'overview' | 'front' | 'side' | 'top'
export type CameraShot = { mode: ViewMode; focus: number | null; revision: number }

export const features = [
  { name: '日轮鬃', en: 'SUNBURST MANE', note: '鬃毛', copy: '鬃如日轮，向光而生。', detail: '一圈圆钝的金黄鬃刺包住白脸，上沿更亮，下沿收回橙色。这是六视图里最先被认出来的轮廓。', point: [0, 2.1, -0.1] as [number, number, number], camera: [1.7, 2.35, 3.3] as [number, number, number] },
  { name: '额上新', en: 'FOREHEAD TUFT', note: '额饰', copy: '额前一束，尖尖地亮着。', detail: '额头正中另立一簇更浅的金黄毛束，心形尖角朝上，把“新”收成一个可以被看见的记号。', point: [0, 2.9, 0.18] as [number, number, number], camera: [0.45, 2.95, 2.1] as [number, number, number] },
  { name: '笑颜', en: 'OPEN SMILE', note: '表情', copy: '圆眼亮着，舌尖带着笑。', detail: '深棕圆眼、一点高光、小巧鼻头，还有张开的嘴和粉舌。静立与欢呼两套六视图用的是同一张脸。', point: [0, 1.9, 0.75] as [number, number, number], camera: [0.3, 1.92, 2.35] as [number, number, number] },
  { name: '院徽', en: 'COLLEGE MARK', note: '胸口', copy: '胸口一枚，写着致新书院。', detail: '橙黄金身子的前胸印着致新书院院徽：左侧羽叶，右侧“致新书院”和 ZHIXIN COLLEGE , SUSTech。身子短、肚子圆，站直时院徽正好落在视线中央。', point: [0, 1.05, 0.48] as [number, number, number], camera: [0.15, 1.08, 1.95] as [number, number, number] },
  { name: '短肢', en: 'STUBBY LIMBS', note: '手脚', copy: '手短腿短，站成一团暖意。', detail: '静立时双臂垂在身侧，欢呼时一起举过头顶，掌心向前。腿很短，脚尖三粒小趾，把重心稳稳放在台座上。', point: [0.72, 0.75, 0.2] as [number, number, number], camera: [1.9, 0.95, 2.15] as [number, number, number] },
  { name: '尾穗', en: 'TAIL TUFT', note: '尾巴', copy: '尾尖一束深色，把身影收住。', detail: '细尾从身侧绕出，末梢是一撮更深的橙红。正视图里它露在右侧，转过去才能看清整条弧线。', point: [1.05, 1.15, -0.36] as [number, number, number], camera: [2.4, 1.5, -1.9] as [number, number, number] },
] as const

export const links = [
  { label: '走进樱花古境', url: '/qixia/', note: '另一座三维庭院' },
  { label: '认识曾子丞', url: '/about/', note: '关于我' },
  { label: '返回首页', url: '/', note: '门户' },
  { label: '打开校园地图', url: '/map/', note: '南科大' },
  { label: '听一首歌', url: '/music/', note: '音乐馆' },
  { label: '阅读博客', url: '/blog/', note: '文章' },
] as const

export const poses = {
  stand: { label: '静立', sub: '六视之静', background: '#3a332c', sun: '#fff0d0', sunPower: 2.8, ambient: 0.72, lamp: 0.4, exposure: 1.02, position: [3.4, 6.4, 4.6] as [number, number, number] },
  cheer: { label: '欢呼', sub: '举臂向光', background: '#4c3b2c', sun: '#ffc48a', sunPower: 3.3, ambient: 0.88, lamp: 0.85, exposure: 1.06, position: [2.4, 7.2, 4.8] as [number, number, number] },
  glance: { label: '回望', sub: '侧身回眸', background: '#1b1926', sun: '#d5def8', sunPower: 1.45, ambient: 0.4, lamp: 1.5, exposure: 0.98, position: [-4.2, 5.4, -2.2] as [number, number, number] },
}
