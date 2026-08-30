import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/zzc-xhblogs-site',
  assetPrefix: '/zzc-xhblogs-site/',
  // /portfolio/ 直达静态介绍页（public/portfolio/index.html）
// 静态导出模式不支持 rewrites；portfolio 由 public/portfolio/ 目录直接服务
  // 🚨 核心修改 1：关掉纯静态导出，让 Vercel 帮你把 API 跑起来！
  // output: 'export',

  // 🚨 核心修改 2：Vercel 不需要强制加斜杠，关掉它能避免很多 API 路径匹配错误
  // trailingSlash: true,

  // 下面这些可以保留
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true, // 忽略 TS 错误，方便快速部署
  },
};

export default nextConfig;