import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import PageTransition from '../../../components/PageTransition';
import ContentList, { type ContentEntry } from '../../../components/ContentList';
import { getAllTags } from '../../../lib/content';
import { siteConfig } from '../../../siteConfig';

export async function generateStaticParams() {
  // 静态导出会自动对非 ASCII 标签做百分号编码的文件名
  return getAllTags().map(({ tag }) => ({ tag }));
}

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: rawTag } = await params;
  let tag = rawTag;
  try { tag = decodeURIComponent(rawTag); } catch (e) {}
  return { title: `#${tag} | ${siteConfig.title}` };
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: rawTag } = await params;
  let tag = rawTag;
  try { tag = decodeURIComponent(rawTag); } catch (e) {}

  const info = getAllTags().find((t) => t.tag === tag);
  if (!info) notFound();

  const entries: ContentEntry[] = [
    ...info.posts.map((p) => ({
      href: `/posts/${p.slug}`,
      type: 'post' as const,
      title: p.title,
      date: String(p.date),
      description: p.description,
    })),
    ...info.chatters.map((c) => ({
      href: `/chatter/${c.slug}`,
      type: 'chatter' as const,
      title: c.title,
      date: String(c.date),
      description: c.description,
    })),
  ].sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));

  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <main className="w-[90%] max-w-4xl mx-auto mt-24 md:mt-28 relative z-10">
          <header className="mb-8 md:mb-10 text-center">
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight transition-colors duration-700">
              <span className="text-pink-500 mr-1">#</span>
              {info.tag}
            </h1>
            <p className="mt-3 text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">
              共 {info.total} 篇内容
              <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
              <Link href="/archive" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                返回全部归档
              </Link>
            </p>
          </header>

          <ContentList entries={entries} />
        </main>
      </PageTransition>
    </div>
  );
}
