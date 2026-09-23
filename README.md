# AI Dungeon Master — D&D 5e Solo

Веб-приложение для соло-игры в D&D 5e с AI-мастером. Нейросеть ведёт кампанию, бросает кубики, помнит персонажей и события, ищет правила в интернете через DuckDuckGo.

## Возможности

- **AI Dungeon Master** — нейросеть ведёт кампанию, описывает сцены, играет за NPC
- **12 AI-инструментов** (function calling): roll_dice, calculate, search_web, fetch_page, create_character, update_character, get_character, list_characters, save_memory, recall_memories, log_event, get_recent_events
- **Трёхслойная память**: краткосрочная (контекст), долгосрочная (факты), состояние персонажей
- **Управление кампаниями**: создание с 11 параметрами (сеттинг, тон, сложность, стиль мастера, строгость правил, и т.д.), активация, удаление
- **Кнопки кубиков** d4-d100 + кнопка "Вспомни" для триггера памяти
- **Сайдбар**: персонажи / память / журнал событий
- **Markdown-рендеринг** в чате
- **Тест API-ключа** прямо в настройках

## Технологии

- Next.js 16 (App Router) + TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Prisma ORM (SQLite)
- Vercel AI SDK 7.x (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`)
- OpenAI-compatible API (claudehub.fun, OpenAI, любой совместимый)

---

## 🪟 УСТАНОВКА НА WINDOWS 11

### Шаг 1. Установить Node.js 20+

1. Скачай Node.js LTS с https://nodejs.org/ (версия 20.x или новее)
2. Запусти установщик, нажимай "Next" до конца
3. **Проверь установку** — открой PowerShell и выполни:
   ```powershell
   node --version
   npm --version
   ```
   Должны появиться версии (например `v20.11.0` и `10.2.4`)

### Шаг 2. Установить Bun (рекомендуется, но не обязательно)

Bun работает быстрее npm. Установка через PowerShell:
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

После установки **перезапусти PowerShell** и проверь:
```powershell
bun --version
```

Если не получилось — не страшно, можно использовать `npm` вместо `bun` во всех командах ниже.

### Шаг 3. Распаковать проект

1. Распакуй zip-архив `ai-dnd-master.zip` в папку, например `C:\Projects\ai-dnd-master`
2. В PowerShell перейди в эту папку:
   ```powershell
   cd C:\Projects\ai-dnd-master
   ```

### Шаг 4. Установить зависимости

Если установлен Bun:
```powershell
bun install
```

Если только npm:
```powershell
npm install
```

Это займёт 2-5 минут (много пакетов).

### Шаг 5. Инициализировать базу данных

```powershell
bun run db:push
```

или
```powershell
npm run db:push
```

Команда создаст SQLite-файл `db/custom.db` со всеми таблицами.

### Шаг 6. Настроить .env

Файл `.env` уже создан в корне проекта. Открой его в блокноте и проверь:
```
DATABASE_URL=file:./db/custom.db?connection_limit=1&journal_mode=DELETE

AI_BASE_URL=https://api.claudehub.fun/v1
AI_API_KEY=your-claudehub-api-key-here
AI_MODEL=gpt-4o-mini
```

**ВАЖНО:** На Windows лучше использовать относительный путь для БД: `file:./db/custom.db` вместо абсолютного.

### Шаг 7. Исправить скрипты под Windows (ВАЖНО!)

По умолчанию в `package.json` скрипты используют Linux-команду `tee`. На Windows это не работает. Открой `package.json` в блокноте и замени блок `"scripts"`:

```json
"scripts": {
  "dev": "next dev -p 3000",
  "build": "next build",
  "start": "next start -p 3000",
  "lint": "eslint .",
  "db:push": "prisma db push --accept-data-loss",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:reset": "prisma migrate reset"
}
```

### Шаг 8. Запустить dev-сервер

```powershell
bun run dev
```

или
```powershell
npm run dev
```

В консоли появится:
```
▲ Next.js 16.1.3 (Turbopack)
- Local: http://localhost:3000
✓ Ready in 2.3s
```

### Шаг 9. Открыть в браузере

Открой **http://localhost:3000** в Chrome/Firefox/Edge.

---

## 🎲 НАСТРОЙКА API-КЛЮЧА

### Получение ключа
1. Зарегистрируйся на https://app.claudehub.fun
2. В личном кабинете создай API-ключ
3. **ВАЖНО:** ключ имеет формат `sk-hub-xxxxxxxxxxxx` (начинается с `sk-hub-`, а НЕ с `sk-` как у OpenAI!)

### Ввод ключа в приложении
1. Нажми **"Настройки"** (кнопка справа сверху)
2. Вставь ключ в поле "API Key" — должен начинаться с `sk-hub-`
3. **Список моделей загрузится автоматически** — выбери из выпадающего списка
4. Рекомендуемые модели:
   - **`claude-haiku-4.5`** — самая быстрая и дешёвая (рекомендуется для старта)
   - **`claude-sonnet-4.6`** / `claude-sonnet-5` — баланс скорости и качества
   - **`claude-opus-4.8`** / `claude-opus-5` — самое качественное ведение
   - **`gpt-5.4`** / `gpt-5.5` — GPT-модели
5. Нажми **"Проверить ключ и модель"** — должно показать зелёное ✅

### Если пишет "Неверный API ключ (401)"
1. **Проверь формат ключа** — должен начинаться с `sk-hub-` (не `sk-`)
2. **Проверь, что ключ скопирован полностью** — без обрезки
3. **Попробуй другой режим авторизации** в настройках:
   - `Bearer` (стандартный) — по умолчанию, должен работать
   - `x-api-key` — Anthropic-стиль
   - `Raw` — ключ как есть, без префикса
4. **Проверь баланс** в личном кабинете claudehub.fun — если 0, ключ не работает

### Если пишет "Модель не найдена (404)"
- Список моделей загружается автоматически с провайдера
- Если список не загрузился — нажми кнопку **"Обновить"** рядом с полем модели
- Модели claudehub.fun: `claude-haiku-4.5`, `claude-sonnet-4.6`, `claude-sonnet-5`, `claude-opus-4.6/4.7/4.8/5`, `gpt-5.4`, `gpt-5.5`
- **НЕ используй** `gpt-4o-mini`, `gpt-4o`, `claude-3-5-sonnet` — их нет на claudehub.fun!

---

## 🎮 ИСПОЛЬЗОВАНИЕ

### Создание кампании
1. На welcome screen нажми **"Создать новую кампанию"**
2. Заполни форму:
   - **Название** — любое имя
   - **Сеттинг** — Forgotten Realms / Eberron / Ravenloft / свой
   - **Тон** — Heroic / Dark / Gritty / Humorous / Epic
   - **Сложность** — Easy / Normal / Hard / Brutal
   - **Стиль мастера** — Balanced / Narrative / Tactical / Roleplay
   - **Строгость правил** — Loose / Standard / Strict
   - **Стартовый уровень** — слайдер 1-20
   - **Частота отдыха** — Frequent / Standard / Rare (Gritty Realism)
   - **Язык** — Русский / English
   - **Описание мира** — кастомное описание (опционально)
   - **Заметки для мастера** — пожелания к стилю (опционально)

### Управление кампаниями
- Кнопка **"Мои кампании"** в header — открывает список всех кампаний
- У каждой кампании есть кнопки **"Активировать"** и **"Удалить"**
- Удаление каскадное — удаляются все персонажи, события, памяти, сообщения

### Игра
- Пиши в чат что делает твой персонаж
- AI бросает кубики через `roll_dice`, считает через `calculate`, ищет правила через `search_web`
- Создаёт NPC через `create_character` — они появятся в сайдбаре "Персы"
- Сохраняет важные факты через `save_memory` — они появятся в "Память"
- Логирует события через `log_event` — они появятся в "Журнал"

### Быстрые кнопки
- **d4, d6, d8, d10, d12, d20, d100** — добавить бросок в текст сообщения
- **"Вспомни"** — попросить мастера вспомнить последние события и NPC

---

## 🛠 СБОРКА ДЛЯ ПРОДАКШЕНА (опционально)

Если хочешь запустить как полноценный сервер (не dev):

```powershell
bun run build
bun run start
```

Сервер будет на http://localhost:3000, но без hot-reload и с оптимизированным кодом.

---

## 🆘 ТРОБЛШУТИНГ

### "Cannot find module 'xxx'"
```powershell
bun install
# или
npm install
```

### "Database is readonly" / "SQLite error"
1. Закрой все процессы Node.js в Диспетчере задач
2. Удали папку `db` целиком
3. Запусти `bun run db:push` заново

### "Port 3000 is already in use"
В `package.json` поменяй `"dev": "next dev -p 3000"` на другой порт, например `-p 3001`

### API-ключ не работает
1. Проверь что ключ скопирован **полностью** (без обрезки)
2. В настройках попробуй все 3 режима авторизации (Bearer / x-api-key / Raw)
3. Нажми "Проверить ключ" — увидишь точную ошибку от API
4. Если 404 — смени модель на `gpt-4o-mini`
5. Если 429 — превышен лимит запросов, подожди

### Чат не отвечает
1. Открой DevTools (F12) → Console
2. Посмотри ошибку
3. Проверь что API-ключ валиден через "Проверить ключ"
4. Проверь что активная кампания выбрана (видна в header)

### AI забывает персонажей
- Нажми кнопку **"Вспомни"** — мастер подгрузит факты из памяти
- AI должен использовать `recall_memories` в начале каждой сцены
- Если не помогает — создай персонажа вручную через чат: "Создай NPC: имя, раса, класс, уровень"

---

## 📁 СТРУКТУРА ПРОЕКТА

```
ai-dnd-master/
├── prisma/
│   └── schema.prisma          # Схема БД (Campaign, Character, Memory, Event)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts          # Streaming chat с tools
│   │   │   ├── campaign/              # CRUD кампаний
│   │   │   ├── character/             # CRUD персонажей
│   │   │   ├── memory/                # Получение памяти
│   │   │   └── test-key/              # Проверка API-ключа
│   │   ├── layout.tsx
│   │   └── page.tsx           # Главная страница
│   ├── components/
│   │   ├── dnd/
│   │   │   ├── DnDApp.tsx     # Главный UI (1400+ строк)
│   │   │   └── CharacterCard.tsx
│   │   └── ui/                # shadcn/ui компоненты
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── tools.ts       # 12 AI-инструментов
│   │   │   └── system-prompt.ts
│   │   ├── dnd/
│   │   │   ├── dice.ts        # Броски кубиков
│   │   │   └── search.ts      # DuckDuckGo поиск
│   │   ├── db.ts              # Prisma client
│   │   └── store.ts           # Zustand store
│   └── ...
├── .env                       # Переменные окружения
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md                  # Этот файл
```

---

## 📜 ЛИЦЕНЗИЯ

Свободно для личного использования. Используемые библиотеки имеют свои лицензии (MIT/Apache).

## 🤝 ПОДДЕРЖКА

Если что-то не работает — проверь:
1. Версии Node.js (20+) и Bun (если используешь)
2. Файл `.env` существует и заполнен
3. БД инициализирована (`bun run db:push`)
4. API-ключ валиден (через "Проверить ключ")
5. Активная кампания выбрана

Удачной игры! 🎲
