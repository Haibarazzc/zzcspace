"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "../../components/Navbar";
import PageTransition from "../../components/PageTransition";
import { photoWallPhotos } from "../../data/albums";

const photos = photoWallPhotos;

export default function PhotoWallClient() {
  const [selectedImage, setSelectedImage] = useState<{ url: string; caption?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = window.setTimeout(() => {
      setActiveQuery(searchQuery.toLowerCase());
      setIsTransitioning(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const visiblePhotos = useMemo(
    () => photos.filter((photo) => photo.caption?.toLowerCase().includes(activeQuery)),
    [activeQuery]
  );

  return (
    <div className="min-h-screen relative pb-32">
      <Navbar />
      <PageTransition>
        <div className="w-full max-w-7xl mx-auto mt-28 px-4 sm:px-10 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-widest mb-2 transition-colors duration-700">光影画廊</h1>
              <p className="text-slate-600 dark:text-slate-400 font-medium tracking-wider transition-colors duration-700">{photos.length} 张照片，按下快门的顺序直接展开</p>
            </div>
            <div className="relative w-full md:w-80 group">
              <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-500 dark:text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="搜索照片描述..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-full text-sm text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm transition-all duration-700"
              />
            </div>
          </div>

          <div className={`transition-opacity duration-300 ease-in-out ${isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}>
            {visiblePhotos.length > 0 ? (
              <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
                {visiblePhotos.map((photo) => (
                  <button
                    key={photo.url}
                    type="button"
                    onClick={() => setSelectedImage(photo)}
                    className="break-inside-avoid relative group rounded-2xl overflow-hidden cursor-zoom-in shadow-lg bg-white/20 dark:bg-slate-800/20 border border-white/30 dark:border-white/10 transition-transform duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/20 text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <img src={photo.url} alt={photo.caption || "照片"} className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-500 flex items-end p-5">
                      <span className="text-white font-medium text-sm drop-shadow-md translate-y-4 group-hover:translate-y-0 group-focus-visible:translate-y-0 transition-transform duration-500">{photo.caption}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500 font-medium">没有找到相关的记忆...</div>
            )}
          </div>
        </div>
      </PageTransition>

      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-10 cursor-zoom-out animate-fade-in" onClick={() => setSelectedImage(null)}>
          <button type="button" aria-label="关闭照片预览" className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-2" onClick={() => setSelectedImage(null)}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
          <img src={selectedImage.url} alt={selectedImage.caption || "全屏照片"} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={(event) => event.stopPropagation()} />
          {selectedImage.caption && <div className="absolute bottom-10 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-white text-sm font-medium tracking-wide shadow-2xl">{selectedImage.caption}</div>}
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}
