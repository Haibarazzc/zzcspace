export type TimeOfDay = 'dawn' | 'dusk' | 'night'
export type ViewMode = 'overview' | 'axis' | 'top'
export type CameraShot = { mode: ViewMode; focus: number | null; revision: number }

// An imagined courtyard inspired by traditional Chinese architecture, not a survey model.
export const landmarks = [
  { name: '星晖殿', en: 'HALL OF XINGHUI', kind: '重檐庑殿', x: 0, z: -5.8, height: 10.8, width: 11, depth: 7.2, copy: '金瓦重檐，巍峨出岫。', detail: '循中轴而上，层层台基托起殿宇。朱柱与金色屋脊相映，构成整座宫苑的视觉中心。', feature: '重檐 · 金瓦 · 须弥座' },
  { name: '流光亭', en: 'PAVILION OF LIGHT', kind: '攒尖亭阁', x: 0, z: 2.4, height: 5.1, width: 4.5, depth: 4.5, copy: '一亭静立，四面生风。', detail: '四面通透的亭阁坐落庭心。移步换景之间，梁柱与层叠飞檐勾勒出轻盈的轮廓。', feature: '攒尖 · 通透 · 飞檐' },
  { name: '启程门', en: 'GATE OF BEGINNINGS', kind: '三间山门', x: 0, z: 10, height: 4.6, width: 10.3, depth: 2.9, copy: '一门开境，万象徐来。', detail: '三开间山门展开宫苑的序章。从门洞望向中轴，近处灯火与远处金殿层层递进。', feature: '三间 · 门阙 · 中轴' },
  { name: '求知塔', en: 'PAGODA OF CURIOSITY', kind: '五层楼阁塔', x: -8.7, z: -8.3, height: 12, width: 4.4, depth: 4.4, copy: '塔影入云，松声入夜。', detail: '五层塔檐逐级收分，在西侧形成挺拔的天际线。每层窗格透出暖光，照亮青瓦的边缘。', feature: '五层 · 收分 · 青瓦' },
  { name: '远望塔', en: 'PAGODA OF TOMORROW', kind: '五层楼阁塔', x: 8.7, z: -8.3, height: 12, width: 4.4, depth: 4.4, copy: '月过重檐，灯映千窗。', detail: '东塔与求知塔遥相呼应。环绕观察，能看见塔身、殿顶与围墙在不同角度交错叠合。', feature: '对景 · 灯窗 · 塔刹' },
  { name: '数理阁', en: 'PAVILION OF REASON', kind: '歇山侧殿', x: -8.1, z: -0.8, height: 5.4, width: 5.1, depth: 4.5, copy: '半阁藏书，一窗听雨。', detail: '西侧殿阁以青瓦与深木色收敛气息。密集窗棂和檐下斗拱，藏着值得靠近观看的细节。', feature: '歇山 · 窗棂 · 斗拱' },
  { name: '听风阁', en: 'PAVILION OF MELODIES', kind: '歇山侧殿', x: 8.1, z: -0.8, height: 5.4, width: 5.1, depth: 4.5, copy: '香浮静院，光落朱栏。', detail: '东侧殿阁与数理阁相对，围合出宽阔的庭院。暖色窗光将石阶与木栏连成一条安静的边界。', feature: '对称 · 石阶 · 朱栏' },
  { name: '山野轩', en: 'HOUSE OF WANDERINGS', kind: '临池轩榭', x: -8.1, z: 6, height: 4.6, width: 5, depth: 3.8, copy: '池映檐角，风过莲叶。', detail: '临水小轩与前庭荷池相伴。低垂的檐口让建筑尺度变得亲切，也让远处的塔影更显高峻。', feature: '临水 · 荷池 · 低檐' },
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
  dawn: { label: '晨曦', sub: '薄雾初开', background: '#243541', fog: '#536169', sun: '#ffe3af', sunPower: 3.1, ambient: 1.05, lamp: .75, exposure: 1.05, position: [-22, 18, 8] as [number,number,number] },
  dusk: { label: '日暮', sub: '金风入檐', background: '#101e29', fog: '#283d48', sun: '#ffc27c', sunPower: 2.7, ambient: .65, lamp: 2.8, exposure: 1.02, position: [-18, 22, 16] as [number,number,number] },
  night: { label: '月夜', sub: '万籁有光', background: '#060f1c', fog: '#162a3a', sun: '#a7c9ec', sunPower: 1.55, ambient: .42, lamp: 4.2, exposure: 1.08, position: [8, 28, -16] as [number,number,number] },
}
