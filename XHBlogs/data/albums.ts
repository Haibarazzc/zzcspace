// 🛡️ 本文件由控制台自动生成（内容已替换为 曾子丞 的摄影作品）
export interface Photo { url: string; caption?: string; }
export interface Album { id: string; title: string; description: string; cover: string; date: string; photos: Photo[]; }

export const albums: Album[] = [
  {
    "id": "city-lights",
    "title": "城市光影",
    "description": "蓝调时刻的城市天际线与车流光轨 —— 记录光经过世界的方式",
    "cover": "/photos/gallery-01.webp",
    "date": "2025.11",
    "photos": [
      { "url": "/photos/gallery-01.webp", "caption": "Observation / 01" },
      { "url": "/photos/gallery-02.webp", "caption": "Observation / 02" },
      { "url": "/photos/gallery-03.webp", "caption": "Observation / 03" }
    ]
  },
  {
    "id": "edge-of-city",
    "title": "城市边缘",
    "description": "晚霞、云层与城市的边界",
    "cover": "/photos/gallery-04.webp",
    "date": "2025.12",
    "photos": [
      { "url": "/photos/gallery-04.webp", "caption": "Observation / 04" },
      { "url": "/photos/gallery-05.webp", "caption": "Observation / 05" },
      { "url": "/photos/gallery-06.webp", "caption": "Observation / 06" }
    ]
  }
]

export const ungroupedPhotos: Photo[] = [
  { "url": "/photos/moments-01.jpg", "caption": "光影瞬间 / 07" },
  { "url": "/photos/moments-02.jpg", "caption": "光影瞬间 / 08" },
  { "url": "/photos/moments-03.jpg", "caption": "光影瞬间 / 09" },
  { "url": "/photos/moments-04.jpg", "caption": "光影瞬间 / 10" },
  { "url": "/photos/moments-05.jpg", "caption": "光影瞬间 / 11" },
  { "url": "/photos/moments-06.jpg", "caption": "光影瞬间 / 12" }
]
