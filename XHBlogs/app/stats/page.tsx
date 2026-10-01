import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import StatsClient from './StatsClient';
import { siteConfig } from '../../siteConfig';

// 私人统计面板：不进导航、不允许搜索引擎收录
export const metadata = {
  title: `访问统计 | ${siteConfig.title}`,
  robots: { index: false, follow: false },
};

export default function StatsPage() {
  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <main className="w-[95%] md:w-[90%] max-w-5xl mx-auto mt-24 md:mt-28 relative z-10">
          <StatsClient />
        </main>
      </PageTransition>
    </div>
  );
}
