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

// ==========================================
// RSS 全文输出用：读取正文并套用与文章页一致的渲染前清洗
// ==========================================

export function cleanMarkdownForRender(content: string): string {
  // 1. 修复数字列表缺空格（1.百度 -> 1. 百度）
  content = content.replace(/^(\s*\d+)\.([^ \n])/gm, '$1. $2');
  // 2. 统一换行、清掉纯空格废行
  content = content.replace(/\r\n/g, '\n').replace(/^[ \t]+$/gm, '');
  // 3. 代码块外的连续空行补 <br>（与文章页一致，防渲染引擎吞行）
  const blocks = content.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
  return blocks
    .map((block, index) => {
      if (index % 2 === 1) return block;
      return block.replace(/\n{3,}/g, (m) => '\n\n' + '<br/>'.repeat(m.length - 2) + '\n\n');
    })
    .join('');
}

export interface FeedItem {
  slug: string;
  kind: 'post' | 'chatter';
  title: string;
  date: string;
  description: string;
  tags: string[];
  content: string; // 原始 markdown 正文
}

export function getFeedItems(): FeedItem[] {
  const posts = readMatter('posts').map(({ slug, data, content }) => ({
    slug, kind: 'post' as const,
    title: String(data.title || '无标题'),
    date: String(data.date || ''),
    description: String(data.description || ''),
    tags: Array.isArray(data.tags) ? data.tags : [],
    content,
  }));
  const chatters = readMatter('chatters').map(({ slug, data, content }) => ({
    slug, kind: 'chatter' as const,
    title: String(data.title || '碎片记录'),
    date: String(data.date || ''),
    description: String(data.description || ''),
    tags: Array.isArray(data.tags) ? data.tags : [],
    content,
  }));
  return [...posts, ...chatters].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
