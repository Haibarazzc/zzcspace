import Link from 'next/link';
import type { Metadata } from 'next';
import { siteConfig } from '../siteConfig';

export const metadata: Metadata = {
  title: `404 · 页面走丢了 | ${siteConfig.title}`,
  robots: { index: false, follow: false },
};

// 全局 404：静态导出生成 404.html，Vercel 对所有未匹配路由返回这一页。
// 渲染在根布局里，所以导航栏 / 背景 / 页脚都在。
export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center min-h-[70vh] px-4">
      <div className="text-center max-w-md mx-auto select-none">
        <p className="text-[96px] md:text-[140px] font-black leading-none tracking-tighter bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-400 bg-clip-text text-transparent">
          404
        </p>
        <h1 className="mt-4 text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          这一页不存在，或者去了平行宇宙
        </h1>
        <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
          链接可能输错了，或者这个页面搬家没留新地址。
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-black shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            回到主页
          </Link>
          <Link href="/archive" className="text-sm font-black text-indigo-600 dark:text-indigo-400 hover:underline">
            逛逛归档 →
          </Link>
        </div>
      </div>
    </main>
  );
}
