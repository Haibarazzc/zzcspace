# Exploration Portfolio · V2

一个以“探索旅程”为叙事线索的个人数字档案，使用 React、TypeScript、Vite、Framer Motion 与 GSAP 构建。

## 本地运行

```bash
npm install
npm run dev
```

正式构建：`npm run build`

## 修改内容

- 姓名、介绍、经历、学术方向和兴趣：`src/data/profile.ts`
- 摄影图片：替换 `public/photos/gallery-01.jpg` 至 `gallery-06.jpg` 即可；高清原图备份在 `photos-originals/`
- 主题样式：`src/styles.css`

## 部署到 Vercel

将项目推送到 GitHub 后在 Vercel 导入仓库。框架选择 Vite，构建命令使用 `npm run build`，输出目录为 `dist`。

项目已包含 Vercel 静态资源缓存配置，不需要后端或环境变量。

