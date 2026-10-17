import { useEffect, useRef } from 'react'
import { createRainyStoreScene, type SceneHandle } from './scene'
import './rainy-store.css'

/** A miniature rainy konbini corner — drag to orbit, wheel / pinch to zoom.
 *  No chrome, no buttons: the model is the whole page. */
export default function RainyStore() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const previousTitle = document.title
    document.title = '雨夜便利店 · ほしぞらマート'
    document.documentElement.classList.add('rs-document')
    document.documentElement.lang = 'zh-CN'

    let handle: SceneHandle | null = null
    try {
      handle = createRainyStoreScene(el)
    } catch (error) {
      console.error('[rainy-store] WebGL init failed', error)
    }

    return () => {
      handle?.dispose()
      document.title = previousTitle
      document.documentElement.classList.remove('rs-document')
    }
  }, [])

  return <div className="rs-stage" ref={host} aria-label="雨夜便利店微缩模型，可拖动旋转、滚轮缩放" role="img" />
}
