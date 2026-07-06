import { useState } from 'react'
import { Button } from '../ui/Button'
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentMethodId,
  type PurchaseOffer,
} from '../../lib/billing'
import { IconArrowRight, IconCheck, IconStar, IconTelegram } from '../../lib/icons'
import type { Page } from '../../lib/nav'
import styles from './CheckoutPage.module.css'

export function CheckoutPage({
  offer,
  onConfirm,
  onNavigate,
}: {
  offer: PurchaseOffer | null
  onConfirm: (offer: PurchaseOffer, method: PaymentMethod) => void
  onNavigate: (p: Page) => void
}) {
  const [methodId, setMethodId] = useState<PaymentMethodId>(PAYMENT_METHODS[0].id)
  const [promo, setPromo] = useState('')
  const [paying, setPaying] = useState(false)

  // Пустое состояние: на оформление зашли без выбранного тарифа.
  if (!offer) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <IconStar size={30} />
          </span>
          <h1 className={styles.emptyTitle}>Сначала выберите тариф</h1>
          <p className={styles.emptyText}>
            Загляните на страницу тарифов и выберите пакет проверок или подписку — тогда здесь
            появится оформление.
          </p>
          <Button onClick={() => onNavigate('pricing')} trailing={<IconArrowRight size={18} />}>
            К тарифам
          </Button>
        </div>
      </div>
    )
  }

  const method = PAYMENT_METHODS.find((m) => m.id === methodId) ?? PAYMENT_METHODS[0]

  function pay() {
    if (!offer) return
    setPaying(true)
    // Имитация оплаты: бэкенда нет, показываем «загрузку», затем подтверждаем.
    window.setTimeout(() => {
      setPaying(false)
      onConfirm(offer, method)
    }, 1200)
  }

  return (
    <div className={`container ${styles.page}`}>
      <button className={styles.back} onClick={() => onNavigate('pricing')}>
        ← К тарифам
      </button>
      <h1 className={styles.h1}>Оформление</h1>

      <div className={styles.layout}>
        {/* Левая колонка: заказ + оплата */}
        <div className={styles.main}>
          {/* Сводка заказа */}
          <div className={styles.summary}>
            <span className={styles.summaryKicker}>Ваш заказ</span>
            <h2 className={styles.summaryTitle}>{offer.title}</h2>
            <p className={styles.summarySub}>{offer.subtitle}</p>
            <div className={styles.summaryRow}>
              <span>Будет начислено</span>
              <b>+{offer.checksAdded}</b>
            </div>
          </div>

          {/* Выбор способа оплаты */}
          <h3 className={styles.blockTitle}>Способ оплаты</h3>
          <div className={styles.methods} role="radiogroup" aria-label="Способ оплаты">
            {PAYMENT_METHODS.map((m) => {
              const selected = m.id === methodId
              return (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={selected}
                  className={`${styles.method} ${selected ? styles.methodOn : ''}`}
                  onClick={() => setMethodId(m.id)}
                >
                  <span className={styles.methodIcon} aria-hidden="true">
                    {m.iconKey === 'telegram' ? <IconTelegram size={20} /> : <b>Ю</b>}
                  </span>
                  <span className={styles.methodBody}>
                    <span className={styles.methodLabel}>{m.label}</span>
                    <span className={styles.methodNote}>{m.note}</span>
                  </span>
                  <span className={`${styles.radioMark} ${selected ? styles.radioOn : ''}`}>
                    {selected && <IconCheck size={14} />}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Промокод */}
          <h3 className={styles.blockTitle}>Промокод</h3>
          <input
            className={styles.promo}
            type="text"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="Если есть — введите здесь"
            aria-label="Промокод"
          />
        </div>

        {/* Правая колонка: итог */}
        <aside className={styles.aside}>
          <div className={styles.total}>
            <div className={styles.totalRow}>
              <span>Тариф</span>
              <span>{offer.price.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className={styles.totalRow}>
              <span>Оплата</span>
              <span>{method.label}</span>
            </div>
            <div className={styles.totalDivider} />
            <div className={styles.totalSum}>
              <span>Итого</span>
              <b>{offer.price.toLocaleString('ru-RU')} ₽</b>
            </div>
            <Button
              fullWidth
              size="lg"
              className={styles.payBtn}
              onClick={pay}
              disabled={paying}
              leading={paying ? undefined : <IconCheck size={20} />}
            >
              {paying ? 'Оплачиваем…' : `Оплатить ${offer.price.toLocaleString('ru-RU')} ₽`}
            </Button>
            <p className={styles.disclaimer}>
              Демо-оплата: деньги реально не списываются, проверки начислятся для примера.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
