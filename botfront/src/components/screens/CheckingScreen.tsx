import { Card } from '../ui/Card'
import { Spinner } from '../ui/Spinner'
import { LoadingDots } from '../ui/LoadingDots'
import shared from './Screens.module.css'

export function CheckingScreen({ message }: { message: string }) {
  return (
    <Card variant="loading">
      <Spinner />
      <div className={shared.loadingTitle}>
        {message}
        <LoadingDots />
      </div>
    </Card>
  )
}
