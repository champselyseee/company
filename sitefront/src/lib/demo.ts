/* Демо-результаты проверки. На сайте-шаблоне обращения к серверу нет —
   кнопка «Проверить» / «Посмотреть пример» показывает эти заготовки, чтобы
   продемонстрировать вид разбора (как в реальном фронте бота).

   ВАЖНО: это ВРЕМЕННЫЕ примеры. Позже текст работ и их разметку ошибок
   заменим на готовые — структура (StructuredResult) при этом не меняется.

   Как устроен один разбор (StructuredResult):
   - score / max_score — итоговый балл и максимум;
   - segments[]        — текст работы кусочками; у каждого кусочка тип ошибки
                         (e), которым он подсвечивается. Сумма кусочков = весь текст;
   - criteria[]        — баллы по критериям ЕГЭ + число ошибок и комментарий;
   - summary           — общий вывод и рекомендации. */

import type { WorkType } from './workTypes'
import type { StructuredResult } from './result'

export const DEMO_RESULTS: Record<WorkType, StructuredResult> = {
  // ── Английский email (задание 37), максимум 6 ──
  // Реальный пример: письмо ученицы Camille в ответ на письмо Oscar (тема Food).
  // Текст — оригинал ученицы с ошибками; разметка и оценка — из вывода бота.
  email: {
    task: {
      label: 'Задание 37 · Письмо',
      from: 'Oscar@mail.uk',
      subject: 'Food',
      text: '…My mom decided that now we have to eat only healthy food, and I totally agree with her! What do you eat for breakfast? What is your favourite food? What do you think about fast food?\nYesterday I started reading a book about happiness…',
    },
    score: 5,
    max_score: 6,
    segments: [
      {
        t: 'Hi Oscar!\n\nThank you for your email. I’m always happy to get emails from you.\n\nIn your email you asked me some questions. Now I’ll answer them with pleasure. Actually, I like to eat ',
        e: 'none',
      },
      { t: 'a porridge', e: 'grammar' },
      {
        t: ', it’s my daily breakfast. To be honest, I like Italian food so much. I’d say that spaghetti is my favourite meal. As for me, fast food is ',
        e: 'none',
      },
      { t: 'unhealthy and not delicious food', e: 'speech' },
      {
        t: '.\n\nI’d like to know more about the book that you started reading. Tell me, who is the author of this book? What is ',
        e: 'none',
      },
      { t: 'name', e: 'grammar' },
      {
        t: ' of this book? How many pages are there in this book?\n\nThat’s all for now. Drop me a line.\n\nYours,\nCamille',
        e: 'none',
      },
    ],
    criteria: [
      { code: 'К1', score: 2, max: 2, errors: 0, comment: 'Все 6 аспектов выполнены: три ответа на вопросы (завтрак — porridge; любимая еда — спагетти; фастфуд — нездоровая еда) и три вопроса о книге; нормы вежливости и неофициальный стиль соблюдены (Hi Oscar! / Yours, Camille).' },
      { code: 'К2', score: 2, max: 2, errors: 0, comment: 'Текст логично структурирован: приветствие → ответы с дискурсными маркерами (Actually, To be honest, As for me) → вопросы → завершение; абзацное членение и связность соблюдены.' },
      { code: 'К3', score: 1, max: 2, errors: 3, comment: 'Грамматические ошибки: «a porridge» (неисчисляемое существительное без артикля) и «What is name» (пропущен артикль the). Речевая ошибка: «unhealthy and not delicious food» — повтор слова food, неудачная конструкция.' },
    ],
    summary:
      'Хорошо: письмо полностью решает коммуникативную задачу, все шесть аспектов К1 закрыты, текст логично организован, стиль неофициальный. Три причины потери балла: 1) «a porridge» — porridge неисчисляемо, артикль a недопустим; 2) «What is name of this book?» — пропущен артикль the; 3) «unhealthy and not delicious food» — слово food повторяется, лучше перефразировать («unhealthy and not very tasty»). Чтобы выйти на 6/6 — исправить эти три ошибки.',
  },

  // ── Английское эссе (задание 38), максимум 14 ──
  // Реальный пример: эссе по pie-chart «What field do children in Zetland want to work in?».
  // Текст — работа ученика с ошибками; разметка и оценка — из разбора (EGE_Task38_review).
  essay: {
    task: {
      label: 'Задание 38 · Эссе',
      text: 'Imagine that you are doing a project on what field children in Zetland want to work in. You have found some data on the subject, the results of the survey (see the pie-chart below). Comment on the data in the pie-chart and give your personal opinion on the subject of the project. Write 200–250 words.\n\nДанные опроса (pie-chart): Medicine — 33%, Arts and design — 31%, Police and security — 15%, IT — 12%, Sport — 9%.',
    },
    score: 11,
    max_score: 14,
    segments: [
      {
        t: 'It is widely known that children have a lot of fields they want to work in. While doing a project about what field children in Zetland want to work in, I have found ',
        e: 'none',
      },
      { t: 'a table', e: 'factual' },
      { t: ' containing some ', e: 'none' },
      { t: 'offical', e: 'spelling' },
      { t: ' data.\n\nIf we look at ', e: 'none' },
      { t: 'the table', e: 'factual' },
      { t: ' we can see that ', e: 'none' },
      { t: 'majority', e: 'grammar' },
      {
        t: ' of children want to work in medicine (33%). The least popular answer is sport (9%).\n\nLooking at the details, we can see that ',
        e: 'none',
      },
      { t: 'number', e: 'grammar' },
      {
        t: ' of children who chose police and security (15%) is only six percent more than ',
        e: 'none',
      },
      { t: 'number', e: 'grammar' },
      {
        t: ' of children who chose sport (9%). I think it is related to children’s opinion that, if you become a policeman, you will be cooler than others. Also we can see that ',
        e: 'none',
      },
      { t: 'number', e: 'grammar' },
      { t: ' of answers medicine (33%) is almost 3 times more than ', e: 'none' },
      { t: 'number', e: 'grammar' },
      {
        t: ' of answers IT (12%). In my opinion it is due to the fact that children want to help other people and save lives more than doing ',
        e: 'none',
      },
      { t: 'a monotonous computer work', e: 'grammar' },
      {
        t: '.\n\nThere are some problems that one can face dreaming of a profession in one’s childhood. One of these problems is the fact that childhood dream job ',
        e: 'none',
      },
      { t: 'may not be promising and do not have', e: 'grammar' },
      {
        t: ' a good career ladder or salary. To solve this problem, I think people should find another good job and do their childhood dream job as a hobby. Unfortunately it does not work with all jobs but you still can do sport, IT or arts and design as a hobby.\n\nTo conclude, I think it is really important to have ',
        e: 'none',
      },
      { t: 'dream job', e: 'grammar' },
      {
        t: ' for children, because it becomes their first goal and teaches them to achieve their aims.',
        e: 'none',
      },
    ],
    criteria: [
      { code: 'К1', score: 2, max: 3, errors: 1, comment: 'Решение задачи: все 5 пунктов плана раскрыты, объём в норме. Минус — pie-chart назван «table» (фактическая ошибка).' },
      { code: 'К2', score: 3, max: 3, errors: 0, comment: 'Организация: логичные абзацы и средства связи (While, Also, In my opinion, To conclude), структура по плану.' },
      { code: 'К3', score: 2, max: 3, errors: 2, comment: 'Лексика: хороший запас (promising, career ladder), но ошибки артиклей — «a computer work», «have dream job».' },
      { code: 'К4', score: 2, max: 3, errors: 2, comment: 'Грамматика: «number of» без артикля the; «may not be… and do not have» — нарушено согласование модала.' },
      { code: 'К5', score: 2, max: 2, errors: 0, comment: 'Орфография и пунктуация: серьёзных нарушений нет, лишь опечатка «offical».' },
    ],
    summary:
      'Зрелое эссе: план соблюдён, лексика выше среднего, чёткая структура. Три зоны роста: 1) «table» → «pie-chart»; 2) артикли при неисчисляемых и перед number/majority; 3) согласование «may not be… or have». Исправив их — 13–14/14.',
  },

  // ── Русское сочинение (задание 27), максимум 22 ──
  // Реальный пример: сочинение по тексту М.Г. Жуковой «Твой есмь аз. Суворов».
  // Текст — работа ученика с ошибками; разметка и оценка — из разбора (EGE_sochinenie_Suvorov_review).
  composition: {
    task: {
      label: 'Задание 27 · Сочинение',
      text: 'Сочинение по тексту М.Г. Жуковой «Твой есмь аз. Суворов» (о том, какими качествами должен обладать полководец). Сформулируйте одну из проблем текста, прокомментируйте её двумя примерами-иллюстрациями с пояснениями и связью между ними, отразите позицию автора и выразите своё отношение с обоснованием. Объём — не менее 150 слов.',
    },
    score: 17,
    max_score: 22,
    segments: [
      {
        t: 'Александр Васильевич Суворов — великий полководец, несомненно являющийся одним из образцовых лиц в истории нашей родины. Отвечая на вопрос, какими качествами должен обладать полководец, безусловно стоит обратиться к принципам этого руководителя. В своём тексте М.Г Жукова решила обратиться к письмам и рассказам, относящимся именно к личности Суворова.\n\nПозиция автора заключается в том, что примерный военный генерал должен ',
        e: 'none',
      },
      { t: 'безумно любить', e: 'speech' },
      {
        t: ' страну, которую защищает, гордиться своим народом и своей ',
        e: 'none',
      },
      { t: 'причастности', e: 'grammar' },
      {
        t: ' к нему. Более того, хороший полководец обязан быть по-доброму требовательным к своим подопечным. Таким образом, руководитель становится особенно ответственным не только в своей работе — защите родины, но и в наведении порядка в войсках, повышении квалификации своих солдат. Писательница говорит о том, что великий полководец ',
        e: 'none',
      },
      { t: 'безумно любил', e: 'speech' },
      {
        t: ' все русское и внушал любовь к родине и даже называл иностранцев русскими именами, которые позже закреплялись за ними. Так Александр Васильевич отстаивал свою родину даже вне поля боя, поднимал народный дух в армии. ',
        e: 'none',
      },
      { t: 'Вторым примером для нас история', e: 'grammar' },
      {
        t: ' о том, как генерал по-доброму проучивал своих подчинённых за невыполнение правил военной формы. Он притворялся, будто бы видит привидение, тем самым заставлял их соблюдать правила. Солдаты, в свою очередь, начинали соблюдать требования. ',
        e: 'none',
      },
      { t: 'Эти два примера отлично дополняют друг друга и аргументируют авторскую позицию', e: 'recommendation' },
      {
        t: ', очень точно описывают принципы великого Александра Суворова, которые и сделали его таким успешным на службе.\n\nЯ безусловно согласен с мнением автора. Существуют качества, которые создают великих людей во всех сферах нашей жизни. В качестве своего примера я бы ',
        e: 'none',
      },
      { t: 'так же', e: 'spelling' },
      {
        t: ' хотел вспомнить историю. Бесконечная любовь к родине и добрая дисциплина, взаимное доверие солдат к начальнику помогли стать Гаю Юлию Цезарю ',
        e: 'none',
      },
      { t: 'возможно', e: 'punctuation' },
      {
        t: ' самым великим военным руководителем в мировой истории. Даже сам Суворов ставил его в пример. Юлий участвовал в походах наравне с легионерами пешком, знал многих воинов лично.\n\nВ заключение я хочу сказать, что именно у полководцев требования к личным качествам и принципам самые строгие. Ведь управлять огромной армией их самых разных представителей ',
        e: 'none',
      },
      { t: 'народна', e: 'spelling' },
      {
        t: ' совсем нелегко. Обращаясь к тексту Марии Жуковой и мировой истории, я описал самые важные черты примерного главнокомандующего. ',
        e: 'none',
      },
      { t: 'На этом я бы хотел закончить свое рассуждение.', e: 'speech' },
    ],
    criteria: [
      { code: 'К1', score: 1, max: 1, errors: 0, comment: 'Позиция автора: сформулирована верно.' },
      { code: 'К2', score: 2, max: 3, errors: 1, comment: 'Комментарий: два примера с пояснениями зачтены, но связь между ними только названа, не проанализирована (−1 за связь).' },
      { code: 'К3', score: 2, max: 2, errors: 0, comment: 'Своё мнение: согласие с автором и удачный аргумент про Цезаря.' },
      { code: 'К4', score: 1, max: 1, errors: 0, comment: 'Фактическая точность: грубых ошибок нет.' },
      { code: 'К5', score: 2, max: 2, errors: 0, comment: 'Логика: текст связен.' },
      { code: 'К6', score: 1, max: 1, errors: 0, comment: 'Этика: нарушений нет.' },
      { code: 'К7', score: 2, max: 3, errors: 1, comment: 'Орфография: «так же» → «также» (в значении «тоже» — слитно).' },
      { code: 'К8', score: 2, max: 3, errors: 1, comment: 'Пунктуация: «возможно» (= вероятно) — вводное слово, нужны запятые.' },
      { code: 'К9', score: 2, max: 3, errors: 2, comment: 'Грамматика: «гордиться причастности» → «причастностью» (творит. падеж); «Вторым примером… история» — пропуск сказуемого.' },
      { code: 'К10', score: 2, max: 3, errors: 2, comment: 'Речь: «безумно любить» — разговорная окраска; штамп в концовке.' },
    ],
    summary:
      'Крепкая работа: проблема, позиция и своё мнение на месте, аргумент про Цезаря удачный. Единственная содержательная потеря — анализ связи примеров (К2). Остальные минусы — язык по мелочи, по одной ошибке на К7–К10. Чтобы выйти на 20+: раскрыть связь (патриотизм + дисциплина = две грани величия полководца) и убрать языковые ошибки.',
  },
}
