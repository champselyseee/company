import { motion, useReducedMotion } from 'motion/react'
import {
  IconArrowRight,
  IconCamera,
  IconCheck,
  IconCheckDoc,
  IconSparkles,
  IconTelegram,
} from '../../lib/icons'
import styles from './ProjectsPage.module.css'

/* Страница «Telegram-бот»: та же проверка по критериям ЕГЭ, только внутри Telegram.
   Оформление повторяет главную (геро со стикерами и медведем, плашка-приглашение).
   Все кнопки ведут на бота и открываются в новой вкладке. */
const BOT_URL = 'https://t.me/Egessay_bot'
const BOT_HANDLE = '@Egessay_bot'

const STEPS = [
  {
    icon: IconTelegram,
    title: 'Открой бота',
    text: `Перейди в ${BOT_HANDLE} и нажми «Запустить» — вход через твой Telegram.`,
  },
  {
    icon: IconCamera,
    title: 'Отправь работу',
    text: 'Открой проверку прямо в боте: вставь текст или сфотографируй работу — текст распознаем сами.',
  },
  {
    icon: IconCheckDoc,
    title: 'Получи разбор',
    text: 'Баллы по каждому критерию и советы, что подтянуть, — тот же разбор, что и на сайте.',
  },
]

export function ProjectsPage() {
  const reduce = useReducedMotion()

  return (
    <div>
      {/* ── Геро ── */}
      <section className={`container ${styles.hero}`}>
        <div>
          <span className={styles.eyebrow}>
            <IconTelegram size={15} /> Telegram-бот
          </span>
          <h1 className={styles.h1}>
            Та же <span className={styles.markCoral}>проверка</span> — прямо в{' '}
            <span className={styles.markIndigo}>Telegram</span>
          </h1>
          <p className={styles.lead}>
            Эссе по английскому и сочинение по русскому — по тем же критериям ЕГЭ, что и на
            сайте. Только всё в Telegram: открыл бота и проверяешь работу с телефона.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.cta} href={BOT_URL} target="_blank" rel="noopener noreferrer">
              <IconTelegram size={20} />
              Открыть бота
              <IconArrowRight size={20} />
            </a>
          </div>
          <p className={styles.note}>{BOT_HANDLE} · откроется в Telegram</p>
        </div>

        {/* Декоративные «стикеры», как на главной */}
        <div className={styles.heroArt} aria-hidden="true">
          <motion.div
            className={`${styles.sticker} ${styles.stickerA}`}
            initial={reduce ? false : { opacity: 0, y: 24, rotate: -10 }}
            animate={{ opacity: 1, y: 0, rotate: -6 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20, delay: 0.05 }}
          >
            <span className={styles.stickerScore}>11/14</span>
            <span className={styles.stickerCap}>Эссе · English</span>
          </motion.div>
          <motion.div
            className={`${styles.sticker} ${styles.stickerB}`}
            initial={reduce ? false : { opacity: 0, y: 24, rotate: 8 }}
            animate={{ opacity: 1, y: 0, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20, delay: 0.15 }}
          >
            <span className={styles.stickerScore}>18/22</span>
            <span className={styles.stickerCap}>Сочинение · Рус</span>
          </motion.div>
          <motion.div
            className={`${styles.sticker} ${styles.stickerC}`}
            initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: -14 }}
            animate={{ opacity: 1, scale: 1, rotate: -8 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.25 }}
          >
            <IconTelegram size={30} />
          </motion.div>
          <img className={styles.heroBear} src="/bear.png" alt="" />
        </div>
      </section>

      {/* ── Как это работает ── */}
      <section className={`container ${styles.stepsSection}`}>
        <div className={styles.stepsHead}>
          <h2 className={styles.h2}>Как это работает</h2>
          <p className={styles.h2sub}>Три шага — и разбор у тебя в Telegram.</p>
        </div>
        <ol className={styles.steps}>
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.li
                key={s.title}
                className={styles.step}
                initial={reduce ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className={styles.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.stepIcon} aria-hidden="true">
                  <Icon size={24} />
                </span>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepText}>{s.text}</p>
              </motion.li>
            )
          })}
        </ol>
      </section>

      {/* ── Финальная плашка ── */}
      <section className={`container ${styles.finalWrap}`}>
        <motion.div
          className={styles.finalCard}
          initial={reduce ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        >
          <div className={styles.finalText}>
            <span className={styles.finalEyebrow}>
              <IconSparkles size={15} /> Всегда под рукой
            </span>
            <h2 className={styles.finalTitle}>
              Проверяй работы <span className={styles.finalAccent}>там, где удобно</span>
            </h2>
            <p className={styles.finalLead}>
              <IconCheck size={16} /> На сайте с компьютера или в Telegram с телефона — критерии
              и разбор одинаковые.
            </p>
          </div>
          <a className={styles.finalBtn} href={BOT_URL} target="_blank" rel="noopener noreferrer">
            <IconTelegram size={20} />
            Открыть {BOT_HANDLE}
          </a>
        </motion.div>
      </section>

      {/* ── Подпись автора ── */}
      <p className={styles.madeBy}>made by Camille</p>
    </div>
  )
}
