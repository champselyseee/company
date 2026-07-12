import type { WorkType } from '../lib/types'
import { WORK_TYPES, WORK_TYPE_ORDER } from '../lib/workTypes'
import { haptic } from '../lib/telegram'
import styles from './WorkTypePicker.module.css'

interface Props {
  selected: WorkType | null
  onSelect: (type: WorkType) => void
}

export function WorkTypePicker({ selected, onSelect }: Props) {
  function handleSelect(type: WorkType) {
    onSelect(type)
    haptic('light')
  }

  return (
    <div className={styles.list}>
      {WORK_TYPE_ORDER.map((type) => {
        const meta = WORK_TYPES[type]
        const isSelected = selected === type
        return (
          <div
            key={type}
            className={`${styles.card} ${isSelected ? styles.selected : ''}`}
            onClick={() => handleSelect(type)}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSelect(type)
              }
            }}
          >
            <div className={styles.content}>
              <div className={styles.icon}>{meta.icon}</div>
              <div className={styles.info}>
                <div className={styles.title}>{meta.title}</div>
                <div className={styles.subtitle}>{meta.subtitle}</div>
              </div>
              <div className={styles.check}>✓</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
