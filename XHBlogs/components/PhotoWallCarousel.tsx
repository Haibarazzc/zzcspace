"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { albums, ungroupedPhotos } from "../data/albums";

const photos = albums.flatMap((album) =>
  album.photos.map((photo) => ({ ...photo, albumTitle: album.title }))
).concat(ungroupedPhotos.map((photo) => ({ ...photo, albumTitle: "新加入的瞬间" })));

export default function PhotoWallCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % photos.length), 5500);
    return () => window.clearInterval(timer);
  }, []);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div data-photo-url={photo.url} className="w-full rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl overflow-hidden transition-all duration-700 hover:scale-[1.02] relative group min-h-[200px] sm:min-h-[220px] flex-shrink-0">
      <Link href="/photowall" className="absolute inset-0 z-20" aria-label="浏览照片墙" />
      <AnimatePresence mode="wait">
        <motion.div
          key={photo.url}
          initial={{ opacity: 0, filter: "blur(8px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.75, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img src={photo.url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10 pointer-events-none" />
      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 right-6 z-10 pointer-events-none">
        <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-1">{photo.albumTitle}</p>
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 underline decoration-pink-400">光影画廊</h3>
        <p className="text-white/90 text-sm sm:text-lg line-clamp-1">{photo.caption}</p>
      </div>
      <div className="absolute bottom-5 right-6 z-30 flex gap-2">
        {photos.map((item, itemIndex) => (
          <button
            key={item.url}
            type="button"
            onClick={() => setIndex(itemIndex)}
            className={`h-1.5 rounded-full transition-all duration-500 ${itemIndex === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"}`}
            aria-label={`切换到照片 ${itemIndex + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
