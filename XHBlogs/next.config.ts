import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // portfolio 由 public/portfolio/ 目录直接服务。
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
