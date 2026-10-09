# Единое окно настройки кампании: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Одинаковое окно настройки кампании в соло и в сети с девятью полями; каждое выбранное значение сохраняется в кампании и попадает в промпт генерации.

**Architecture:** Один нормализатор параметров (`src/lib/campaign/setup-params.ts`) и одна общая форма (`CampaignSetupForm`). Соло (`/api/campaign`) и сеть (`/api/room/[code]/start-campaign` → `room-service`) принимают один набор полей. Промпты Акта 1 (`party-arc-generator`, `story-arc`) получают все поля.

**Tech Stack:** Next.js (App Router), React, Prisma (Postgres), Vitest, Zod, AI SDK.

**Spec:** [docs/superpowers/specs/2026-10-09-campaign-setup-unification-design.md](../specs/2026-10-09-campaign-setup-unification-design.md)

## Global Constraints

- Тон хранится ключом: `heroic`, `dark`, `mystery`, `classic`, `lighthearted`. Русские подписи только в интерфейсе.
- Сложность хранится как `easy`, `normal`, `hard`, `brutal`. Вход `deadly` переводится в `brutal` один раз, в нормализаторе.
- Стиль мастера: `balanced`, `narrative`, `tactical`, `sandbox`.
- Отношения в отряде: `tight_knit`, `strangers`, `mercenaries`, `friends`.
- Завязка: `strangers`, `established_party`, `captives_or_survivors`, `patron_contract` (тип `StartingSituation` уже экспортируется из `src/lib/ai/party-arc-generator.ts`, не дублировать).
- Финальный уровень: целое от 1 до 20, не ниже стартового уровня.
- Значение по умолчанию сеттинга: `Тёмное фэнтези`.
- Колонка `Campaign.startingSituation` — `String?` без DEFAULT. Старые строки остаются `NULL`, промпт Акта 1 их не выводит. Это отличие от спека (там `DEFAULT strangers`): так старые кампании не получают завязку, которой не выбирали. Значение по умолчанию подставляет форма.
- Supabase-типы кампаний не используются (`src/lib/supabase/types.ts` не содержит полей кампании), поэтому их не меняем.
- Не трогать `CLAUDE.md` (он удалён в рабочей копии, восстанавливать не нужно).

## Review Focus

1. Старые строки кампаний: `startingSituation = NULL` и русская подпись тона из прошлых сохранений. Нормализатор не падает, промпт не содержит «undefined» (Task 1, Task 5).
2. Частичное обновление PATCH не сбрасывает поля, которые клиент не присылал (Task 3).
3. Пустой сеттинг в форме блокирует отправку с сообщением, а не тихо подменяется (Task 6).
4. Финальный уровень ниже стартового или выше 20 приводится к допустимому диапазону (Task 1, Task 3).
5. Устаревшие значения от старых клиентов (`deadly`, неизвестный тон, неизвестная завязка) заменяются значением по умолчанию, а не дают 500 (Task 1, Task 4).

---

### Task 1: Нормализатор параметров

**Files:**
- Create: `src/lib/campaign/setup-params.ts`
- Test: `src/lib/campaign/__tests__/setup-params.test.ts`

