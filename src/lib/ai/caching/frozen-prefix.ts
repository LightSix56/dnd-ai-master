// Frozen Prefix (Зона 1 кэширования LLM)
// Содержит неизменяемый системный промпт: правила D&D 5e, стиль мастера, сеттинг,
// сюжетную арку и статичные досье героев. Провайдер кэширует префикс запроса побайтово,
// поэтому сюда нельзя пускать ничего, что меняется от хода к ходу.
//
// Что меняется от хода к ходу и потому вынесено в ephemeral tail:
//  - HP, временные хиты, состояния;
//  - тег [Статус: …], который фоновый летописец переписывает в notes после КАЖДОГО хода;
//  - пункты «• …», которые летописец дописывает в notes, когда герой раскрывает новую черту.
// Раньше notes шли в промпт как есть, и кэш сбрасывался на каждом ходу почти с самого начала.

import { buildSystemPrompt, type CampaignContext, type PlayerSummary } from "../system-prompt";

const STATUS_TAG = /\[(?:Статус|Состояние):\s*[^\]]*\]/gi;

/** Оставляет от заметок только статичное досье: без тега статуса и без пунктов летописца */
export function stripVolatileNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const kept = notes
    .replace(STATUS_TAG, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("•"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return kept || null;
}

/** Пункты летописца из заметок («• боится огня») — для ephemeral tail */
export function extractNoteInsights(notes?: string | null): string[] {
  if (!notes) return [];
  return notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("•"))
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Очищает данные участников партии от динамических параметров,
 * оставляя только статичные паспортные данные для долгосрочного кэширования.
 */
function sanitizePartyMembers(members?: PlayerSummary[]): PlayerSummary[] | undefined {
  if (!members) return undefined;
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    race: m.race,
    class: m.class,
    subclass: m.subclass,
    level: m.level,
    background: m.background,
    personality: m.personality,
    bonds: m.bonds,
    flaws: m.flaws,
    appearance: m.appearance,
    notes: stripVolatileNotes(m.notes),
  }));
}

/**
 * Собирает замороженный системный промпт для кампании.
 * ВНИМАНИЕ: сюда нельзя добавлять текущие HP, состояния, недавние события или броски.
 */
export function buildFrozenSystemPrompt(campaign?: CampaignContext): string {
  const sanitizedContext: CampaignContext | undefined = campaign
    ? {
        ...campaign,
        partyMembers: sanitizePartyMembers(campaign.partyMembers),
      }
    : undefined;

  // Текст промпта отдаётся как есть. Раньше здесь по регулярным выражениям вычищались слова
  // «HP», «хиты», «ранен» — на кэш это не влияло (статичный текст и так статичен), зато портило
  // предыстории героев и описания инструментов.
  return buildSystemPrompt(sanitizedContext);
}

/**
 * Сортирует ключи объекта инструментов в детерминированном алфавитном порядке.
 * Это предотвращает перетасовку схем JSON при передаче в LLM и сохраняет KV-кэш.
 */
export function getDeterministicTools<T extends Record<string, any>>(tools: T): T {
  const sortedKeys = Object.keys(tools).sort() as Array<keyof T>;
  const result = {} as T;
  for (const key of sortedKeys) {
    result[key] = tools[key];
  }
  return result;
}
