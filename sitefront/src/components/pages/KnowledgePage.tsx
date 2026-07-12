import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '../ui/Button'
import { useCountUp } from '../../lib/useCountUp'
import {
  KB_ANTI_MISTAKES,
  KB_ARGUMENTS,
  KB_CATEGORIES,
  KB_META,
  KB_MODES,
  KB_PROBLEMS,
  KB_STRATEGIES,
  KB_TOP_WORKS,
  KB_UI,
  MODES_WITH_DATA,
  filterByCategory,
  searchArguments,
  type KBAntiMistake,
  type KBArgument,
  type KBLiteraryArgument,
  type KBHistoricalArgument,
  type KBProblem,
  type KBStrategy,
  type KBTopWork,
} from '../../lib/knowledge'
import {
  IconArrowRight,
  IconCamera,
  IconCheckDoc,
  IconChevron,
  IconClose,
  IconFlame,
  IconSparkles,
  IconStar,
  IconTrophy,
  IconUser,
} from '../../lib/icons'
import styles from './KnowledgePage.module.css'

type IconCmp = (p: { size?: number }) => JSX.Element

/* Иконки интерфейса для вкладок — SVG из общего набора, а не эмодзи из данных. */
const MODE_ICONS: Record<string, IconCmp> = {
  all_arguments: IconSparkles,
  by_problems: IconCheckDoc,
  top20: IconTrophy,
  strategies: IconFlame,
  anti_mistakes: IconClose,
}

/* Правдивая статистика для геро — считаем из реальных данных (meta.stats в JSON
   расходится с фактом: там 15 проблем и 4 режима, а реально 8 и 5). */
const STATS: { value: number; label: string }[] = [
  { value: KB_ARGUMENTS.length, label: 'аргументов в банке' },
  { value: KB_PROBLEMS.length, label: 'разборов проблем ЕГЭ' },
  { value: KB_CATEGORIES.length - 1, label: 'категорий аргументов' },
  { value: KB_MODES.length, label: 'разделов базы' },
]