**Interfaces:**
- Consumes: тип `StartingSituation` из `@/lib/ai/party-arc-generator` (только тип).
- Produces:
  - `type Tone`, `Difficulty`, `DmStyle`, `PartyTies`
  - `interface CampaignSetupValues { title: string; setting: string; tone: Tone; difficulty: Difficulty; dmStyle: DmStyle; partyTies: PartyTies; startingSituation: StartingSituation; levelTo: number; customDmNotes: string | null }`
  - `SETTING_PRESETS: string[]` — 6 жанров из `RoomCampaignSetupModal` («Тёмное фэнтези», «Высокое фэнтези», «Готический хоррор», «Подземелья и древние руины», «Морские приключения», «Городские интриги и детектив») и 7 миров из `DnDApp` (`Forgotten Realms`, `Ravenloft`, `Eberron`, `Dragonlance`, `Planescape`, `Dark Sun`, `Custom`) — итого 13. Первый элемент = значение по умолчанию.
  - `TONE_OPTIONS`, `DIFFICULTY_OPTIONS` (с `label`, `dist`, `desc` как в `RoomCampaignSetupModal`), `DM_STYLE_OPTIONS`, `PARTY_TIES_OPTIONS`, `STARTING_SITUATION_OPTIONS` — массивы `{ key, label, desc? }`.
  - `PARTY_TIES_DESCRIPTIONS: Record<PartyTies, string>` — текст из `tiesMap` в `story-arc.ts:186-191`.
  - `levelToChoices(startingLevel: number): number[]` — `[start+2, start+4, 10, 20]` с отсечением по 20 и без дублей.
  - `defaultCampaignSetup(startingLevel: number): CampaignSetupValues`
  - `normalizeCampaignSetup(input: Record<string, unknown>, startingLevel: number): CampaignSetupValues`
  - `normalizeCampaignSetupPatch(input: Record<string, unknown>, startingLevel: number): Partial<CampaignSetupValues>` — только ключи, присутствующие во входе.
  - `validateCampaignSetupInput(input: Partial<{ title: string; setting: string }>): { isValid: boolean; error?: string }` — перенесено из `RoomCampaignSetupModal.tsx`, та же логика и тексты ошибок.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeCampaignSetup,
  normalizeCampaignSetupPatch,
  defaultCampaignSetup,
  validateCampaignSetupInput,
} from "../setup-params";

describe("normalizeCampaignSetup", () => {
  it("maps legacy Russian tone labels to keys", () => {
    expect(normalizeCampaignSetup({ tone: "Мрачный и напряженный" }, 1).tone).toBe("dark");
    expect(normalizeCampaignSetup({ tone: "Классический D&D" }, 1).tone).toBe("classic");
  });

  it("maps deadly to brutal", () => {
    expect(normalizeCampaignSetup({ difficulty: "deadly" }, 1).difficulty).toBe("brutal");
  });

  it("falls back to defaults for unknown enum values instead of throwing", () => {
    const v = normalizeCampaignSetup({ difficulty: "ultra", tone: "что-то", startingSituation: "x", dmStyle: "y", partyTies: "z" }, 1);
    expect(v.difficulty).toBe("normal");
    expect(v.tone).toBe(defaultCampaignSetup(1).tone);
    expect(v.startingSituation).toBe("strangers");
    expect(v.dmStyle).toBe("balanced");
    expect(v.partyTies).toBe("tight_knit");
  });

  it("clamps levelTo to 1..20 and not below the starting level", () => {
    expect(normalizeCampaignSetup({ levelTo: 99 }, 3).levelTo).toBe(20);
    expect(normalizeCampaignSetup({ levelTo: 1 }, 3).levelTo).toBe(3);
  });

  it("replaces an empty setting with the default on the server side", () => {
    expect(normalizeCampaignSetup({ setting: "   " }, 1).setting).toBe("Тёмное фэнтези");
  });

  it("trims custom notes and turns blank notes into null", () => {
    expect(normalizeCampaignSetup({ customDmNotes: "  склеп  " }, 1).customDmNotes).toBe("склеп");
    expect(normalizeCampaignSetup({ customDmNotes: "   " }, 1).customDmNotes).toBeNull();
  });
});

describe("normalizeCampaignSetupPatch", () => {
  it("returns only keys present in the input", () => {
    expect(normalizeCampaignSetupPatch({ tone: "heroic" }, 1)).toEqual({ tone: "heroic" });
  });
});

