<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AI Dungeon Master — сайт мастера

Соло- и сетевые игры в D&D 5e с ИИ-мастером: чат с мастером, комнаты на несколько игроков,
тактический бой на сетке. Next.js 16, React 19, Prisma, Supabase, Vercel AI SDK, Vitest.

Работает в паре с сайтом листа `../dnd5e-character-sheet`. Оба сайта ходят в **одну базу
Supabase** (проект `npcayouvvwjaqxqgxqxc`, eu-central-1).

## Архитектура

- `src/lib/ai/` — мастер: системный промпт (`system-prompt.ts`), инструменты (`tools.ts`), кэш промпта (`caching/`), сюжетная арка.
- `src/lib/combat/` — бой: движок правил (`engine.ts`), создание боя (`generator.ts`), подбор врагов (`encounters/`), бот врагов (`bot.ts`), опыт (`xp-award.ts`), итоги боя в лист (`combat-sheet-sync.ts`).
- `src/lib/dnd/` — герои и листы: `sheet-store.ts` (чтение/запись листа), `hero-db-hooks.ts`.
- `src/lib/room/` — сетевые комнаты, ходы партии, права на бойцов.
- `src/lib/auth/campaign-access.ts` — кто имеет доступ к кампании и бою.
- `src/app/api/` — маршруты; бой целиком через `api/combat/action/route.ts`.

Ключевые правила данных:
- **Лист героя — только `public.characters.data`.** Снимков и копий листа нет. Для каждой кампании своя версия листа (`campaign_id`, `source_character_id`); оригинал сайт мастера не меняет.
- Герой кампании (`Character`) ссылается на лист через `sheetCharacterId`; `src/lib/db.ts` подставляет поля листа при чтении и пишет хиты и опыт в лист.
- **Бой подбирает движок.** Мастер задаёт в `start_combat` только тип врагов, имя вожака и сложность; состав считает генератор по бюджету опыта партии (DMG). Победу и опыт определяет сервер.

## Умения классов в бою

Умения классов и подклассов описываются данными, `engine.ts` при добавлении класса не меняется.

- `src/lib/combat/data/class-subclasses.json` — тексты умений 115 официальных подклассов; собирается `scripts/import-sheet-classes.mjs` из `classes.ts` сайта листа. Хоумбрю («Альтернативный варвар») не берём.
- `classes/<класс>.ts` — правила: что умение значит в бою (кнопка, пассивное, запас; действие, заряды, цель, спасбросок) через `defineClass` (`class-defs.ts`), и постоянные поправки через `featureMods` / `conditionMods` (`feature-mods.ts`): сопротивления, преимущества, бонусы к КД, скорости и урону, ауры.
- `classes/<класс>-combat.ts` — что происходит при применении, через `registerKit` (`class-kit.ts`). Готовые формы: `stances` (стойка-состояние вроде Ярости), `riders` (добавка к попаданию), `actions` (кнопка), `reductions` (уменьшение урона реакцией), `damaged`, `defense`, `saveRerolls`, `conditionStart` / `conditionEnd` и срабатывания по событиям хода.
- Новый класс: файл правил и файл боя, строка в `classes/rules-index.ts` и `classes/combat-index.ts`, тесты `__tests__/<класс>.test.ts` (обвязка — `helpers/class-harness.ts`; образец — `barbarian.test.ts`, в конце проверка полноты правил).
- Базовые умения классов и подклассы SRD собирает `class-features.ts`; когда движок начинает разыгрывать такое умение сам, его параметры правятся в `defineClass({ srd: … })`.
- Воин сделан раньше своим модулем (`fighter-subclasses.ts`, `fighter-combat.ts`) и подключён через тот же `class-hooks.ts`.
- Особые точки движка для умений, которых нет среди готовых форм `registerKit`, подключаются отдельным модулем через `registerClassModule` (`class-hooks.ts`): `sneakAllowed` / `sneakDealt` (Скрытая атака), `creatureDown`, `hideAdvantage`, `castSaveDisadvantage`. Реакция, применимая и не в свой ход, помечается `offTurn: true` в правиле (кнопка работает в чужой ход, `Hotbar.tsx`). Название и описание в бою правила могут переопределить (`name`, `description`), когда лист расходится с источником.
- Плут сделан по dnd.su (2014) до 10 уровня: база и архетипы Убийца, Мистический ловкач, Дуэлянт (в листе «Головорез»), Комбинатор («Мастер интриг»), Сыщик, Скаут, Фантом, Клинок души; Вор целиком идёт из SRD. Умения 11+ уровней описаны как `skip`. Отличия листа от dnd.su, учтённые в правилах: кости псионической энергии Клинка души к6/к8 (5 ур.)/к10 (11 ур.)/к12 (17 ур.), а не к10 с 9 ур., как в листе.
- Сделаны: Воин, Варвар, Плут. Дальше по плану: Монах, Паладин, Следопыт, Жрец, Друид, Бард, Чародей, Колдун, Волшебник, Изобретатель.

## Движение и атаки по возможности

- `moveCombatant` (`engine.ts`) останавливает бойца в последней клетке досягаемости первого врага, который реально может ударить (`findOpportunityExits` в `movement.ts` отдаёт клетку выхода: индекс клетки маршрута, -1 — исходная клетка). Тратится только пройденный путь, `path`/`costFt` в ответе усечены; удар приходится на клетку остановки, клиент играет анимацию там (`CombatView.tsx`, `handleCombatantMove`, берёт последнюю клетку из `path`).
- Враги с более поздней клеткой выхода бьют при продолжении движения; те, чья реакция потрачена, повторно не бьют. Враги с одной клеткой выхода бьют все сразу.

