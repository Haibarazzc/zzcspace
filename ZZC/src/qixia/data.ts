export type TimeOfDay = 'dawn' | 'dusk' | 'night'
export type ViewMode = 'overview' | 'axis' | 'top'
export type CameraShot = { mode: ViewMode; focus: number | null; revision: number }

// An imagined courtyard inspired by traditional Chinese architecture, not a survey model.
export const landmarks = [
  { name: '樱华殿', en: 'HALL OF CHERRY BLOSSOMS', kind: '重檐庑殿', x: 0, z: -5.8, height: 10.8, width: 11, depth: 7.2, copy: '樱云拥殿，花影入檐。', detail: '循落樱石径而上，粉白花树簇拥重檐。温润金瓦与绯色花影相映，将整个春天藏进庭院深处。', feature: '重檐 · 金瓦 · 须弥座' },
  { name: '流光亭', en: 'PAVILION OF LIGHT', kind: '攒尖亭阁', x: 0, z: 2.4, height: 5.1, width: 4.5, depth: 4.5, copy: '花雨穿亭，春风入怀。', detail: '亭阁静立在花树之间。风拂过通透的梁柱，几片落樱旋转着飘向石阶，远近屋檐在花影间轻轻展开。', feature: '攒尖 · 通透 · 飞檐' },
  { name: '启程门', en: 'GATE OF BEGINNINGS', kind: '三间山门', x: 0, z: 10, height: 4.6, width: 10.3, depth: 2.9, copy: '一门春色，万树花开。', detail: '三开间山门展开宫苑的序章。从门洞望向中轴，近处灯火与远处金殿层层递进。', feature: '三间 · 门阙 · 中轴' },
  { name: '求知塔', en: 'PAGODA OF CURIOSITY', kind: '五层楼阁塔', x: -8.7, z: -8.3, height: 12, width: 4.4, depth: 4.4, copy: '塔影穿樱，花香入夜。', detail: '五层塔檐逐级收分，在西侧形成挺拔的天际线。每层窗格透出暖光，照亮青瓦的边缘。', feature: '五层 · 收分 · 青瓦' },
  { name: '远望塔', en: 'PAGODA OF TOMORROW', kind: '五层楼阁塔', x: 8.7, z: -8.3, height: 12, width: 4.4, depth: 4.4, copy: '月过重檐，灯映千窗。', detail: '东塔与求知塔遥相呼应。环绕观察，能看见塔身、殿顶与围墙在不同角度交错叠合。', feature: '对景 · 灯窗 · 塔刹' },
  { name: '数理阁', en: 'PAVILION OF REASON', kind: '歇山侧殿', x: -8.1, z: -0.8, height: 5.4, width: 5.1, depth: 4.5, copy: '半阁藏书，一窗樱雨。', detail: '西侧殿阁以青瓦与深木色收敛气息。密集窗棂和檐下斗拱，藏着值得靠近观看的细节。', feature: '歇山 · 窗棂 · 斗拱' },
  { name: '听风阁', en: 'PAVILION OF MELODIES', kind: '歇山侧殿', x: 8.1, z: -0.8, height: 5.4, width: 5.1, depth: 4.5, copy: '香浮静院，光落朱栏。', detail: '东侧殿阁与数理阁相对，围合出宽阔的庭院。暖色窗光将石阶与木栏连成一条安静的边界。', feature: '对称 · 石阶 · 朱栏' },
  { name: '山野轩', en: 'HOUSE OF WANDERINGS', kind: '临池轩榭', x: -8.1, z: 6, height: 4.6, width: 5, depth: 3.8, copy: '池映花云，风送落樱。', detail: '临水小轩与前庭花树相伴。零星樱瓣漂浮池面，低垂的檐角与粉白树冠一道落入水中的倒影。', feature: '临水 · 荷池 · 低檐' },
  { name: '拾光居', en: 'HOUSE OF MEMORIES', kind: '临池轩榭', x: 8.1, z: 6, height: 4.6, width: 5, depth: 3.8, copy: '山色在望，天地入怀。', detail: '从东南一角回看宫苑，近处池水、亭阁与后方金殿依次展开，成为一幅可缓缓游赏的立体长卷。', feature: '借景 · 叠境 · 园居' },
] as const

export const destinations = [
  { label: '认识曾子丞', url: '/portfolio/about/', note: '关于我' },
  { label: '走进照片墙', url: '/photowall', note: '摄影与光影' },
  { label: '返回博客首页', url: '/', note: '旅程的起点' },
  { label: '探索学术方向', url: '/portfolio/about/#academic', note: '数学与科技' },
  { label: '回望成长旅程', url: '/portfolio/about/#journey', note: '成长与远方' },
  { label: '阅读技术文章', url: '/posts/how-agents-work', note: '逻辑与思考' },
  { label: '听一首喜欢的歌', url: '/music', note: '音乐与共鸣' },
  { label: '了解学习之外', url: '/portfolio/about/#beyond', note: '山野与兴趣' },
  { label: '翻开生活杂谈', url: '/chatter', note: '日常与记录' },
] as const

export const times = {
  dawn: { label: '晨曦', sub: '樱映晨光', background: '#b5bac9', sun: '#ffe0bb', sunPower: 3.8, ambient: .9, lamp: .18, exposure: 1.08, position: [-125, 25, -115] as [number,number,number] },
  dusk: { label: '日暮', sub: '花染暮色', background: '#887387', sun: '#ffb777', sunPower: 3.6, ambient: .6, lamp: 1.05, exposure: 1.06, position: [-110, 23, -125] as [number,number,number] },
  night: { label: '月夜', sub: '月下听樱', background: '#242e49', sun: '#bed3ff', sunPower: 1.3, ambient: .5, lamp: 1.5, exposure: 1.03, position: [-130, 25, -125] as [number,number,number] },
}
