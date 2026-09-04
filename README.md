# zzcspace · 曾子丞个人网站

zzcspace.com 的全部源码，单一仓库维护。

## 目录结构

| 目录 | 内容 | 技术栈 |
|---|---|---|
| `XHBlogs/` | 主站：首页 / 杂谈 / 音乐 / 照片墙 / 关于我 | Next.js 16（静态导出）+ Tailwind v4 |
| `ZZC/` | 自我介绍页（魔方页），线上挂在 `/portfolio/` 下 | React + Vite + GSAP + three.js |

两个子项目相互独立，各自有 `package.json`，在本目录内单独 `npm install` / `npm run build`。

## 部署流程（zzcspace.com → Vercel）

线上部署走 Vercel CLI 直传，不依赖本仓库：

```bash
# 1. 构建主站（XHBlogs/ 目录内）
cd XHBlogs && npm run build          # 产物 out/

# 2. 构建 ZZC（ZZC/ 目录内）
cd ../ZZC && npm run build           # 产物 dist/

# 3. 回到仓库根目录，组装完整部署目录（Node.js 24）
cd ..
node scripts/prepare-deploy.mjs
# 包含主站、最新 ZZC/dist、ZZC/api 服务端接口、路由配置和导航预加载文件。

# 4. 部署
cd deploy-site && npx vercel deploy --prod --yes --name zzc
```

不要仅上传静态页面：校园地图备注和访问日志依赖 `deploy-site/api/` 中的函数。
Vercel 项目需保留 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`、
`MAP_ADMIN_PASSWORD`、`LOGS_KEY` 环境变量；密钥不写入仓库或公开目录。
接口回归检查：在仓库根目录运行 `node --test scripts/api.test.mjs`。

## 内容修改入口

- 主站文案/配置：`XHBlogs/siteConfig.ts`
- 主站文章：`XHBlogs/posts/*.md`、杂谈 `XHBlogs/chatters/*.md`
- 照片墙：`XHBlogs/data/albums.ts`
- 音乐（本地音频 + 歌词）：`XHBlogs/components/MusicProvider.tsx`
- 自我介绍页内容：`ZZC/src/App.tsx`、`ZZC/src/data/`
- 博客文章（portfolio 子站）：`ZZC/blog/*.md`，`npm run build` 自动生成
