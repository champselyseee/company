import { Card } from '../ui/Card'
import { Spinner } from '../ui/Spinner'
import { LoadingDots } from '../ui/LoadingDots'
import shared from './Screens.module.css'

export function LoadingScreen() {
  return (
    <Card variant="loading">
      <Spinner />
      <div className={shared.loadingTitle}>
        Проверяем работу
        <LoadingDots />
      </div>
      <div className={shared.loadingSub}>
        Модель анализирует текст по критериям ЕГЭ.
        <br />
        Обычно занимает 1–3 минуты.
      </div>
    </Card>
  )
}
