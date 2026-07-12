import { useRef } from 'react'
import { MAX_FILE_BYTES } from '../lib/config'
import { fileToDataUrl } from '../lib/image'
import type { AttachedFile } from '../lib/types'
import { SectionLabel } from './ui/SectionLabel'
import styles from './FileUploader.module.css'

const ACCEPT =
  '.txt,.md,.csv,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*'

interface Props {
  file: AttachedFile | null
  onChange: (file: AttachedFile | null) => void
  onError: (msg: string) => void
}

export function FileUploader({ file, onChange, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_FILE_BYTES) {
      onError('⚠️ Файл слишком большой. Максимум 8 МБ')
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    try {
      onChange({
        name: f.name,
        type: f.type || 'application/octet-stream',
        size: f.size,
        data: await fileToDataUrl(f),
      })
    } catch (err) {
      onError('❌ ' + (err instanceof Error ? err.message : 'Ошибка файла'))
    }
  }

  function remove() {
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <SectionLabel hint="TXT/PDF/DOCX, необязательно">Файл</SectionLabel>

      {!file ? (
        <div className={styles.zone}>
          <label className={styles.dropLabel}>
            <input ref={inputRef} type="file" accept={ACCEPT} onChange={handleFile} />
            <div className={styles.dropIcon}>📎</div>
            <div className={styles.dropText}>Прикрепить файл</div>
          </label>
        </div>
      ) : (
        <div className={styles.preview}>
          <div className={styles.previewText}>
            <div className={styles.name}>{file.name}</div>
            <div className={styles.meta}>{Math.ceil(file.size / 1024)} КБ</div>
          </div>
          <button className={styles.remove} onClick={remove} aria-label="Удалить файл" type="button">
            ✕
          </button>
        </div>
      )}
    </>
  )
}
