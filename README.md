# zzcspace · 曾子丞个人网站

线上地址：**https://zzcspace.com**。博客 + 个人门户，单一仓库维护。

**推送到 `main` 分支即自动部署**（Vercel 检测到 push 后自动构建，约 1-4 分钟上线）。
线上内容永远等于仓库内容，没有任何一台设备持有「特权版本」。

## 目录结构

| 目录 | 内容 | 技术栈 |
|---|---|---|
| `XHBlogs/` | 主站：首页 / 文章 / 杂谈 / 归档 / 标签 / 音乐 / 照片墙 | Next.js 16（静态导出）+ Tailwind v4 |
| `ZZC/` | 自我介绍页与门户页面，线上挂在 `/portfolio/` 下（介绍、校园地图、樱花古境、狮小新三维页） | React + Vite + GSAP + three.js |
| `api/` | Vercel Serverless Functions：`track.ts` 访问统计、`map-notes.ts` 地图备注、`logs.ts` 统计查看 | 无第三方依赖的 TS |
| `scripts/prepare-deploy.mjs` | 把两个子项目的构建产物合并进 `deploy-site/`（仅构建期使用） | Node.js 24 |
| `package.json` / `vercel.json` | 根目录的 Vercel 构建入口：`npm run build` = 博客构建 + 门户构建 + 合并 | |

两个子项目相互独立，各自有 `package.json`。`deploy-site/`、`XHBlogs/out/`、`ZZC/dist/`
都是构建生成物（已 gitignore），**不要手工修改或提交**。

## 内容修改入口

- 主站文案/配置：`XHBlogs/siteConfig.ts`（标题、头像、背景、社交链接、站点 URL）
- 主站文章：`XHBlogs/posts/*.md`，文件名即 URL（小写连字符）：
  ```yaml
  ---
  title: "标题"
  date: "2026-08-27 12:00:00"
  description: "一句话摘要（列表页/RSS 用）"
  cover: "/bg-1.webp"
  tags: ["ai-agent"]
  ---
  ```
- 杂谈：`XHBlogs/chatters/*.md`，两种格式——长杂谈（title/date/tags/mood/cover/description）
  或 moment 碎片（id/date/location/title，正文一两句话）
- 照片墙：`XHBlogs/data/albums.ts`；照片文件在 `XHBlogs/public/photos/`
- 音乐（本地音频 + 歌词）：`XHBlogs/components/MusicProvider.tsx`，音频在 `XHBlogs/public/audio/`
- 门户内容：`ZZC/src/`（介绍页 `App.tsx` 与 `src/data/`，地图 `map/`，樱花古境 `qixia/`，狮小新 `shizi/`）
- 门户子站博客：`ZZC/blog/*.md`，`npm run build` 自动生成

归档页（`/archive`）、标签页（`/tags/<标签>`）、RSS（`/rss.xml`）、sitemap（`/sitemap.xml`）
全部由构建自动从文章和杂谈生成，新增内容后**无需注册任何页面**。

## 构建与部署

```bash
# 全量构建（与 Vercel 上执行的命令完全一致）
npm run build

# 只构建其中一个子项目
npm --prefix XHBlogs run build
npm --prefix ZZC run build

# API 函数回归测试
node --test scripts/api.test.mjs
```

- **部署 = `git push origin main`**。Vercel 团队 `zzc2`、项目 `zzc`（Hobby 计划），域名 `zzcspace.com`
- 首次构建约 4 分钟（装两套依赖），之后有依赖缓存约 1-2 分钟
- `ZZC/发布网站.bat`（Windows）做的也是 git push，效果等价
- 数据类环境变量配置在 Vercel 项目上，不在仓库：`UPSTASH_REDIS_REST_URL`、
  `UPSTASH_REDIS_REST_TOKEN`、`MAP_ADMIN_PASSWORD`、`LOGS_KEY`（密钥不写入仓库）
- 旧的手动部署方式（本地构建后 `vercel deploy` 直传 `deploy-site/`）仍可作应急后备，
  日常不要再走，避免线上与仓库产生偏差

## 部署历史（供排查参考）

2026-09 前为 GitHub 自动部署 → 2026-09 底改为本地构建 + Vercel CLI 直传 →
**2026-10-01 起改回 push 即部署**（根目录加入 `package.json` + `vercel.json`，
API 函数移到根 `api/`）。旧的 `ZZC/DEPLOYMENT_HANDOFF.md`（CloudBase 打包流程）已删除。
