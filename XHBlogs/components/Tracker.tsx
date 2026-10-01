"use client";

// 博客侧访客埋点：view 事件 + 滚动深度事件，发送到 /api/track。
// 与门户 ZZC/src/tracker.ts 的字段约定保持一致（type/vid/page/ref/depth）。
// vid 按访问生成（每次加载一个），独立 vid 数 = 访问次数。

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const ENDPOINT = '/api/track';
const THRESHOLDS = [25, 50, 75, 90, 100];

function send(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(ENDPOINT, new Blob([json], { type: 'application/json' }))) return;
    }
  } catch { /* fall through to fetch */ }
  try {
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(() => {});
  } catch { /* offline: drop silently */ }
}

export default function Tracker() {
  const pathname = usePathname();
  const vidRef = useRef<string>('');
  const depthRef = useRef(0);
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // 本地开发/预览不上报，避免污染统计
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

    if (!vidRef.current) {
      vidRef.current = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    const vid = vidRef.current;
    const ref = document.referrer || '';

    // SPA 路由切换时上报新的 view
    send({ type: 'view', vid, page: pathname + location.search, ref });

    // 滚动深度（换页后重置）
    depthRef.current = 0;
    firedRef.current = new Set();

    const fireDepth = (th: number) => {
      if (!firedRef.current.has(th)) {
        firedRef.current.add(th);
        send({ type: 'depth', vid, page: pathname + location.search, depth: th });
      }
    };
    let ticking = false;
    const measure = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((h.scrollTop / max) * 100))) : 0;
        if (pct > depthRef.current) {
          depthRef.current = pct;
          THRESHOLDS.forEach((t) => { if (t <= depthRef.current) fireDepth(t); });
        }
      });
    };
    const onExit = () => send({ type: 'depth', vid, page: pathname + location.search, depth: depthRef.current });

    addEventListener('scroll', measure, { passive: true });
    addEventListener('pagehide', onExit);
    measure();

    return () => {
      removeEventListener('scroll', measure);
      removeEventListener('pagehide', onExit);
    };
  }, [pathname]);

  return null;
}
