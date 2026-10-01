import type { MetadataRoute } from 'next';
import { getAllPosts, getAllChatters, getAllTags } from '../lib/content';
import { siteConfig } from '../siteConfig';

// 静态导出要求：构建时一次性生成
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, '');
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/archive`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/chatter`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/photowall`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/music`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/portfolio/about/`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/portfolio/map/`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];

  const postRoutes: MetadataRoute.Sitemap = getAllPosts().map((p) => ({
    url: `${base}/posts/${p.slug}`,
    lastModified: new Date(String(p.date)),
    changeFrequency: 'monthly',
    priority: 0.9,
  }));

  const chatterRoutes: MetadataRoute.Sitemap = getAllChatters().map((c) => ({
    url: `${base}/chatter/${c.slug}`,
    lastModified: new Date(String(c.date)),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const tagRoutes: MetadataRoute.Sitemap = getAllTags().map(({ tag, total }) => ({
    url: `${base}/tags/${encodeURIComponent(tag)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: total >= 3 ? 0.5 : 0.3,
  }));

  return [...staticRoutes, ...postRoutes, ...chatterRoutes, ...tagRoutes];
}
