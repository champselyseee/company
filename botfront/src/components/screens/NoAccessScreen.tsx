import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { tg } from '../../lib/telegram'
import shared from './Screens.module.css'

export function NoAccessScreen({ message }: { message: string }) {
  const lines = message.split('\n')
  return (
    <Card variant="noaccess">
      <div className={shared.noAccessIcon}>🔒</div>
      <div className={shared.noAccessTitle}>Нет доступа</div>
      <div className={shared.noAccessSub}>
        {lines.map((line, i) => (
          <span key={i}>
            {line}
            {i < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </div>
      <Button onClick={() => tg.close()}>Вернуться в бот</Button>
    </Card>
  )
}