## Окно выбора реакции (как в BG3)

Реакцию героя игрока (не ИИ) движок не тратит сам: игрок решает в окне «Совершить атаку по возможности?» / «Использовать реакцию?» (Да/Нет или список вариантов + «Не реагировать»). Вне контекста роута (тесты, ИИ-бойцы, `AI`-инструменты) реакции срабатывают сами, как раньше.

- Движок синхронный, а решение приходит отдельным запросом, поэтому действие **повторяется с тем же seed**: `route.ts` (`executeAction`) выполняет любое действие в `runWithReactions` (`reaction-runtime.ts`: AsyncLocalStorage с воспроизводимым генератором и принятыми решениями). Все броски идут через `rand()` из `src/lib/rng.ts`, а не `Math.random` (в тестах `Math.random` по-прежнему подменяется). Новые броски и случайные выборы — только через `rand()`/`rollDice`.
- Точка решения бросает `ReactionPrompt` (`reactions.ts`); состояние не сохраняется, запрос + seed + решения пишутся в `Combat.pendingReaction` (миграция `012_combat_pending_reaction.sql`), клиенты получают `combat.pendingReaction` (`ReactionPrompt.tsx` в `CombatView.tsx`; решает владелец героя или ведущий, остальным — «ждём решения»). Пока окно открыто, `loadState` отклоняет остальные действия боя.
- Ответ — действие `reaction-response` `{ combatantId, promptId, choice }` (`choice` — id варианта или `decline`): окно снимается, сохранённый запрос повторяется с решением `decisions[prompt.key]`. Ключ решения — `<порядковый номер вопроса в запуске>:<id бойца>`, поэтому порядок вопросов в действии должен быть детерминирован.
- Два способа спросить: `askReaction(reactor, {...})` для явного решения (атака по возможности в `moveCombatant`, Невероятное уклонение в `dealDamage`); `classHooks` (`class-hooks.ts`) обходит модули классов в области `openScope`: модуль, потративший реакцию героя, становится вариантом в списке, невыбранные модули выполняются при «занятой» реакции. Новые умения-реакции в модулях классов подхватываются без правок, если тратят `reactionUsed` внутри хука из `classHooks`; реакция вне этих хуков и `askReaction` окна не получит.
- Перехваты ошибок вокруг действий движка (`catch`) обязаны пропускать окно: `rethrowIfPrompt(e)` из `reactions.ts` (или `if (!(e instanceof EngineError)) throw e`). `ReactionPrompt` — не `EngineError`.
- Побочные эффекты вне `CombatState` (записи в БД) внутри повторяемого действия недопустимы: оно может выполниться дважды.

## Команды

- `npm test` — тесты. Сначала переключает Prisma на SQLite (`scripts/prepare-prisma-for-env.js`).
  - Параллельный прогон нестабилен (общая SQLite): надёжно — `npx vitest run --no-file-parallelism --testTimeout=60000`.
  - После прогона `prisma/schema.prisma` изменён на SQLite — **не коммитить**: `git checkout -- prisma/schema.prisma`.
  - Тест парсера монстров падает без локального файла `scratch/silver-dragon…` — известно.
  - Тесты с базой (генератор боя, опыт, участники) падают без `DATABASE_URL`. Локально: `DATABASE_URL="file:<абсолютный путь>/test.db" npx prisma db push --skip-generate`, затем тот же `DATABASE_URL` при запуске `vitest`; файл базы удалить после.
- `npx tsc --noEmit`, `npm run lint` — должны проходить без ошибок.
- Dev-сервер не запускать без просьбы пользователя.

## Инфраструктура

- Vercel, функции в `fra1` (`vercel.json`) — рядом с базой. Не убирать: из США каждый запрос к базе стоит ~100 мс.
- Миграции — `scripts/migrations/NNN_*.sql`, применяются к базе вручную (или через Supabase MCP), в порядке номеров.
- Supabase MCP не выполняет удаляющие команды (`DELETE`, `DROP`) — такие отдавать пользователю готовым SQL.
- База общая и боевая: удаление данных и изменение схемы — только с согласия пользователя.

## Git

- Работа идёт в `dev`; готовое и проверенное можно сразу пушить в `origin dev`.
- В `main` — только по просьбе пользователя (слияние `dev` → `main`).
- Перед пушем в PowerShell очистить прокси: `$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""`.

## Дизайн (простая чёрно-белая тема shadcn/ui)

- Интерфейс — стандартная нейтральная тема shadcn/ui: белый фон, тёмная основная кнопка, серые рамки; есть тёмный режим (`.dark` в `globals.css`).
- Собирать из готовых компонентов `src/components/ui/` (`Button`, `Card`, `Dialog`, `Input`…) с их вариантами (`default`, `outline`, `ghost`…).
- Цвета — через токены темы (`bg-background`, `text-foreground`, `bg-primary`, `border`, `text-muted-foreground`), а не жёстко заданные значения: так работает тёмный режим.
- Пергаментная тема — только на сайте листа, сюда её не переносить.

## Гидратация

- ❌ Не читать `localStorage` в `useState(() => …)` для того, что видно на экране — это ломает гидратацию.
- ✅ Хук `useIsMounted()` (`useSyncExternalStore`): до монтирования показывать фиксированные значения по умолчанию, запись в `localStorage` — только после монтирования; на вычисляемый текст — `suppressHydrationWarning`.

## Боевые карты

- Карта боя — настоящий арт сверху (`public/maps/` или фон из `.dd2vtt`) с полупрозрачной сеткой поверх; никаких заглушек из цветных прямоугольников.
- Изменения рендера карты проверять скриншотом в браузере до отчёта пользователю.
