import { useEffect, useMemo } from 'react'
import * as T from 'three'
import markUrl from './zhixin-mark.jpg'

export default function useEmblemTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const map = new T.CanvasTexture(canvas)
    map.colorSpace = T.SRGBColorSpace
    map.anisotropy = 8
    const image = new Image()
    image.onload = () => {
      const src = document.createElement('canvas')
      src.width = image.width
      src.height = image.height
      const source = src.getContext('2d')!
      source.drawImage(image, 0, 0)
      const data = source.getImageData(0, 0, src.width, src.height)
      const px = data.data
      let minX = src.width
      let minY = src.height
      let maxX = 0
      let maxY = 0
      for (let y = 0, i = 0; y < src.height; y++) {
        for (let x = 0; x < src.width; x++, i += 4) {
          const lum = Math.max(px[i], px[i + 1], px[i + 2])
          const t = T.MathUtils.smoothstep(lum, 28, 72)
          px[i] = px[i + 1] = px[i + 2] = 255
          px[i + 3] = Math.round(t * 255)
          if (t > 0.2) {
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
          }
        }
      }
      source.putImageData(data, 0, 0)
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const cropW = Math.max(1, maxX - minX)
      const cropH = Math.max(1, maxY - minY)
      const maxW = canvas.width * 0.96
      const maxH = canvas.height * 0.92
      const aspect = cropW / cropH
      let w = maxW
      let h = w / aspect
      if (h > maxH) {
        h = maxH
        w = h * aspect
      }
      ctx.drawImage(src, minX, minY, cropW, cropH, (canvas.width - w) / 2, (canvas.height - h) / 2 + canvas.height * 0.02, w, h)
      map.needsUpdate = true
    }
    image.src = markUrl
    return map
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}
