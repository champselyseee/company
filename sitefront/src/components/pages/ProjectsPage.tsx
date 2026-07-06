import { motion, useReducedMotion } from 'motion/react'
import { PROJECTS, type Project } from '../../lib/projects'
import { IconExternal, IconGrid } from '../../lib/icons'
import styles from './ProjectsPage.module.css'

/* Акцентный цвет карточки по порядку — для лёгкого разнообразия. */
const ACCENTS = [styles.accentCoral, styles.accentIndigo, styles.accentGreen, styles.accentYellow]

export function ProjectsPage() {
  const reduce = useReducedMotion()

  return (
    <div>
      {/* ── Геро ── */}
      <section className={`container ${styles.hero}`}>
        <span className={styles.eyebrow}>
          <IconGrid size={15} /> Портфолио
        </span>
        <h1 className={styles.h1}>Наши проекты</h1>
        <p className={styles.lead}>
          То, что мы сделали и развиваем. Нажми на карточку — откроется сам проект в новой вкладке.
        </p>
      </section>

      {/* ── Сетка проектов ── */}
      <section className={`container ${styles.gridWrap}`}>
        <div className={styles.grid}>
          {PROJECTS.map((p, i) => (
            <ProjectCard
              key={p.id}
              project={p}
              accent={ACCENTS[i % ACCENTS.length]}
              index={i}
              reduce={reduce}
            />
          ))}
        </div>
      </section>

      {/* ── Подпись автора ── */}
      <p className={styles.madeBy}>made by Camille</p>
    </div>
  )
}

function ProjectCard({
  project,
  accent,
  index,
  reduce,
}: {
  project: Project
  accent: string
  index: number
  reduce: boolean | null
}) {
  const initial = project.title.trim().charAt(0).toUpperCase()
  return (
    <motion.a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.card} ${accent}`}
      aria-label={`Открыть проект «${project.title}» в новой вкладке`}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Лого */}
      <span className={styles.logo} aria-hidden="true">
        {project.logo ? (
          <img className={styles.logoImg} src={project.logo} alt="" loading="lazy" />
        ) : (
          <span className={styles.logoMono}>{initial}</span>
        )}
      </span>

      {/* Название */}
      <h2 className={styles.cardTitle}>{project.title}</h2>
      {project.tag && <span className={styles.tag}>{project.tag}</span>}

      {/* Описание */}
      <p className={styles.cardDesc}>{project.description}</p>

      {/* Открыть */}
      <span className={styles.cardCta}>
        Открыть <IconExternal size={16} />
      </span>
    </motion.a>
  )
}
