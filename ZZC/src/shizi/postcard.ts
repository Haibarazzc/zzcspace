export const DEFAULT_BLESSING = '愿你向光而生'

const serif = '"Noto Serif SC", "Songti SC", "SimSun", Georgia, serif'

/** Compose the scene and its inscription into a downloadable postcard. */
export async function makePostcard(scene: HTMLCanvasElement, blessing: string): Promise<Blob> {
  if (!scene.width || !scene.height) throw new Error('画面还没有准备好，请稍后再拍。')
  await document.fonts.ready

  const canvas = document.createElement('canvas')
  canvas.width = 1440
  canvas.height = 1160
  const context = canvas.getContext('2d')
  if (!context) throw new Error('暂时无法制作明信片，请重试。')

  context.fillStyle = '#f7f0e4'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(scene, 48, 48, 1344, 896)

  const inscription = blessing.trim() || DEFAULT_BLESSING
  let fontSize = 52
  context.font = `${fontSize}px ${serif}`
  while (context.measureText(inscription).width > 1240 && fontSize > 20) {
    fontSize -= 1
    context.font = `${fontSize}px ${serif}`
  }
  context.fillStyle = '#4b3525'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(inscription, 720, 1015, 1240)

  context.strokeStyle = '#d8c5a7'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(48, 1070)
  context.lineTo(1392, 1070)
  context.stroke()
  context.fillStyle = '#79644f'
  context.font = `25px ${serif}`
  context.fillText('南方科技大学 · 致新书院', 720, 1115)

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('图片生成失败，请再拍一次。'))
      }, 'image/png')
    } catch {
      reject(new Error('图片暂时无法导出，请再拍一次。'))
    }
  })
}
