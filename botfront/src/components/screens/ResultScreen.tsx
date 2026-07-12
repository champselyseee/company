import type { WorkType } from '../../lib/types'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ResultView } from '../ResultView'
import { tg } from '../../lib/telegram'

export function ResultScreen({ text, type }: { text: string; type: WorkType }) {
  return (
    <Card variant="result">
      <ResultView text={text} type={type} />
      <Button variant="secondary" onClick={() => tg.close()}>
        ← Закрыть
      </Button>
    </Card>
  )
}
