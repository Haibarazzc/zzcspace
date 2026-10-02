import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import RacerGame from './RacerGame';
import { siteConfig } from '../../siteConfig';

export const metadata = {
  title: `樱花公路 · 赛车 | ${siteConfig.title}`,
  description: '樱花公路 3D 街机赛车：宽阔赛道、漂移集气、氮气加速，与七位 AI 对手一起冲线。支持键盘与触屏操作。',
};

export default function GamePage() {
  return (
    <div className="min-h-[100dvh] relative pb-16">
      <div className="hidden md:block"><Navbar /></div>
      <PageTransition>
        <main className="w-[96%] md:w-[94%] max-w-[1440px] mx-auto mt-20 md:mt-24 relative z-10">
          <header className="mb-4 flex items-center gap-3 px-1">
            <h1 className="text-lg md:text-xl font-black text-slate-800 dark:text-white tracking-tight">
              樱花公路
            </h1>
            <span className="text-[10px] text-slate-500 dark:text-slate-300 font-sans tracking-[0.16em]">3D ARCADE RACING</span>
            <a href="/" className="md:hidden ml-auto text-[11px] text-slate-600 dark:text-slate-300 font-sans">返回首页</a>
          </header>
          <RacerGame />
        </main>
      </PageTransition>
    </div>
  );
}
