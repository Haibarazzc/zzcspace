// RSS 2.0 订阅源：文章 + 杂谈合并输出，构建时静态生成
import { getAllPosts, getAllChatters } from '../../lib/content';
import { siteConfig } from '../../siteConfig';

export const dynamic = 'force-static';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(date: string): string {
  const t = new Date(date);
  return Number.isNaN(t.getTime()) ? new Date().toUTCString() : t.toUTCString();
}

export async function GET() {
  const base = siteConfig.url.replace(/\/$/, '');

  const items = [
    ...getAllPosts().map((p) => ({
      title: p.title,
      link: `${base}/posts/${p.slug}`,
      description: p.description,
      categories: p.tags,
      date: String(p.date),
    })),
    ...getAllChatters().map((c) => ({
      title: c.title,
      link: `${base}/chatter/${c.slug}`,
      description: c.description,
      categories: c.tags,
      date: String(c.date),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.title)}</title>
    <link>${base}</link>
    <description>${escapeXml(siteConfig.bio)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <pubDate>${toRfc822(item.date)}</pubDate>
      <description>${escapeXml(item.description)}</description>${item.categories
        .map((c) => `\n      <category>${escapeXml(c)}</category>`)
        .join('')}
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
