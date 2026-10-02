import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import SnakeGame from './SnakeGame';
import { siteConfig } from '../../siteConfig';

export const metadata = {
  title: `贪吃蛇 | ${siteConfig.title}`,
  description: '20×20 经典贪吃蛇：越吃越快，比比谁更长。支持键盘与触屏，成绩可上全网排行。',
};

export default function SnakePage() {
  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <main className="w-[95%] md:w-[90%] max-w-4xl mx-auto mt-24 md:mt-28 relative z-10">
          <header className="mb-6 text-center">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              贪吃蛇
              <span className="text-indigo-500 ml-2 text-lg md:text-2xl align-middle font-black">SNAKE</span>
            </h1>
            <p className="mt-2 text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">越吃越快 · 越吃越长 · 撞墙撞自己都算输</p>
          </header>
          <SnakeGame />
        </main>
      </PageTransition>
    </div>
  );
}
