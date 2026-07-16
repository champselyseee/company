import type { AttachedFile, WorkType } from '../../lib/types'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ErrorBanner } from '../ui/ErrorBanner'
import { SectionLabel } from '../ui/SectionLabel'
import { WorkTypePicker } from '../WorkTypePicker'
import { PhotoUploader } from '../PhotoUploader'
import { FileUploader } from '../FileUploader'
import { StatsStrip } from '../StatsStrip'
import styles from './FormScreen.module.css'

export interface FormState {
  selectedType: WorkType | null
  photos: string[]
  file: AttachedFile | null
  text: string
}

interface Props {
  form: FormState
  error: { text: string; id: number } | null
  onSelectType: (type: WorkType) => void
  onPhotosChange: (photos: string[]) => void
  onFileChange: (file: AttachedFile | null) => void
  onTextChange: (text: string) => void
  onRecognized: (text: string) => void
  onError: (msg: string) => void
  onSubmit: () => void
}

export function FormScreen({
  form,
  error,
  onSelectType,
  onPhotosChange,
  onFileChange,
  onTextChange,
  onRecognized,
  onError,
  onSubmit,
}: Props) {
  return (
    <Card variant="form">
      <div className={styles.header}>
        <img className={styles.bear} src="/bear.png" alt="" aria-hidden="true" />
        <h1>Проверка работ</h1>
        <p>Тип → фото задания → текст</p>
      </div>

      <StatsStrip />

      {error ? <ErrorBanner key={error.id} message={error.text} /> : null}

      <SectionLabel>Тип работы</SectionLabel>
      <WorkTypePicker selected={form.selectedType} onSelect={onSelectType} />

      <PhotoUploader
        photos={form.photos}
        onChange={onPhotosChange}
        onError={onError}
        onRecognized={onRecognized}
      />

      <FileUploader file={form.file} onChange={onFileChange} onError={onError} />

      <SectionLabel style={{ marginTop: 4 }}>Текст работы</SectionLabel>
      <div className={styles.charCounter}>{form.text.length} символов</div>
      <textarea
        className={styles.textarea}
        placeholder="Вставьте текст вашей работы сюда..."
        value={form.text}
        onChange={(e) => onTextChange(e.target.value)}
      />

      <Button spaced onClick={onSubmit}>
        Отправить на проверку
      </Button>
    </Card>
  )
}
