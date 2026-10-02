// RSS 2.0 订阅源：文章 + 杂谈合并输出全文（content:encoded），构建时静态生成
import { getFeedItems, cleanMarkdownForRender } from '../../lib/content';
import { renderMarkdown } from '../../lib/markdown';
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

// CDATA 里的 ]]> 要拆开转义
function cdata(html: string): string {
  return '<![CDATA[' + html.replace(/]]>/g, ']]]]><![CDATA[>') + ']]>';
}

export async function GET() {
  const base = siteConfig.url.replace(/\/$/, '');

  const items = await Promise.all(
    getFeedItems().map(async (item) => {
      const cleaned = cleanMarkdownForRender(item.content);
      let html = await renderMarkdown(cleaned);
      // 订阅器里相对路径的图片/链接会挂掉，换成绝对地址
      html = html
        .replace(/(src|href)="\/(?!\/)/g, `$1="${base}/`)
        .replace(/<img /g, '<img style="max-width:100%;border-radius:8px;" ');
      return {
        ...item,
        link: `${base}/${item.kind === 'post' ? 'posts' : 'chatter'}/${item.slug}`,
        html,
      };
    }),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
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
      <description>${escapeXml(item.description)}</description>${item.tags
        .map((c) => `\n      <category>${escapeXml(c)}</category>`)
        .join('')}
      <content:encoded>${cdata(`<div style="font-family:-apple-system,'PingFang SC',sans-serif;line-height:1.8;max-width:42em;">${item.html}</div>`)}</content:encoded>
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