export function KnowledgePage() {
  const [mode, setMode] = useState<string>('all_arguments')

  // Состояние вкладки «Все аргументы» держим здесь, чтобы клик по тегу из карточки
  // мог переключить вкладку и подставить тег в поиск.
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Все')

  function searchTag(tag: string) {
    setCategory('Все')
    setQuery(tag)
    setMode('all_arguments')
  }

  return (
    <div>
      {/* ── Геро ── */}
      <section className={`container ${styles.hero}`}>
        <span className={styles.eyebrow}>
          <IconSparkles size={15} /> Подготовка к сочинению ЕГЭ
        </span>
        <h1 className={styles.h1}>Лучшие аргументы для сочинения</h1>
        <p className={styles.lead}>{KB_META.subtitle}</p>

        <div className={styles.stats}>
          {STATS.map((s) => (
            <StatTile key={s.label} value={s.value} label={s.label} />
          ))}
        </div>
      </section>

      {/* ── Вкладки ── */}
      <section className={`container ${styles.tabsWrap}`}>
        <div className={styles.tabs} role="tablist" aria-label="Разделы базы знаний">
          {KB_MODES.map((m) => {
            const Icon = MODE_ICONS[m.id] ?? IconStar
            const active = mode === m.id
            return (
              <button
                key={m.id}
                role="tab"
                id={`kb-tab-${m.id}`}
                aria-selected={active}
                aria-controls={`kb-panel-${m.id}`}
                className={`${styles.tab} ${active ? styles.tabActive : ''}`}
                onClick={() => setMode(m.id)}
              >
                {active && (
                  <motion.span
                    layoutId="kb-tab-pill"
                    className={styles.tabPill}
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                  />
                )}
                <span className={styles.tabIcon}>
                  <Icon size={17} />
                </span>
                <span className={styles.tabLabel}>{m.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Контент активной вкладки ── */}
      <section
        className={`container ${styles.panel}`}
        role="tabpanel"
        id={`kb-panel-${mode}`}
        aria-labelledby={`kb-tab-${mode}`}
        tabIndex={0}
      >
        {mode === 'all_arguments' && (
          <AllArgumentsTab
            query={query}
            setQuery={setQuery}
            category={category}
            setCategory={setCategory}
            onTag={searchTag}
          />
        )}
        {mode === 'by_problems' && <ProblemsTab />}
        {mode === 'top20' && <Top20Tab />}
        {mode === 'strategies' && <StrategiesTab />}
        {mode === 'anti_mistakes' && <AntiMistakesTab />}
        {!MODES_WITH_DATA.has(mode) && (
          <ComingSoon
            title={KB_MODES.find((m) => m.id === mode)?.label ?? 'Раздел'}
            onBack={() => setMode('all_arguments')}
          />
        )}
      </section>
    </div>
  )
}

/* ── Плитка статистики (анимация числа как на странице проверки) ── */
function StatTile({ value, label }: { value: number; label: string }) {
  const n = useCountUp(value)
  return (
    <div className={styles.statTile}>
      <span className={styles.statValue}>{n.toLocaleString('ru-RU')}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

/* ────────────────────────────────────────
   Вкладка «Все аргументы»
   ──────────────────────────────────────── */
function AllArgumentsTab({
  query,
  setQuery,
  category,
  setCategory,
  onTag,
}: {
  query: string
  setQuery: (v: string) => void
  category: string
  setCategory: (v: string) => void
  onTag: (tag: string) => void
}) {
  // 115 аргументов фильтруются мгновенно — дебаунс не нужен.
  const result = useMemo(
    () => searchArguments(filterByCategory(KB_ARGUMENTS, category), query),
    [query, category],
  )

  return (
    <div>
      <h2 className={styles.h2}>{KB_UI.all_arguments_heading}</h2>

      {/* Поиск */}
      <div className={styles.searchRow}>
        <span className={styles.searchIcon} aria-hidden="true">
          {KB_UI.search_placeholder}
        </span>
        <input
          className={styles.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по аргументам, авторам, тегам…"
          aria-label="Поиск по аргументам"
        />
        {query && (
          <button className={styles.searchClear} onClick={() => setQuery('')} aria-label="Очистить поиск">
            <IconClose size={16} />
          </button>
        )}
      </div>

      {/* Фильтры категорий */}
      <div className={styles.chips} role="group" aria-label="Фильтр по категории">
        {KB_CATEGORIES.map((c) => {
          const active = category === c
          return (
            <button
              key={c}
              className={`${styles.chip} ${active ? styles.chipActive : ''}`}
              onClick={() => setCategory(c)}
              aria-pressed={active}
            >
              {c}
            </button>
          )
        })}
      </div>

      <p className={styles.count}>
        Найдено: <b>{result.length}</b>
      </p>

      {result.length === 0 ? (
        <div className={styles.empty}>
          <p>{KB_UI.empty_search}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setQuery('')
              setCategory('Все')
            }}
          >
            Сбросить поиск
          </Button>
        </div>
      ) : (
        <div className={styles.argGrid}>
          {result.map((a, i) => (
            <ArgumentCard key={`${a.title}-${i}`} arg={a} onTag={onTag} />
          ))}
        </div>
      )}
    </div>
  )
}

function ArgumentCard({ arg, onTag }: { arg: KBArgument; onTag: (tag: string) => void }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  return (
    <div className={`${styles.argCard} ${open ? styles.argCardOpen : ''}`}>
      <button className={styles.argHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.argCat}>{arg.category}</span>
        <span className={styles.argTitle}>{arg.title}</span>
        <span className={styles.argSource}>{arg.source}</span>
        <span className={`${styles.argChevron} ${open ? styles.argChevronOpen : ''}`} aria-hidden="true">
          <IconChevron size={18} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.argBodyWrap}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.argBody}>
              <p className={styles.argText}>{arg.text}</p>
              <div className={styles.tags}>
                {arg.tags.map((t) => (
                  <button key={t} className={styles.tag} onClick={() => onTag(t)}>
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ────────────────────────────────────────
   Вкладка «По проблемам ЕГЭ»
   ──────────────────────────────────────── */
function ProblemsTab() {
  return (
    <div>
      <h2 className={styles.h2}>Проблемы ЕГЭ — полные разборы</h2>
      <p className={styles.hint}>{KB_UI.problem_hint}</p>
      <div className={styles.problemList}>
        {KB_PROBLEMS.map((p) => (
          <ProblemCard key={p.id} problem={p} />
        ))}
      </div>
    </div>
  )
}

function ProblemCard({ problem }: { problem: KBProblem }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  return (
    <div className={`${styles.problem} ${open ? styles.problemOpen : ''}`}>
      <button className={styles.problemHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.problemId}>{problem.id}</span>
        <span className={styles.problemHeadText}>
          <span className={styles.problemTitle}>{problem.title}</span>
          <span className={styles.problemQuestions}>{problem.questions}</span>
        </span>
        <span className={`${styles.argChevron} ${open ? styles.argChevronOpen : ''}`} aria-hidden="true">
          <IconChevron size={20} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.argBodyWrap}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.problemBody}>
              <p className={styles.problemDesc}>{problem.description}</p>

              <Block label="Позиция авторов" tone="indigo">
                {problem.authors_position}
              </Block>

              <div className={styles.tags}>
                {problem.tags.map((t) => (
                  <span key={t} className={styles.tagStatic}>
                    #{t}
                  </span>
                ))}
              </div>

              <Block label="Шаблон вступления">{problem.intro_template}</Block>
              <Block label="Шаблон вывода">{problem.conclusion_template}</Block>

              <SubHead>Литературные аргументы</SubHead>
              <div className={styles.argBlocks}>
                {problem.literary_arguments.map((la, i) => (
                  <LiteraryBlock key={i} arg={la} />
                ))}
              </div>

              {problem.historical_arguments.length > 0 && (
                <>
                  <SubHead>Исторические аргументы</SubHead>
                  <div className={styles.argBlocks}>
                    {problem.historical_arguments.map((ha, i) => (
                      <PlainBlock key={i} arg={ha} />
                    ))}
                  </div>
                </>
              )}

              {problem.scientific_arguments.length > 0 && (
                <>
                  <SubHead>Научные аргументы</SubHead>
                  <div className={styles.argBlocks}>
                    {problem.scientific_arguments.map((sa, i) => (
                      <PlainBlock key={i} arg={sa} />
                    ))}
                  </div>
                </>
              )}

              <SubHead>Готовые фразы</SubHead>
              <ul className={styles.phraseList}>
                {problem.ready_phrases.map((ph, i) => (
                  <li key={i}>{ph}</li>
                ))}
              </ul>

              <SubHead>Типичные ошибки</SubHead>
              <ul className={styles.mistakeList}>
                {problem.common_mistakes.map((m, i) => (
                  <li key={i}>
                    <span className={styles.mistakeMark} aria-hidden="true">
                      <IconClose size={14} />
                    </span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>

              {problem.also_fits_tags.length > 0 && (
                <div className={styles.alsoFits}>
                  <span className={styles.alsoFitsLabel}>Подходит ещё к темам:</span>
                  <div className={styles.tags}>
                    {problem.also_fits_tags.map((t) => (
                      <span key={t} className={styles.tagStatic}>
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LiteraryBlock({ arg }: { arg: KBLiteraryArgument }) {
  return (
    <div className={styles.argBlock}>
      <div className={styles.argBlockHead}>
        <span className={styles.argBlockSource}>{arg.source}</span>
        <div className={styles.badges}>
          {arg.badges.map((b) => (
            <span key={b} className={styles.badge}>
              {b}
            </span>
          ))}
        </div>
      </div>
      <p className={styles.argMeta}>
        <IconUser size={15} /> {arg.hero}
      </p>
      <p className={styles.argMeta}>
        <IconCamera size={15} /> {arg.episode}
      </p>
      <p className={styles.argThesis}>{arg.thesis}</p>
      <p className={styles.argConclusion}>
        <IconArrowRight size={15} /> {arg.conclusion}
      </p>
    </div>
  )
}

function PlainBlock({ arg }: { arg: KBHistoricalArgument }) {
  return (
    <div className={styles.argBlock}>
      <span className={styles.argBlockSource}>{arg.source}</span>
      <p className={styles.argThesis}>{arg.text}</p>
      <p className={styles.argConclusion}>
        <IconArrowRight size={15} /> {arg.conclusion}
      </p>
    </div>
  )
}

function Block({
  label,
  tone,
  children,
}: {
  label: string
  tone?: 'indigo'
  children: React.ReactNode
}) {
  return (
    <div className={`${styles.block} ${tone === 'indigo' ? styles.blockIndigo : ''}`}>
      <span className={styles.blockLabel}>{label}</span>
      <p className={styles.blockText}>{children}</p>
    </div>
  )
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <h3 className={styles.subHead}>{children}</h3>
}

/* ────────────────────────────────────────
   Вкладка «ТОП-20 произведений»
   ──────────────────────────────────────── */
function Top20Tab() {
  return (
    <div>
      <h2 className={styles.h2}>ТОП-20 произведений</h2>
      <p className={styles.hint}>
        Обязательный минимум. Выучи эти произведения — они закрывают большинство тем сочинения.
        Одно сильное произведение работает сразу под несколько проблем.
      </p>
      <div className={styles.topGrid}>
        {KB_TOP_WORKS.map((w, i) => (
          <TopWorkCard key={`${w.work}-${i}`} rank={i + 1} work={w} />
        ))}
      </div>
    </div>
  )
}

function TopWorkCard({ rank, work }: { rank: number; work: KBTopWork }) {
  return (
    <div className={styles.topCard}>
      <div className={styles.topHead}>
        <span className={styles.topRank}>{rank}</span>
        <span className={styles.topTitles}>
          <span className={styles.topWork}>{work.work}</span>
          <span className={styles.topAuthor}>{work.author}</span>
        </span>
      </div>
      {work.topics.length > 0 && (
        <div className={styles.topTopics}>
          {work.topics.map((t) => (
            <span key={t} className={styles.tagStatic}>
              {t}
            </span>
          ))}
        </div>
      )}
      <div className={styles.topMeta}>
        {work.badge && <span className={styles.badge}>{work.badge}</span>}
        {work.frequency && (
          <span className={styles.topFreq}>
            <IconFlame size={13} /> {work.frequency}
          </span>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────
   Вкладка «Стратегии подготовки»
   ──────────────────────────────────────── */
function StrategiesTab() {
  return (
    <div>
      <h2 className={styles.h2}>Стратегии подготовки</h2>
      <p className={styles.hint}>
        Выбери план по времени, которое осталось до экзамена — от экстренного разбора за день
        до уровня на 90+ баллов.
      </p>
      <div className={styles.problemList}>
        {KB_STRATEGIES.map((s) => (
          <StrategyCard key={s.id} strategy={s} />
        ))}
      </div>
    </div>
  )
}

function StrategyCard({ strategy }: { strategy: KBStrategy }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const tip = strategy.tip.replace(/^[^\p{L}]+/u, '').trim()
  return (
    <div className={`${styles.problem} ${open ? styles.problemOpen : ''}`}>
      <button className={styles.problemHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.problemId}>{strategy.id}</span>
        <span className={styles.problemHeadText}>
          <span className={styles.problemTitle}>{strategy.title}</span>
          <span className={styles.problemQuestions}>{strategy.intro}</span>
        </span>
        <span className={`${styles.argChevron} ${open ? styles.argChevronOpen : ''}`} aria-hidden="true">
          <IconChevron size={20} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.argBodyWrap}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.problemBody}>
              {strategy.groups.map((g) => (
                <div key={g.label}>
                  <SubHead>{g.label}</SubHead>
                  <ul className={styles.prepList}>
                    {g.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {tip && (
                <div className={`${styles.block} ${styles.blockIndigo}`}>
                  <span className={styles.blockLabel}>
                    <IconSparkles size={13} /> Совет
                  </span>
                  <p className={styles.blockText}>{tip}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ────────────────────────────────────────
   Вкладка «Антиошибки»
   ──────────────────────────────────────── */
function AntiMistakesTab() {
  return (
    <div>
      <h2 className={styles.h2}>Антиошибки</h2>
      <p className={styles.hint}>
        Частые ошибки, из-за которых теряют баллы: путаница авторов и героев, слабая аргументация,
        оформление. Пробегись по списку перед экзаменом.
      </p>
      <div className={styles.problemList}>
        {KB_ANTI_MISTAKES.map((block) => (
          <AntiMistakeCard key={block.id} block={block} />
        ))}
      </div>
    </div>
  )
}

function AntiMistakeCard({ block }: { block: KBAntiMistake }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  return (
    <div className={`${styles.problem} ${open ? styles.problemOpen : ''}`}>
      <button className={styles.problemHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.problemIdWarn} aria-hidden="true">
          <IconClose size={22} />
        </span>
        <span className={styles.problemHeadText}>
          <span className={styles.problemTitle}>{block.title}</span>
          <span className={styles.problemQuestions}>{block.items.length} ошибок</span>
        </span>
        <span className={`${styles.argChevron} ${open ? styles.argChevronOpen : ''}`} aria-hidden="true">
          <IconChevron size={20} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.argBodyWrap}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.problemBody}>
              <ul className={styles.mistakeList} style={{ marginTop: 16 }}>
                {block.items.map((m, i) => (
                  <li key={i}>
                    <span className={styles.mistakeMark} aria-hidden="true">
                      <IconClose size={14} />
                    </span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ────────────────────────────────────────
   Заглушка «Скоро» для вкладок без данных
   ──────────────────────────────────────── */
function ComingSoon({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className={styles.soon}>
      <span className={styles.soonIcon} aria-hidden="true">
        <IconStar size={30} />
      </span>
      <h2 className={styles.soonTitle}>«{title}» — скоро</h2>
      <p className={styles.soonText}>
        Этот раздел в работе: наполняем его материалами. А пока загляни в «Все аргументы»
        и «По проблемам ЕГЭ» — там уже всё готово.
      </p>
      <Button onClick={onBack} trailing={<IconArrowRight size={18} />}>
        К аргументам
      </Button>
    </div>
  )
}
