import Link from 'next/link';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import ContentList, { type ContentEntry } from '../../components/ContentList';
import { getAllPosts, getAllChatters, getAllTags } from '../../lib/content';
import { siteConfig } from '../../siteConfig';

export const metadata = {
  title: `归档 | ${siteConfig.title}`,
  description: `${siteConfig.authorName} 的全部文章与杂谈时间线，支持按标签浏览。`,
};

export default function ArchivePage() {
  const posts = getAllPosts();
  const chatters = getAllChatters();
  const tags = getAllTags();

  const entries: ContentEntry[] = [
    ...posts.map((p) => ({
      href: `/posts/${p.slug}`,
      type: 'post' as const,
      title: p.title,
      date: String(p.date),
      description: p.description,
    })),
    ...chatters.map((c) => ({
      href: `/chatter/${c.slug}`,
      type: 'chatter' as const,
      title: c.title,
      date: String(c.date),
      description: c.description,
    })),
  ].sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));

  // 按年份分组（两种日期格式都以 YYYY 开头，直接取前 4 位）
  const byYear = new Map<string, ContentEntry[]>();
  for (const entry of entries) {
    const year = entry.date.slice(0, 4) || '未知';
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(entry);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <main className="w-[90%] max-w-4xl mx-auto mt-24 md:mt-28 relative z-10">
          {/* 页头 */}
          <header className="mb-8 md:mb-10 text-center">
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight transition-colors duration-700">
              归档
              <span className="text-indigo-500 ml-2 text-xl md:text-3xl align-middle font-black">ARCHIVE</span>
            </h1>
            <p className="mt-3 text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">
              共 {posts.length} 篇文章 · {chatters.length} 条杂谈 · {tags.length} 个标签
            </p>
          </header>

          {/* 标签云 */}
          {tags.length > 0 && (
            <section className="mb-10 md:mb-14 bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl p-5 md:p-7 border border-white/40 dark:border-white/10 shadow-xl">
              <h2 className="text-xs md:text-sm font-black text-slate-500 dark:text-slate-400 mb-4 tracking-widest">
                # 标签
              </h2>
              <div className="flex flex-wrap gap-2 md:gap-3">
                {tags.map(({ tag, total }) => (
                  <Link
                    key={tag}
                    href={`/tags/${encodeURIComponent(tag)}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/50 dark:bg-slate-900/40 border border-white/40 dark:border-white/10 text-xs md:text-sm font-bold text-pink-600 dark:text-pink-400 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-pink-400/50"
                  >
                    <span className="opacity-60">#</span>
                    {tag}
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/60 rounded-full px-1.5 py-0.5">
                      {total}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* 时间线 */}
          <div className="space-y-10 md:space-y-14">
            {years.map((year) => (
              <section key={year} className="relative">
                <div className="flex items-center gap-4 mb-5 md:mb-6">
                  <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent transition-colors duration-700">
                    {year}
                  </h2>
                  <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/40 to-transparent" />
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500">
                    {byYear.get(year)!.length} 篇
                  </span>
                </div>
                <ContentList entries={byYear.get(year)!} />
              </section>
            ))}
          </div>
        </main>
      </PageTransition>
    </div>
  );
}