describe("validateCampaignSetupInput", () => {
  it("rejects an empty setting", () => {
    expect(validateCampaignSetupInput({ title: "Т", setting: "  " }).isValid).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/campaign/__tests__/setup-params.test.ts`
Expected: FAIL with "Cannot find module '../setup-params'"

- [ ] **Step 3: Implement the module in `src/lib/campaign/setup-params.ts`**

Constants are listed in the Interfaces block above; copy the Russian labels and descriptions from `RoomCampaignSetupModal.tsx:40-106` and `DnDApp.tsx:3439-3513`. Mapping of legacy tone labels: «Мрачный и напряженный» → `dark`, «Героический и эпический» → `heroic`, «Мистический детектив» → `mystery`, «Классический D&D» → `classic`. Unknown values fall back to the defaults: tone `dark`, difficulty `normal`, dmStyle `balanced`, partyTies `tight_knit`, startingSituation `strangers`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/campaign/__tests__/setup-params.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/campaign/setup-params.ts src/lib/campaign/__tests__/setup-params.test.ts
git commit -m "feat: нормализатор параметров настройки кампании"
```

---

### Task 2: Колонка `startingSituation`

**Files:**
- Modify: `prisma/schema.prisma` (модель `Campaign`, после строки 35 `partyTies`)
- Modify: `prisma/schema.sql` (после строки 38 `partyTies`, для паритета с бутстрап-скриптом)
- Create: `scripts/migrations/011_campaign_starting_situation.sql`

**Interfaces:**
- Produces: поле `Campaign.startingSituation: string | null` в Prisma-клиенте.

- [ ] **Step 1: Add the field to `prisma/schema.prisma`**

```prisma
  startingSituation String? // strangers, established_party, captives_or_survivors, patron_contract; NULL у старых кампаний
```

- [ ] **Step 2: Add the same column to `prisma/schema.sql`**

```sql
    "startingSituation" TEXT,
```

- [ ] **Step 3: Create the migration `scripts/migrations/011_campaign_starting_situation.sql`**

```sql
-- Migration: 011_campaign_starting_situation.sql
-- Начальная связь героев (завязка Акта 1). NULL у старых кампаний: промпт её не выводит.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "startingSituation" TEXT;
```

- [ ] **Step 4: Verify the client generates**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" без ошибок.

Run: `npx tsc --noEmit`
Expected: без новых ошибок (старые ошибки, если есть, не трогаем; сравнить с веткой dev).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/schema.sql scripts/migrations/011_campaign_starting_situation.sql
git commit -m "feat: колонка Campaign.startingSituation"
```

---

### Task 3: Соло API: `POST /api/campaign` и `PATCH /api/campaign`

**Files:**
- Modify: `src/app/api/campaign/route.ts` (POST: строки 45–106; PATCH: строки 119–145)
- Test: `src/app/api/campaign/__tests__/campaign-setup-params.test.ts` (новый, мок как в `campaign-user-isolation.test.ts:4-51`)

**Interfaces:**
- Consumes: `normalizeCampaignSetup`, `normalizeCampaignSetupPatch` из Task 1; поле `startingSituation` из Task 2.
- Produces: `POST` принимает `name`, `setting`, `tone`, `difficulty`, `dmStyle`, `partyTies`, `startingSituation`, `levelTo`, `customDmNotes`, `startingLevel`, `levelFrom`. `PATCH` принимает `id` и любое подмножество тех же полей плюс `name`.

- [ ] **Step 1: Write the failing tests**

Тест 1, POST: вызов с `{ name: "Т", tone: "Мрачный и напряженный", difficulty: "deadly", startingSituation: "patron_contract", levelTo: 12, dmStyle: "tactical", partyTies: "friends", customDmNotes: "  склеп  " }` → `campaignCreateMock` вызван с `data` содержащим `tone: "dark"`, `difficulty: "brutal"`, `startingSituation: "patron_contract"`, `levelTo: 12`, `dmStyle: "tactical"`, `partyTies: "friends"`, `customDmNotes: "склеп"`.

Тест 2, PATCH частичное обновление: вызов с `{ id: "c1", tone: "heroic" }` → `campaignUpdateMock` получает `data` с ключом `tone` и без ключей `dmStyle`, `partyTies`, `startingSituation`, `levelTo`, `difficulty`, `setting`.

Тест 3, PATCH финальный уровень: `{ id: "c1", levelTo: 50 }` при `levelFrom` кампании 3 → `data.levelTo === 20`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/campaign/__tests__/campaign-setup-params.test.ts`
Expected: FAIL (поля не передаются в create/update, `levelTo` в PATCH не обрабатывается).

- [ ] **Step 3: Implement**

POST: заменить ручной разбор (`setting = "Forgotten Realms"` и т. д.) на `const setup = normalizeCampaignSetup(body, from)`, где `from` — уже вычисленный стартовый уровень. В `data` передавать `setup.*`, `levelTo: setup.levelTo`, `startingSituation: setup.startingSituation`. Существующее ограничение `to = Math.max(from, …)` уходит в нормализатор.

PATCH: `const patch = normalizeCampaignSetupPatch(body, campaign.levelFrom)`, затем `data` собирается из `patch` и из `name` (если `typeof body.name === "string"` и не пустое). Сравнение с владельцем кампании остаётся как было.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/campaign/__tests__/`
Expected: PASS (новый тест и `campaign-user-isolation.test.ts`, `campaign-aliases-and-creation.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/campaign/route.ts src/app/api/campaign/__tests__/campaign-setup-params.test.ts
git commit -m "feat: соло-API принимает единый набор параметров кампании"
```

---

### Task 4: Сетевой старт: маршрут и `room-service`

**Files:**
- Modify: `src/app/api/room/[code]/start-campaign/route.ts` (строки 25–53: убрать ручной разбор `difficulty`/`startingSituation`, передать `body` в сервис)
- Modify: `src/lib/room/room-service.ts`:
  - `StartRoomCampaignInput` (строки ~35–47): добавить `dmStyle`, `partyTies`, `startingSituation`, `levelTo`, `tone`, `customDmNotes`, `setting`, `title`, `difficulty`, `ruleStrictness`
  - вызов `generatePartyAwareAct1` (строки 864–879): добавить `partyTies`, `dmStyle`, `startingSituation`
  - `db.campaign.create` (строки 982–1003): добавить `partyTies`, `startingSituation`, `dmStyle`, `tone`, `difficulty`; `worldDescription: null` вместо `input.setting`
- Test: `src/app/api/room/__tests__/start-campaign.test.ts` (расширить), `src/lib/room/__tests__/room-service.test.ts` (расширить существующий мок)

**Interfaces:**
- Consumes: `normalizeCampaignSetup` из Task 1 (вызывается внутри `startRoomCampaign` с `roomWithParticipants.startingLevel`); поле `startingSituation` из Task 2.
- Produces: `startRoomCampaign(code, userId, input: StartRoomCampaignInput, options)` сохраняет и использует все поля из Task 1.

- [ ] **Step 1: Write the failing tests**

В `start-campaign.test.ts`: запрос с `{ title, setting, tone: "Мрачный и напряженный", difficulty: "deadly", dmStyle: "tactical", partyTies: "friends", startingSituation: "patron_contract", levelTo: 10 }` → `startRoomCampaign` (мок) вызван с `input` где `difficulty === "brutal"`, `dmStyle === "tactical"`, `partyTies === "friends"`, `startingSituation === "patron_contract"`, `levelTo === 10`.

В `room-service.test.ts`: `startRoomCampaign` с этим же входом → `db.campaign.create` (мок) получает `data` с `dmStyle: "tactical"`, `partyTies: "friends"`, `startingSituation: "patron_contract"`, `tone: "dark"`, `worldDescription: null`; `generatePartyAwareAct1` (мок) получает `params.partyTies === "friends"`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/room/__tests__/start-campaign.test.ts src/lib/room/__tests__/room-service.test.ts`
Expected: FAIL (новых полей нет в `input` и `data`).

- [ ] **Step 3: Implement**

Маршрут: оставить проверки обязательных `title` и `setting` (тексты ошибок прежние), остальное передать в `startRoomCampaign` как `input = { ...body, title: body.title.trim() }`. Нормализация внутри сервиса: `const setup = normalizeCampaignSetup(input, roomWithParticipants.startingLevel)`, дальше везде использовать `setup`. Строка `tone: body.tone?.trim() || "Сбалансированный"` уходит (дефолт теперь в нормализаторе).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/room/__tests__/ src/lib/room/__tests__/`
Expected: PASS, кроме известных падений из-за `DATABASE_URL` (campaign-room-binding, character-dedup-stats). Список падений должен совпасть с веткой dev до изменений.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/room/[code]/start-campaign/route.ts" src/lib/room/room-service.ts src/app/api/room/__tests__/start-campaign.test.ts src/lib/room/__tests__/room-service.test.ts
git commit -m "feat: сетевой старт сохраняет все параметры кампании"
```

---

### Task 5: Промпты Акта 1 получают все поля

**Files:**
- Modify: `src/lib/ai/party-arc-generator.ts`:
  - `PartyArcGenerationParams` (строки 28–40): добавить `partyTies?: string`
  - `buildPartyAct1Prompt` (строки ~312–334): добавить строку отношений в отряде
  - экспорт `buildPartyAct1Prompt`, если сейчас не экспортирован (одна строка, для теста)
- Modify: `src/lib/ai/story-arc.ts`:
  - `ArcGenerationParams` (строки 158–172): добавить `startingSituation?: string | null`
  - `describeCampaign` (строки 174–217): добавить «Как герои начали» только при наличии значения; карту отношений заменить импортом `PARTY_TIES_DESCRIPTIONS` из `setup-params.ts`
- Modify: `src/app/api/campaign/arc/route.ts` (строки 144–156): передать `startingSituation: campaign.startingSituation`; добавить поле в `select`, если выборка по полям
- Modify: `src/lib/room/room-service.ts`: `startingSituation` попадает в `PartyArcGenerationParams` (уже передаётся, проверить)
- Test: `src/lib/ai/__tests__/party-arc-generator.test.ts` (расширить), `src/lib/ai/__tests__/story-arc-setup-params.test.ts` (новый)

**Interfaces:**
- Consumes: `PARTY_TIES_DESCRIPTIONS`, `STARTING_SITUATION_OPTIONS` из Task 1; `startingSituation` из Task 2.
- Produces: текст промпта содержит строки «Отношения в отряде: …» и «Как герои начали: …».

- [ ] **Step 1: Write the failing tests**

1. `buildPartyAct1Prompt({ ...params, partyTies: "friends", startingSituation: "patron_contract", tone: "dark", difficulty: "brutal", dmStyle: "tactical" })` содержит подстроки `Отношения в отряде:` и `Соклановцы` (фрагмент описания «friends») и `Стиль мастера: tactical`.
2. `generateStoryArc` с замоканным `generateText` (паттерн `vi.mock("ai", …)`): `params.startingSituation = "patron_contract"` → текст промпта первого вызова содержит «Как герои начали» и фрагмент «Контракт» (из описания завязки).
3. Тот же вызов с `startingSituation: null` → промпт не содержит «Как герои начали» и не содержит «null» / «undefined».
4. Старая кампания: `tone` = «Мрачный и напряженный» → промпт содержит `Тон: Мрачный и напряженный` без падения (промпт не должен ломаться на старых значениях; ключевое — нет «undefined»).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/ai/__tests__/party-arc-generator.test.ts src/lib/ai/__tests__/story-arc-setup-params.test.ts`
Expected: FAIL (строк отношений и завязки в промпте нет).

- [ ] **Step 3: Implement**

В `buildPartyAct1Prompt` после строки «Стиль мастера» добавить `- Отношения в отряде: ${PARTY_TIES_DESCRIPTIONS[params.partyTies] ?? "не заданы"}` (если `partyTies` задан). Завязка в Акте 1 уже есть (строка 332), проверить, что она берётся из `startingSituation` и текст совпадает с `STARTING_SITUATION_OPTIONS`; если описание отличается, взять его из `setup-params.ts`.

В `describeCampaign` добавить строку завязки после строки «Отношения в отряде» только если `p.startingSituation` задан и есть в `STARTING_SITUATION_OPTIONS`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/ai/`
Expected: PASS (включая `system-prompt-party.test.ts`, `party-arc-generator.test.ts`, `next-chapter.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/party-arc-generator.ts src/lib/ai/story-arc.ts src/app/api/campaign/arc/route.ts src/lib/ai/__tests__/party-arc-generator.test.ts src/lib/ai/__tests__/story-arc-setup-params.test.ts
git commit -m "feat: промпты Акта 1 получают отношения в отряде и завязку"
```

---

### Task 6: Общая форма `CampaignSetupForm`

**Files:**
- Create: `src/components/campaign/CampaignSetupForm.tsx`
- Test: `src/components/campaign/__tests__/CampaignSetupForm.test.tsx`

**Interfaces:**
- Consumes: всё из `@/lib/campaign/setup-params` (Task 1).
- Produces:

```ts
export interface CampaignSetupFormProps {
  mode: "solo" | "network";
  initialTitle: string;
  initialValues: CampaignSetupValues;   // from defaultCampaignSetup(startingLevel)
  startingLevel: number;
  isGenerating: boolean;
  error: string | null;
  onSubmit: (values: CampaignSetupValues) => void | Promise<void>;
  onCancel: () => void;
  partySlot?: ReactNode;                // сетевой режим: список готовых героев
}
export function CampaignSetupForm(props: CampaignSetupFormProps): JSX.Element;
```

Поля в порядке: название; сеттинг (инпут + чипы `SETTING_PRESETS`); тон (select); сложность (четыре карточки); стиль мастера (select); отношения в отряде (select); завязка (четыре карточки); финальный уровень (select из `levelToChoices`); пожелания мастера (textarea). Подписи полей — как в `RoomCampaignSetupModal.tsx` (одинаковые в обоих режимах). Кнопка: «Сотворить Акт 1 приключения» в обоих режимах. Валидация: `validateCampaignSetupInput` перед `onSubmit`; ошибка показывается в форме.

- [ ] **Step 1: Write the failing tests**

Тест 1: `render(<CampaignSetupForm mode="solo" …/>)` и `render(<CampaignSetupForm mode="network" …/>)` → в обоих найдены подписи «Тон», «Сложность», «Стиль мастера», «Отношения в отряде», «Завязка», «Финальный уровень», «Пожелания». Списки опций одинаковые: проверить, что в обоих есть `Смертоносная (хардкор)` и `Сотворить Акт 1 приключения`.

Тест 2: пустой сеттинг → клик по кнопке отправки → `onSubmit` не вызван, видно текст «Укажите сеттинг или жанр приключения».

Тест 3: заполненная форма → клик → `onSubmit` вызван с `values.difficulty === "brutal"` при выборе «Смертоносная (хардкор)» и `values.levelTo` из выбранного варианта.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/campaign/__tests__/CampaignSetupForm.test.tsx`
Expected: FAIL с "Cannot find module".

- [ ] **Step 3: Implement**

Перенести разметку из `RoomCampaignSetupModal.tsx:243-431` (поля, радио-карточки, блок «Готовый состав отряда» уходит в `partySlot`), заменить локальные константы на импорт из `setup-params.ts`. Добавить select для стиля мастера и отношений по образцу тона. Тесты на `@testing-library/react`: проверить, что он установлен (`src/components/home/__tests__/HomeHubView.test.tsx` его использует); если нет, тесты пишутся через `renderToStaticMarkup`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/campaign/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/campaign/CampaignSetupForm.tsx src/components/campaign/__tests__/CampaignSetupForm.test.tsx
git commit -m "feat: общая форма настройки кампании"
```

---

### Task 7: Сетевое окно использует общую форму

**Files:**
- Modify: `src/components/room/RoomCampaignSetupModal.tsx` (тело заменяется на `CampaignSetupForm`; оверлей, шапка и экран «Сотворение Акта 1» остаются)
- Test: `src/components/room/__tests__/setup-modal.test.ts` (существующий, должен пройти без изменений)

**Interfaces:**
- Consumes: `CampaignSetupForm` из Task 6; `validateCampaignSetupInput` из Task 1.
- Produces: `RoomCampaignSetupModal` сохраняет props `isOpen`, `onClose`, `room`, `participants`, `onStartCampaign`, `isGenerating`. Реэкспорт `validateCampaignSetupInput` и `CampaignSetupFormValues` (алиас на `CampaignSetupValues & { title: string }`) — чтобы существующие импорты не сломались.

- [ ] **Step 1: Run the existing tests to record the baseline**

Run: `npx vitest run src/components/room/__tests__/setup-modal.test.ts`
Expected: PASS (зафиксировать).

- [ ] **Step 2: Replace the body**

Модалка передаёт `mode="network"`, `initialTitle` = `${room.name}: Легенда`, `initialValues: defaultCampaignSetup(room.startingLevel)`, `partySlot` с текущим блоком «Готовый состав отряда» (`RoomCampaignSetupModal.tsx:211-241`), `onSubmit` вызывает `onStartCampaign` и ловит ошибку в `error`.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/components/room/ src/components/campaign/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/room/RoomCampaignSetupModal.tsx
git commit -m "refactor: сетевое окно настройки использует общую форму"
```

---

### Task 8: Соло-карточка использует общую форму

**Files:**
- Modify: `src/components/dnd/DnDApp.tsx`:
  - состояния `newCampaignSetting`, `newCampaignTone`, `newCampaignDifficulty`, `newCampaignDmStyle`, `newCampaignPartyTies`, `newCampaignCustomDmNotes` (найти через `grep -n "newCampaignSetting\|newCampaignTone" src/components/dnd/DnDApp.tsx`) заменить на один `campaignSetup: CampaignSetupValues` и `campaignTitle: string`
  - карточка «Параметры сюжета и мира» (строки 3403–3549) заменяется на `<CampaignSetupForm mode="solo" …/>`
  - `handleGenerateStory` (строки 2340–2375): PATCH-тело из `campaignSetup` и `name: campaignTitle`
  - места создания (строка ~1623–1631) и загрузки из кампании (строки ~1768–1770) переведены на `campaignSetup`
- Modify: `src/components/home/HomeHubView.tsx` — проверить, есть ли там параметры сюжета; если есть, пропустить через `normalizeCampaignSetup`; если нет, не трогать.

**Interfaces:**
- Consumes: `CampaignSetupForm` (Task 6), `normalizeCampaignSetup`, `defaultCampaignSetup` (Task 1), PATCH-контракт (Task 3).
- Produces: соло-карточка отправляет тот же набор полей, что и сеть.

- [ ] **Step 1: Find all usages**

Run: `grep -n "newCampaignSetting\|newCampaignTone\|newCampaignDifficulty\|newCampaignDmStyle\|newCampaignPartyTies\|newCampaignCustomDmNotes" src/components/dnd/DnDApp.tsx`
Записать номера строк. Каждое место либо переводится на `campaignSetup`, либо удаляется вместе с состоянием.

- [ ] **Step 2: Replace the states and the card**

Состояние: `const [campaignSetup, setCampaignSetup] = useState<CampaignSetupValues>(() => defaultCampaignSetup(1));`. Карточка: `<CampaignSetupForm mode="solo" initialTitle={activeCampaign?.name ?? ""} initialValues={campaignSetup} startingLevel={1} isGenerating={savingStorySettings} error={null} onSubmit={handleGenerateStory} onCancel={() => setShowStoryConfig(false)} />`. `handleGenerateStory` принимает `values` и `title` и шлёт их в PATCH.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: без новых ошибок относительно dev.

Run: `npx eslint src/components/dnd/DnDApp.tsx src/components/campaign/CampaignSetupForm.tsx src/components/room/RoomCampaignSetupModal.tsx`
Expected: без новых предупреждений относительно dev (неиспользуемые состояния удалены).

- [ ] **Step 4: Manual check in the browser**

Запустить `npm run dev`, открыть соло-кампанию, пройти карточку, сохранить, проверить через БД или API `GET /api/campaign/active`, что все девять полей пришли обратно.

- [ ] **Step 5: Commit**

```bash
git add src/components/dnd/DnDApp.tsx src/components/home/HomeHubView.tsx
git commit -m "feat: соло-настройка кампании использует общую форму"
```

---

### Task 9: Полная проверка

- [ ] **Step 1: Full test run**

Run: `npm test`
Expected: все тесты проходят, кроме известных падений из-за `DATABASE_URL` (campaign-room-binding ×4, character-dedup-stats ×8). Список падений сравнить с dev до начала работы.

- [ ] **Step 2: Type-check and lint of changed files**

Run: `npx tsc --noEmit`
Run: `npx eslint $(git diff --name-only dev -- 'src/**/*.ts' 'src/**/*.tsx')`
Expected: без новых ошибок.

- [ ] **Step 3: Coverage check for the spec**

Для каждого из девяти полей из раздела 4 спека найти тест, который проверяет сохранение и появление в промпте. Таблица соответствий записывается в описание итогового коммита или PR, не в код.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: замечания проверки настройки кампании"
```

---

## Self-review

1. **Покрытие спека:** девять полей — Task 1 (типы и значения), Task 3 (соло API), Task 4 (сетевой API), Task 5 (промпты), Task 6–8 (формы). Хранение `startingSituation` — Task 2. Миграция — Task 2. Обработка старых кампаний — Task 1 и Task 5 (Review Focus 1). Тесты на «параметр в промпте» — Task 5 и Task 9.
2. **Согласованность имён:** `normalizeCampaignSetup`, `normalizeCampaignSetupPatch`, `defaultCampaignSetup`, `CampaignSetupValues`, `CampaignSetupForm`, `startingSituation`, `levelTo`, `dmStyle`, `partyTies` — одинаковые во всех задачах.
3. **Открытые места, которые исполнитель решает на месте:** точные номера строк в `DnDApp.tsx` (Task 8, Step 1 выдаёт их grep-ом), наличие `@testing-library/react` (Task 6), выборка полей в `arc/route.ts` (Task 5).

## Execution Handoff

План сохранён в `docs/superpowers/plans/2026-10-09-campaign-setup-unification.md`. Пожалуйста, просмотрите его и выберите способ выполнения.

- **Subagent-driven** — отдельный субагент на каждую задачу и отдельный ревьюер перед следующей. Самый тщательный, но дорогой: новый контекст на каждую задачу и на каждое ревью.
- **Native** — все задачи выполняю сам в этой сессии, в конце один ревьюер проверяет всю ветку. Дешевле и быстрее, но независимое ревью только в конце.

Рекомендую **Native**: задач девять, они идут по цепочке интерфейсов (нормализатор → API → промпты → формы), план уже содержит все решения, а ошибка в игре стоит умеренно (окно настройки, а не данные). Подходит ли план и какой способ выбираем?
