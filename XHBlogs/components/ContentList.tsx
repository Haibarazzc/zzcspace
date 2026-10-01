import Link from 'next/link';

export interface ContentEntry {
  href: string;
  type: 'post' | 'chatter';
  title: string;
  date: string;
  description?: string;
}

// 归档页 / 标签页共用的条目列表：类型徽章 + 标题 + 摘要 + 日期
export default function ContentList({ entries }: { entries: ContentEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm font-bold text-slate-400 dark:text-slate-500 py-6 text-center">
        这个标签下暂时还没有内容。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Link
          key={entry.href}
          href={entry.href}
          className="group flex items-start gap-3 md:gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-white/10 shadow-sm px-4 py-3.5 md:px-5 md:py-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-indigo-300/60 dark:hover:border-indigo-500/40"
        >
          <span
            className={`flex-shrink-0 mt-0.5 text-[10px] md:text-[11px] font-black px-2 py-1 rounded-full tracking-wider ${
              entry.type === 'post'
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                : 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20'
            }`}
          >
            {entry.type === 'post' ? '文章' : '杂谈'}
          </span>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
              {entry.title}
            </h3>
            {entry.description && (
              <p className="hidden md:block text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1 line-clamp-1">
                {entry.description}
              </p>
            )}
          </div>

          <time className="flex-shrink-0 text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider pt-0.5">
            {entry.date.slice(0, 10)}
          </time>
        </Link>
      ))}
    </div>
  );
}
