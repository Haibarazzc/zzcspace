// 从 2D 交互地图（ZZC/public/map）提取的 42 个地点，坐标为地图像素
export interface Place { name: string; x: number; y: number; category: string }
export const PLACES: Place[] = [
  {
    name: "欣园",
    x: 1300,
    y: 1027,
    category: "life"
  },
  {
    name: "荔园",
    x: 995,
    y: 1417,
    category: "life"
  },
  {
    name: "创园",
    x: 1129,
    y: 1533,
    category: "life"
  },
  {
    name: "慧园",
    x: 1319,
    y: 1663,
    category: "life"
  },
  {
    name: "学生宿舍",
    x: 713,
    y: 1741,
    category: "life"
  },
  {
    name: "润扬体育馆",
    x: 1406,
    y: 1788,
    category: "sports"
  },
  {
    name: "二期学生公寓",
    x: 665,
    y: 1793,
    category: "life"
  },
  {
    name: "松禾体育场",
    x: 1287,
    y: 1819,
    category: "sports"
  },
  {
    name: "野战场地",
    x: 1404,
    y: 1859,
    category: "sports"
  },
  {
    name: "教工餐厅",
    x: 1245,
    y: 1908,
    category: "dining"
  },
  {
    name: "湖畔生活区",
    x: 837,
    y: 1991,
    category: "life"
  },
  {
    name: "长岭陂",
    x: 2173,
    y: 2048,
    category: "other"
  },
  {
    name: "社康中心",
    x: 979,
    y: 2050,
    category: "life"
  },
  {
    name: "教师公寓",
    x: 1204,
    y: 2084,
    category: "life"
  },
  {
    name: "工学院",
    x: 515,
    y: 2100,
    category: "academic"
  },
  {
    name: "风雨操场",
    x: 869,
    y: 2148,
    category: "sports"
  },
  {
    name: "专家公寓",
    x: 1428,
    y: 2161,
    category: "life"
  },
  {
    name: "医学院",
    x: 1733,
    y: 2163,
    category: "academic"
  },
  {
    name: "学术交流中心",
    x: 1099,
    y: 2211,
    category: "admin"
  },
  {
    name: "人文社科学院",
    x: 1141,
    y: 2315,
    category: "academic"
  },
  {
    name: "南科大中心",
    x: 691,
    y: 2322,
    category: "admin"
  },
  {
    name: "三号门",
    x: 1319,
    y: 2383,
    category: "other"
  },
  {
    name: "学生餐厅",
    x: 673,
    y: 2394,
    category: "dining"
  },
  {
    name: "科研楼",
    x: 377,
    y: 2402,
    category: "academic"
  },
  {
    name: "第一科研楼",
    x: 524,
    y: 2436,
    category: "academic"
  },
  {
    name: "附属医院",
    x: 1446,
    y: 2460,
    category: "other"
  },
  {
    name: "公共教学楼",
    x: 906,
    y: 2486,
    category: "academic"
  },
  {
    name: "第一教学楼",
    x: 606,
    y: 2491,
    category: "academic"
  },
  {
    name: "第二科研楼",
    x: 454,
    y: 2502,
    category: "academic"
  },
  {
    name: "商学院",
    x: 994,
    y: 2537,
    category: "academic"
  },
  {
    name: "创新创业学院",
    x: 994,
    y: 2556,
    category: "academic"
  },
  {
    name: "第三科研楼",
    x: 433,
    y: 2575,
    category: "academic"
  },
  {
    name: "检测中心",
    x: 564,
    y: 2582,
    category: "academic"
  },
  {
    name: "图书馆",
    x: 731,
    y: 2607,
    category: "academic"
  },
  {
    name: "第四科研楼",
    x: 424,
    y: 2642,
    category: "academic"
  },
  {
    name: "第二教学楼",
    x: 551,
    y: 2656,
    category: "academic"
  },
  {
    name: "七号门",
    x: 284,
    y: 2665,
    category: "other"
  },
  {
    name: "理学院",
    x: 815,
    y: 2730,
    category: "academic"
  },
  {
    name: "行政楼",
    x: 468,
    y: 2753,
    category: "admin"
  },
  {
    name: "南科大会堂",
    x: 545,
    y: 2900,
    category: "admin"
  },
  {
    name: "一号门",
    x: 849,
    y: 2962,
    category: "other"
  },
  {
    name: "塘朗",
    x: 858,
    y: 3279,
    category: "other"
  }
]

// 地点分类的展示元数据（label / 主题色），页面与场景共用
export const CATEGORIES: Record<string, { label: string; color: string }> = {
  academic: { label: '教学·科研', color: '#5b6ee1' },
  life: { label: '生活·宿舍', color: '#e8a13c' },
  dining: { label: '餐饮', color: '#e07a3f' },
  sports: { label: '运动', color: '#4caf78' },
  admin: { label: '行政·会议', color: '#8a8f9e' },
  other: { label: '其他', color: '#b08bb3' },
}
export const CATEGORY_LIST = Object.entries(CATEGORIES)
