// Frozen Prefix (Зона 1 кэширования LLM)
// Содержит неизменяемый системный промпт: правила D&D 5e, стиль мастера, сеттинг,
// сюжетную арку и статичные досье героев без динамических параметров (HP, ранения, события).
// Это гарантирует 100% побайтовое совпадение префикса для DeepSeek KV-кэша.

import { buildSystemPrompt, type CampaignContext, type PlayerSummary } from "../system-prompt";

/**
 * Очищает данные участников партии от любых динамических параметров (HP, раны),
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
    notes: m.notes,
  }));
}

/**
 * Собирает замороженный системный промпт для кампании.
 * ВНИМАНИЕ: Категорически запрещено включать текущие HP (hpCurrent, hpMax, hpTemp),
 * ранения, недавние события или броски кубиков.
 */
export function buildFrozenSystemPrompt(campaign?: CampaignContext): string {
  const sanitizedContext: CampaignContext | undefined = campaign
    ? {
        ...campaign,
        partyMembers: sanitizePartyMembers(campaign.partyMembers),
      }
    : undefined;

  const rawPrompt = buildSystemPrompt(sanitizedContext);

  // Дополнительная санитарная обработка: удаляем любые технические упоминания HP в тексте правил,
  // заменяя их на нейтральные термины «здоровье» / «травмы», чтобы промпт
  // оставался строго статичным и не содержал токенов волатильных статусов.
  // Используем [а-яё] с флагом i, так как \w и \b в JS RegExp не поддерживают кириллицу.
  return rawPrompt
    .replace(/\bHP\b/g, "здоровье")
    .replace(/[а-яё]*хит[а-яё]*/gi, "очков здоровья")
    .replace(/[а-яё]*ранен[а-яё]*/gi, "травмирован");
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
