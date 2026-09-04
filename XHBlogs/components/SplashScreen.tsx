"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './SplashScreen.module.css';

export default function SplashScreen() {
  const [phase, setPhase] = useState<'hidden' | 'writing' | 'leaving'>('hidden');
  const finished = useRef(false);

  const enterBlog = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    try { sessionStorage.setItem('hasSeenSplash', 'true'); } catch {}
    document.documentElement.classList.add('splash-seen');
    document.documentElement.classList.remove('splash-pending');
    setPhase('leaving');
  }, []);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem('hasSeenSplash') === 'true'; } catch {}
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (seen || reducedMotion.matches) {
      document.documentElement.classList.add('splash-seen');
      document.documentElement.classList.remove('splash-pending');
      return;
    }

    setPhase('writing');
    const timer = window.setTimeout(enterBlog, 4250);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') enterBlog();
    };
    const onMotionChange = () => { if (reducedMotion.matches) enterBlog(); };
    window.addEventListener('keydown', onKeyDown);
    reducedMotion.addEventListener('change', onMotionChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      reducedMotion.removeEventListener('change', onMotionChange);
    };
  }, [enterBlog]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = window.setTimeout(() => setPhase('hidden'), 750);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'hidden') return null;

  return (
    <div className={`${styles.splash} ${phase === 'leaving' ? styles.leaving : ''}`} data-splash={phase}>
      <div className={styles.screen}>
        <header className={styles.header} aria-hidden="true">
          <span>ZZC / SPACE</span>
          <span>数学 · 技术 · 摄影</span>
        </header>

        <div className={styles.greeting}>
          <svg className={styles.handwriting} viewBox="0 0 880 360" role="img" aria-label="hello，你好">
            <path
              className={styles.ink}
              pathLength="1"
              d="M70 268 C120 239 157 186 177 133 C198 76 191 42 167 48 C133 57 127 144 121 208 L111 293 C125 251 147 211 172 213 C212 218 170 292 204 298 C231 305 278 289 302 260 C329 229 325 192 301 193 C270 192 254 237 269 273 C284 314 325 310 366 280 C414 246 456 173 469 107 C479 58 459 35 438 52 C414 71 403 132 399 199 C396 249 396 288 424 298 C455 311 486 283 516 244 C550 198 573 140 577 96 C581 59 568 40 548 50 C519 63 508 131 507 201 C505 257 502 292 530 299 C562 309 600 281 623 244 C639 212 663 193 686 196 C723 198 741 220 735 252 C729 286 704 307 675 302 C643 298 633 268 643 239 C653 207 676 191 700 202 C730 218 750 238 777 228 C793 222 802 211 807 197"
            />
          </svg>
        </div>

        <footer className={styles.footer}>
          <div className={styles.caption}>
            <p>很高兴，在这里遇见你。</p>
            <span>WELCOME TO MY LITTLE CORNER OF THE INTERNET.</span>
          </div>
          <button type="button" className={styles.skip} onClick={enterBlog} disabled={phase === 'leaving'}>
            跳过开场
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" /></svg>
          </button>
        </footer>
        <div className={styles.progress} aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}
