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

## Команды

- `npm test` — тесты. Сначала переключает Prisma на SQLite (`scripts/prepare-prisma-for-env.js`).
  - Параллельный прогон нестабилен (общая SQLite): надёжно — `npx vitest run --no-file-parallelism --testTimeout=60000`.
  - После прогона `prisma/schema.prisma` изменён на SQLite — **не коммитить**: `git checkout -- prisma/schema.prisma`.
  - Тест парсера монстров падает без локального файла `scratch/silver-dragon…` — известно.
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
