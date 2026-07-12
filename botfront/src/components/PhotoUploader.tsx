import { useRef, useState } from 'react'
import { MAX_PHOTOS } from '../lib/config'
import { resizeImageToBase64 } from '../lib/image'
import { recognizePhoto } from '../lib/api'
import { SectionLabel } from './ui/SectionLabel'
import styles from './PhotoUploader.module.css'

interface Props {
  photos: string[]
  onChange: (photos: string[]) => void
  onError: (msg: string) => void
  /** Токен для OCR (распознавание не сжигает токен). */
  token: string
  /** Вызывается с распознанным текстом, чтобы дописать его в поле работы. */
  onRecognized: (text: string) => void
}

export function PhotoUploader({ photos, onChange, onError, token, onRecognized }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [ocrBusy, setOcrBusy] = useState(false)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS)
    if (!files.length) return
    try {
      const next: string[] = []
      for (const file of files) next.push(await resizeImageToBase64(file))
      onChange(next)
    } catch (err) {
      onError('❌ ' + (err instanceof Error ? err.message : 'Ошибка изображения'))
    } finally {
      // позволяем повторно выбрать тот же файл
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeAt(index: number) {
    const next = photos.filter((_, i) => i !== index)
    onChange(next)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function runOcr() {
    if (!photos.length || ocrBusy) return
    setOcrBusy(true)
    try {
      const parts: string[] = []
      for (const photo of photos) {
        const text = await recognizePhoto(token, photo)
        if (text) parts.push(text)
      }
      const combined = parts.join('\n\n').trim()
      if (combined) {
        onRecognized(combined)
      } else {
        onError('❌ Не удалось распознать текст на фото')
      }
    } catch (err) {
      onError('❌ ' + (err instanceof Error ? err.message : 'Ошибка распознавания'))
    } finally {
      setOcrBusy(false)
    }
  }

  return (
    <>
      <SectionLabel hint="до 2 фото, необязательно">Фото задания</SectionLabel>

      {photos.length < MAX_PHOTOS && (
        <div className={styles.zone}>
          <label className={styles.dropLabel}>
            <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} />
            <div className={styles.dropIcon}>🖼️</div>
            <div className={styles.dropText}>Прикрепить 1–2 фото задания</div>
          </label>
        </div>
      )}

      {photos.length > 0 && (
        <>
          <div className={styles.grid}>
            {photos.map((src, idx) => (
              <div className={styles.thumb} key={src}>
                <img src={src} alt={`Фото ${idx + 1}`} />
                <button
                  className={styles.remove}
                  onClick={() => removeAt(idx)}
                  aria-label="Удалить фото"
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={styles.ocrBtn}
            onClick={runOcr}
            disabled={ocrBusy}
          >
            {ocrBusy ? '⏳ Распознаём текст…' : '🔍 Распознать текст с фото (рукопись)'}
          </button>
        </>
      )}
    </>
  )
}
