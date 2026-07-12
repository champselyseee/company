import { IMAGE_JPEG_QUALITY, IMAGE_MAX_SIDE } from './config'

/** Сжимает изображение до IMAGE_MAX_SIDE по большей стороне и кодирует в JPEG data URL. */
export function resizeImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width
        let h = img.height
        if (w > IMAGE_MAX_SIDE || h > IMAGE_MAX_SIDE) {
          if (w > h) {
            h = Math.round((h * IMAGE_MAX_SIDE) / w)
            w = IMAGE_MAX_SIDE
          } else {
            w = Math.round((w * IMAGE_MAX_SIDE) / h)
            h = IMAGE_MAX_SIDE
          }
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Не удалось обработать изображение'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY))
      }
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'))
      img.src = ev.target?.result as string
    }
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

/** Читает произвольный файл в data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => resolve(ev.target?.result as string)
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}
