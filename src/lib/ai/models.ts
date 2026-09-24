// Разделение моделей по ролям на Polza.ai.
//
// 1. Рассказ и отыгрыш мира (DM) — умная быстрая модель с огромным контекстом (DeepSeek V4.1 Flash).
// 2. Бухгалтерия (запись памяти, журнала, состояния NPC) и сжатие — сверхдешёвая модель (DeepSeek V4 Flash).
// 3. Генерация арок и сюжетов — модель с высоким качеством и строгим следованием схеме (DeepSeek V4.1 Flash).

export const DEFAULT_DM_MODEL = "deepseek/deepseek-v4.1-flash";
export const DEFAULT_CHEAP_MODEL = "deepseek/deepseek-v4-flash";
export const DEFAULT_STORY_MODEL = "google/gemini-2.5-flash-lite";

// Обратная совместимость
export const CHEAP_MODEL = DEFAULT_CHEAP_MODEL;

export interface FeaturedModelInfo {
  id: string;
  name: string;
  contextLength: number;
  promptRubPerMillion: number;
  completionRubPerMillion: number;
  cacheReadRubPerMillion: number;
  category: "flash" | "pro" | "budget";
  recommendedRole?: "dm" | "cheap" | "story";
}

export const FEATURED_MODELS: FeaturedModelInfo[] = [
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash (Основной ДМ)",
    contextLength: 1048576,
    promptRubPerMillion: 16.47,
    completionRubPerMillion: 49.42,
    cacheReadRubPerMillion: 0.49,
    category: "flash",
    recommendedRole: "dm",
  },
  {
    id: "deepseek/deepseek-v4-flash",
    name: "DeepSeek V4 Flash (Быстрый служебный)",
    contextLength: 1024000,
    promptRubPerMillion: 4.18,
    completionRubPerMillion: 8.37,
    cacheReadRubPerMillion: 0.83,
    category: "budget",
    recommendedRole: "cheap",
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    contextLength: 1048576,
    promptRubPerMillion: 5.88,
    completionRubPerMillion: 23.53,
    cacheReadRubPerMillion: 0.58,
    category: "flash",
  },
  {
    id: "anthropic/claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet (Премиум литература)",
    contextLength: 200000,
    promptRubPerMillion: 295.0,
    completionRubPerMillion: 1475.0,
    cacheReadRubPerMillion: 29.5,
    category: "pro",
  },
];

// Инструменты, после которых мастеру больше нечего сказать игроку: это запись
// в БД. Их шаги уводим на дешёвую модель.
export const BOOKKEEPING_TOOLS = [
  "record",
  "update_character",
  "create_character",
] as const;

// Инструменты чтения: результат нужен рассказчику, но сам вызов — механика.
export const LOOKUP_TOOLS = [
  "get_character",
  "list_characters",
  "recall_memories",
  "get_recent_events",
  "search_web",
  "fetch_page",
] as const;

export function resolveDmModel(explicit?: string | null): string {
  return (explicit || process.env.AI_MODEL || DEFAULT_DM_MODEL).trim();
}

export function resolveCheapModel(explicit?: string | null): string {
  return (explicit || process.env.AI_CHEAP_MODEL || DEFAULT_CHEAP_MODEL).trim();
}

export function resolveStoryModel(explicit?: string | null): string {
  return (explicit || process.env.AI_STORY_MODEL || DEFAULT_STORY_MODEL).trim();
}

