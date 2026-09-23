<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ⚔️ D&D 5e Combat Engine & DM Assistant
Кодовая база боевого движка находится в папке [`BATTLE/`](./BATTLE).
- 📖 [`BATTLE/PROJECT_GUIDE.md`](./BATTLE/PROJECT_GUIDE.md) — Полное руководство по архитектуре, правилам и структуре кодовой базы.
- 🎲 [`BATTLE/DM_GUIDE.md`](./BATTLE/DM_GUIDE.md) — Исчерпывающий гайд для Dungeon Master: создание карт, энкаунтеров, спавн монстров, управление заклинаниями и ведение тактических боев.

---

## 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

Каждый компонент, модальное окно, плашка и элемент интерфейса в этом проекте **ОБЯЗАНЫ** строго соответствовать единой теплой средневековой D&D / Amber стилистике:

### 1. Кнопки и Акценты
- **Главные действия (Primary Actions):**
  - ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ** стандартные черные/темно-серые кнопки (`bg-primary`, `bg-black`, `bg-zinc-900`, `variant="default"` без кастомного цвета)! Они ломают погружение в средневековую атмосферу.
  - ✅ **ОБЯЗАТЕЛЬНО** использовать фирменный янтарно-кожаный градиент:
    `bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-50 border border-amber-600/60 shadow-xs`.
- **Второстепенные кнопки (Secondary / Outline Actions):**
  - ❌ **ЗАПРЕЩЕНЫ** холодные серые рамки и белые кнопки дефолтного `variant="outline"`.
  - ✅ **ОБЯЗАТЕЛЬНО** использовать теплую гамму:
    `border border-amber-500/25 dark:border-amber-500/20 bg-background/80 hover:bg-amber-500/10 hover:border-amber-500/40 text-foreground hover:text-amber-800 dark:hover:text-amber-300 shadow-xs`.
- **Иконки элементов управления:**
  - Иконки сопровождаются золотисто-янтарным тоном (`text-amber-600 dark:text-amber-400` или `text-amber-500`).

### 2. Единая сетка и высота элементов управления в навигации
- Все кнопки и информационные плашки в верхней панели навигации (хедере) **ОБЯЗАНЫ** иметь фиксированную гармоничную высоту `h-8` (`32px`) и выравнивание `flex items-center`.

### 3. Безопасность SSR и гидратации (Zero Hydration Mismatch)
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** читать `localStorage` синхронно в теле `useState(() => localStorage.getItem(...))` для данных, которые рендерятся в видимом DOM (стоимость, токены, выбранные модели, ширина или состояние сайдбара)!
  - Это вызывает критическую ошибку React: `Recoverable Error: Hydration failed because the server rendered text didn't match the client`.
- ✅ **ОБЯЗАТЕЛЬНОЕ ПРАВИЛО:**
  1. В `useState` задавать детерминированные константные дефолты, одинаковые на сервере и клиенте (например, `totalCostRub: 0`, `sidebarWidth: 340`).
  2. Восстановление значений из `localStorage` производить исключительно в `useEffect(() => { ... }, [])` после первого монтирования.
  3. Сохранение в `localStorage` блокировать флагом `hasMounted` (`if (!hasMounted) return;`), чтобы не перезаписать сохраненные данные дефолтными нулями.
  4. На динамически вычисляемые текстовые ноды и кнопки со статистикой добавлять атрибут `suppressHydrationWarning`.

---

## 🗺️ 4. Категорический запрет визуальных заглушек и обязательный VTT-рендеринг (No Visual Stubs & Mandatory Real Battlemap Rendering)

- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ визуальные заглушки (stubs / placeholders):**
  - Запрещено подменять боевые карты Roll20/Foundry/Owlbear белым холстом с цветными геометрическими блоками (`<rect fill="#fafaf9" />` с коричневыми/зелёными непрозрачными коробками вместо деревьев, стен и камней).
  - Запрещено заявлять пользователю о готовности боевого функционала, если карта не имеет реального визуального арта и выглядит как схема отладки.
- ✅ **ОБЯЗАТЕЛЬНЫЙ стандарт отображения боевых карт (VTT Standards):**
  1. **Подложка карты (Background Layer):** Все боевые пресеты и генерируемые энкаунтеры обязаны иметь полноценный растровый top-down арт (вид строго 90° сверху, без перспективных искажений) из `public/maps/` или Base64 из `.dd2vtt` файлов (`<image href="..." width={totalW} height={totalH} />`).
  2. **Тактическая сетка (Grid Layer):** Полупрозрачные тонкие линии поверх арта (`stroke="rgba(255, 255, 255, 0.22)"` или `stroke="rgba(0, 0, 0, 0.28)"` с усилением каждые 5 клеток).
  3. **Препятствия и линии видимости (Tactical Overlays):** Препятствия поверх нарисованной карты отображаются как тактические контуры:
     - Стены: тонкие неоновые/светящиеся линии видимости (Line of Sight, `stroke="#ff1744"`, `strokeWidth={2.5}`).
     - Двери и порталы: неоновые маркеры (`stroke="#00e5ff"`), интерактивные по клику (открыть/закрыть).
     - Укрытия: полупрозрачные пунктирные контуры (`stroke="rgba(234, 179, 8, 0.7)"`, `fill="rgba(234, 179, 8, 0.15)"`).
     - Зоны опасности (лава, вода, трясина): пульсирующие полупрозрачные градиенты, не перекрывающие нарисованное дно.
  4. **Импорт Universal VTT (.dd2vtt):** Поддержка прямой загрузки файлов `.dd2vtt` через drag-and-drop с мгновенным извлечением фонового изображения и линий видимости.
  5. **Обязательная визуальная верификация:** Любые изменения рендерера карт обязаны проверяться скриншотом реального браузера (Playwright) до отчета пользователю.
