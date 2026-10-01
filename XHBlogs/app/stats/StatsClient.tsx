"use client";

// 访问统计面板：用 Vercel 环境变量里的 LOGS_KEY 解锁，
// 数据来自 /api/stats（对 Redis 中的埋点逐天聚合）。

import { useCallback, useEffect, useState } from 'react';

interface DayStat { date: string; views: number; uniques: number; events: number }
interface TopItem { name: string; count: number }
interface RecentEvent { t: string; page: string; ref: string; ua: string }
interface StatsData {
  generatedAt: string;
  days: DayStat[];
  totalViews: number;
  totalUniques: number;
  readSessions: number;
  devices: { mobile: number; desktop: number; other: number };
  topPages: TopItem[];
  topRefs: TopItem[];
  recent: RecentEvent[];
}

const KEY_STORAGE = 'stats-logs-key';
const card = 'bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-white/40 dark:border-white/10 shadow-xl';

function bjTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(5, 16).replace('T', ' ')
}

export default function StatsClient() {
  const [keyInput, setKeyInput] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [days, setDays] = useState(14);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE) || ''
    if (saved) { setKeyInput(saved); setSavedKey(saved) }
  }, [])

  const load = useCallback(async (k: string, d: number) => {
    if (!k) return
    setLoading(true); setError(''); setData(null)
    try {
      const res = await fetch(`/api/stats?key=${encodeURIComponent(k)}&days=${d}`)
      if (res.status === 403) { setError('密钥不对，请检查 LOGS_KEY（Vercel 环境变量）'); setLoading(false); return }
      if (res.status === 503) { setError('Redis 未配置（Vercel 环境变量缺少 UPSTASH_REDIS_REST_URL / TOKEN）'); setLoading(false); return }
      if (!res.ok) { setError(`请求失败：HTTP ${res.status}`); setLoading(false); return }
      setData(await res.json())
    } catch {
      setError('网络错误，稍后再试')
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (savedKey) load(savedKey, days) }, [savedKey, days, load])

  const onSave = () => {
    localStorage.setItem(KEY_STORAGE, keyInput.trim())
    setSavedKey(keyInput.trim())
  }

  const maxViews = data ? Math.max(1, ...data.days.map(d => d.views)) : 1
  const avgViews = data && data.days.length ? Math.round(data.totalViews / data.days.length) : 0

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          访问统计
          <span className="text-indigo-500 ml-2 text-lg md:text-2xl align-middle font-black">STATS</span>
        </h1>
        <p className="mt-2 text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">私人面板 · 不对外公开</p>
      </header>

      {!data && (
        <section className={`${card} p-6 md:p-8 max-w-md mx-auto`}>
          <label className="block text-sm font-black text-slate-700 dark:text-slate-200 mb-2">输入查看密钥（LOGS_KEY）</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSave()}
              placeholder="LOGS_KEY"
              className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-white/50 dark:border-slate-600/60 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button onClick={onSave} className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-black shadow-md transition-all hover:scale-105">
              解锁
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            密钥只保存在你当前浏览器的 localStorage 里，不会上传。忘记密钥去 Vercel 项目的环境变量里看 LOGS_KEY。
          </p>
        </section>
      )}

      {error && (
        <section className={`${card} p-6 text-center text-sm font-bold text-red-500`}>{error}</section>
      )}
      {loading && (
        <section className={`${card} p-10 text-center text-sm font-black text-slate-400 animate-pulse`}>统计中…</section>
      )}

      {data && (
        <>
          {/* 范围切换 */}
          <div className="flex justify-center gap-2">
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-4 py-1.5 rounded-full text-xs font-black shadow-sm border transition-all ${d === days ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-white/40 dark:border-white/10 hover:-translate-y-0.5'}`}>
                近 {d} 天
              </button>
            ))}
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: '总浏览', value: data.totalViews, sub: `日均 ${avgViews}` },
              { label: '访问次数', value: data.totalUniques, sub: '按独立访客会话' },
              { label: '深读会话', value: data.readSessions, sub: '滚动超过 50%' },
              { label: '移动 / 桌面', value: `${data.devices.mobile}/${data.devices.desktop}`, sub: `其他 ${data.devices.other}` },
            ].map(kpi => (
              <div key={kpi.label} className={`${card} p-4 md:p-5 text-center`}>
                <p className="text-2xl md:text-3xl font-black bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">{kpi.value}</p>
                <p className="mt-1 text-xs font-black text-slate-700 dark:text-slate-200">{kpi.label}</p>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* 每日柱状图 */}
          <section className={`${card} p-5 md:p-7`}>
            <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-4 tracking-widest">每日浏览（北京时间）</h2>
            <div className="flex items-end gap-1 md:gap-1.5 h-40">
              {data.days.map(d => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative" title={`${d.date}：${d.views} 浏览 / ${d.uniques} 访客`}>
                  <div className="w-full rounded-t-md bg-gradient-to-t from-indigo-500/70 to-purple-400/80 group-hover:from-indigo-500 group-hover:to-purple-500 transition-all" style={{ height: `${Math.max(2, (d.views / maxViews) * 100)}%` }} />
                  <span className="mt-1.5 text-[8px] md:text-[9px] font-black text-slate-400 dark:text-slate-500 rotate-0">{d.date.slice(5).replace('-', '/')}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] font-bold text-slate-400">柱高 = 浏览量；悬停查看访客数。峰值 {maxViews === 1 ? '—' : maxViews + ' 次/天'}</p>
          </section>

          {/* 榜单 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className={`${card} p-5 md:p-6`}>
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-4 tracking-widest">热门页面 TOP 10</h2>
              {data.topPages.length === 0 && <p className="text-xs font-bold text-slate-400 py-4 text-center">暂无数据</p>}
              <ul className="space-y-2.5">
                {data.topPages.map(p => (
                  <li key={p.name}>
                    <div className="flex justify-between items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                      <span className="text-xs font-black text-indigo-500 flex-shrink-0">{p.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200/60 dark:bg-slate-700/60 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400" style={{ width: `${(p.count / data.topPages[0].count) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${card} p-5 md:p-6`}>
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-4 tracking-widest">访问来源</h2>
              {data.topRefs.length === 0 && <p className="text-xs font-bold text-slate-400 py-4 text-center">暂无外部来源（都是直接访问）</p>}
              <ul className="space-y-2.5">
                {data.topRefs.map(r => (
                  <li key={r.name} className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-200 truncate">{r.name}</span>
                    <span className="text-pink-500 font-black flex-shrink-0">{r.count}</span>
                  </li>
                ))}
              </ul>
              <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 mt-6 mb-3 tracking-widest">设备构成</h2>
              <div className="flex h-6 rounded-full overflow-hidden text-[10px] font-black text-white">
                <div className="bg-indigo-500 flex items-center justify-center" style={{ width: `${(data.devices.mobile / Math.max(1, data.devices.mobile + data.devices.desktop + data.devices.other)) * 100}%` }}>移动 {data.devices.mobile}</div>
                <div className="bg-purple-500 flex items-center justify-center" style={{ width: `${(data.devices.desktop / Math.max(1, data.devices.mobile + data.devices.desktop + data.devices.other)) * 100}%` }}>桌面 {data.devices.desktop}</div>
                <div className="bg-slate-400 flex items-center justify-center" style={{ width: `${(data.devices.other / Math.max(1, data.devices.mobile + data.devices.desktop + data.devices.other)) * 100}%` }}>其他</div>
              </div>
            </section>
          </div>

          {/* 最近访问 */}
          <section className={`${card} p-5 md:p-6 overflow-x-auto`}>
            <h2 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-4 tracking-widest">最近访问（最新 60 条）</h2>
            {data.recent.length === 0 && <p className="text-xs font-bold text-slate-400 py-4 text-center">暂无记录</p>}
            <table className="w-full text-xs font-bold min-w-[560px]">
              <tbody>
                {data.recent.map((e, i) => (
                  <tr key={i} className="border-b border-slate-200/40 dark:border-slate-700/40 last:border-0">
                    <td className="py-2 pr-3 text-slate-400 dark:text-slate-500 whitespace-nowrap">{bjTime(e.t)}</td>
                    <td className="py-2 pr-3 text-indigo-600 dark:text-indigo-400 max-w-[240px] truncate">{e.page}</td>
                    <td className="py-2 text-slate-400 dark:text-slate-500 max-w-[160px] truncate">{e.ref ? (() => { try { return new URL(e.ref).hostname } catch { return e.ref.slice(0, 24) } })() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="text-center text-[10px] font-bold text-slate-400">
            生成于 {bjTime(data.generatedAt)}（北京时间）· 想换密钥就清掉浏览器的 localStorage
          </p>
        </>
      )}
    </div>
  )
}
