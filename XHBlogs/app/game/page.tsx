import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import RacerGame from './RacerGame';
import { siteConfig } from '../../siteConfig';

export const metadata = {
  title: `樱花公路 · 赛车 | ${siteConfig.title}`,
  description: 'Canvas 手绘的伪 3D 公路赛车小游戏——樱花树、飘花瓣、拼最长距离。',
};

export default function GamePage() {
  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <main className="w-[95%] md:w-[90%] max-w-5xl mx-auto mt-24 md:mt-28 relative z-10">
          <header className="mb-6 text-center">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              樱花公路
              <span className="text-indigo-500 ml-2 text-lg md:text-2xl align-middle font-black">RACING</span>
            </h1>
          </header>
          <RacerGame />
        </main>
      </PageTransition>
    </div>
  );
}
