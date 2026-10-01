// lib/content.ts - 全站内容统一加载：文章、杂谈、标签聚合
// 归档页 / 标签页 / RSS / sitemap 共用，避免各页面重复读文件。

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  description: string;
  cover: string;
  tags: string[];
}

export interface ChatterMeta {
  slug: string;
  title: string;
  date: string;
  description: string;
  cover: string;
  tags: string[];
  mood: string;
}

export interface TagInfo {
  tag: string;
  posts: PostMeta[];
  chatters: ChatterMeta[];
  total: number;
}

function readMatter(dir: string): { slug: string; data: Record<string, any>; content: string }[] {
  const directory = path.join(process.cwd(), dir);
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const slug = name.replace(/\.md$/, '');
      const raw = fs.readFileSync(path.join(directory, name), 'utf8');
      const { data, content } = matter(raw);
      return { slug, data, content };
    });
}

function toDateValue(date: unknown): number {
  const t = new Date(String(date ?? '')).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function getAllPosts(): PostMeta[] {
  return readMatter('posts')
    .map(({ slug, data }) => ({
      slug,
      title: data.title || '无标题',
      date: data.date || '未知时间',
      description: data.description || '',
      cover: data.cover || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
    }))
    .sort((a, b) => toDateValue(b.date) - toDateValue(a.date));
}

export function getAllChatters(): ChatterMeta[] {
  return readMatter('chatters')
    .map(({ slug, data, content }) => {
      // moment 型碎片没有 description，截取正文开头作为摘要
      const fallbackDescription = content
        .replace(/^#+ .*\n/m, '')
        .replace(/[#>*`>\-\[\]]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
      return {
        slug,
        title: data.title || '碎片记录',
        date: data.date || '未知时间',
        description: data.description || fallbackDescription,
        cover: data.cover || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        mood: data.mood || '',
      };
    })
    .sort((a, b) => toDateValue(b.date) - toDateValue(a.date));
}

export function getAllTags(): TagInfo[] {
  const posts = getAllPosts();
  const chatters = getAllChatters();
  const map = new Map<string, TagInfo>();

  for (const post of posts) {
    for (const tag of post.tags) {
      if (!map.has(tag)) map.set(tag, { tag, posts: [], chatters: [], total: 0 });
      const info = map.get(tag)!;
      info.posts.push(post);
      info.total++;
    }
  }
  for (const chatter of chatters) {
    for (const tag of chatter.tags) {
      if (!map.has(tag)) map.set(tag, { tag, posts: [], chatters: [], total: 0 });
      const info = map.get(tag)!;
      info.chatters.push(chatter);
      info.total++;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function getTagInfo(tag: string): TagInfo | undefined {
  return getAllTags().find((info) => info.tag === tag);
}
