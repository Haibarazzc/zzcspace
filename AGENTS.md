# AGENTS.md — AI 助手工作须知（zzcspace 仓库）

给 ZCode / Cursor / Claude Code 等 AI 助手的仓库说明书。人读的版本见 `README.md`。

## 先记住这三件事

1. **部署 = git push**。线上 `zzcspace.com` 由 Vercel 从 `main` 分支自动构建，
   不要用 `vercel` CLI 手动部署，不要把构建产物提交进仓库。
2. **这是双项目 monorepo**：`XHBlogs/`（Next.js 博客，静态导出）+ `ZZC/`（Vite 门户，
   线上挂 `/portfolio/`）+ 根 `api/`（Serverless Functions）。根 `package.json` 的
   `npm run build` 串起两个构建和 `scripts/prepare-deploy.mjs` 合并。
3. **改完必须验证再推送**，验证命令见下文。

## 版本与工具链注意事项

- `XHBlogs` 用的是 **Next.js 16**（`output: 'export'` 静态导出，Turbopack），
  与训练数据里的 Next 版本有 breaking changes——写 Next 相关代码前先查
  `XHBlogs/node_modules/next/dist/docs/`（`XHBlogs/AGENTS.md` 也有此提示）。
- 静态导出约束：博客页面里**没有**服务端代码；需要后端逻辑时写根 `api/*.ts`（Vercel 函数，
  保持零 npm 依赖，别引入框架）。
- Node 24。git 身份用仓库本地配置（`zzc <312102146+Haibarazzc@users.noreply.github.com>`），
  推送用 `gh auth git-credential` 凭证。

## 验证清单（按改动范围选）

| 改动 | 验证命令 |
|---|---|
| 博客页面/组件 | `npm --prefix XHBlogs run build`（须零错误，26+ 页面生成） |
| 门户页面 | `npm --prefix ZZC run build` |
| api/ 函数 | `node --test scripts/api.test.mjs` |
| 部署/构建配置 | 根目录 `npm run build` 全流程跑通，检查 `deploy-site/` 产物 |

推送后如需确认上线：`curl -sI https://zzcspace.com/<路径>` 等待 200（构建 1-4 分钟）。

## 内容规范

- 文章 `XHBlogs/posts/<slug>.md`：slug 小写连字符；front matter 含
  `title / date（"YYYY-MM-DD HH:mm:ss"）/ description / cover / tags[]`。
- 杂谈 `XHBlogs/chatters/`：长杂谈带 `tags/mood/cover/description`；moment 型只有
  `id/date/location/title`。两种格式 `lib/content.ts` 都要能解析。
- **标签是自动聚合的**：`lib/content.ts` 汇总文章+杂谈的 tags 生成
  `/archive` 标签云、`/tags/[tag]` 静态页、RSS 分类、sitemap。中文标签 URL 会被
  百分号编码（`/tags/%E5%BB%BA%E7%AB%99`），链接时记得 `encodeURIComponent`。
- 改导航：`XHBlogs/components/Navbar.tsx` 里 `navLinks` 和 `NAV_NAMES`（zh/en）是
  **按位置对应**的两个数组，增删项必须同步改两处。

## 环境事实（排查部署问题用）

- Vercel：团队 `zzc2`，项目 `zzc`（framework=Other，构建设置全部为空，由根 `vercel.json`
  提供 buildCommand/outputDirectory/cleanUrls/redirects/headers）。域名 `zzcspace.com`。
- 环境变量在 Vercel 项目上：`UPSTASH_REDIS_REST_URL/TOKEN`（统计与地图备注存储）、
  `MAP_ADMIN_PASSWORD`、`LOGS_KEY`。仓库里没有这些值。
- API 线上路径：`/api/track`（POST 统计）、`/api/map-notes`（地图备注 CRUD）、`/api/logs`。
- 已知历史坑：2026-09 底到 2026-10-01 之间是本地 CLI 手动部署，期间的线上内容可能
  领先于 git 提交（该偏差已于 2026-10-01 用文件级 sha1 对比核实清零）。

## 不要做

- 不要提交 `deploy-site/`、`XHBlogs/out/`、`XHBlogs/.next/`、`ZZC/dist/`（已 gitignore）
- 不要在博客页面代码里引入服务端 API / 动态路由（静态导出会直接构建失败）
- 不要改 Vercel 面板上的 Build Command / Output Directory（由 `vercel.json` 管理，
  面板设置会覆盖文件且造成两边不一致）
- 不要删除或绕过 `scripts/prepare-deploy.mjs` 里的产物完整性检查
