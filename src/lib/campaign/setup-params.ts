// Единый набор параметров настройки кампании: соло и сетевое окно используют одни и те же
// значения, а сервер принимает их через normalizeCampaignSetup.
import type { StartingSituation } from "@/lib/ai/party-arc-generator";

export type Tone = "heroic" | "dark" | "mystery" | "classic" | "lighthearted";
export type Difficulty = "easy" | "normal" | "hard" | "brutal";
export type DmStyle = "balanced" | "narrative" | "tactical" | "sandbox";
export type PartyTies = "tight_knit" | "strangers" | "mercenaries" | "friends";

export interface CampaignSetupValues {
  title: string;
  setting: string;
  tone: Tone;
  difficulty: Difficulty;
  dmStyle: DmStyle;
  partyTies: PartyTies;
  startingSituation: StartingSituation;
  levelTo: number;
  customDmNotes: string | null;
}

export const SETTING_PRESETS: string[] = [
  "Тёмное фэнтези",
  "Высокое фэнтези",
  "Готический хоррор",
  "Подземелья и древние руины",
  "Морские приключения",
  "Городские интриги и детектив",
  "Forgotten Realms",
  "Ravenloft",
  "Eberron",
  "Dragonlance",
  "Planescape",
  "Dark Sun",
  "Custom",
];

const DEFAULT_SETTING = SETTING_PRESETS[0];
const MAX_LEVEL = 20;

export const TONE_OPTIONS: Array<{ key: Tone; label: string }> = [
  { key: "heroic", label: "Героический эпос" },
  { key: "dark", label: "Мрачный и напряжённый" },
  { key: "mystery", label: "Мистический детектив" },
  { key: "classic", label: "Классическое приключение D&D" },
  { key: "lighthearted", label: "Приключенческий" },
];

export const DIFFICULTY_OPTIONS: Array<{ key: Difficulty; label: string; dist: string; desc: string }> = [
  {
    key: "easy",
    label: "Легкая",
    dist: "60% Easy / 30% Med / 10% Hard",
    desc: "Бои прощают ошибки, герои чувствуют силу",
  },
  {
    key: "normal",
    label: "Сбалансированная",
    dist: "50% Med / 30% Hard / 20% Deadly",
    desc: "Каноничные правила D&D 5e (DMG p. 82)",
  },
  {
    key: "hard",
    label: "Сложная",
    dist: "40% Hard / 40% Deadly / 20% Med",
    desc: "Высокий риск гибели, упор на тактику и ресурсы",
  },
  {
    key: "brutal",
    label: "Смертоносная (хардкор)",
    dist: "60% Deadly / 30% Hard / 10% Med",
    desc: "Каждый бой смертелен, боссы с легендарными действиями",
  },
];

export const DM_STYLE_OPTIONS: Array<{ key: DmStyle; label: string }> = [
  { key: "balanced", label: "Сбалансированный" },
  { key: "narrative", label: "Атмосферный нарратив и отыгрыш" },
  { key: "tactical", label: "Тактические бои и сложные испытания" },
  { key: "sandbox", label: "Песочница и свобода выбора" },
];

export const PARTY_TIES_OPTIONS: Array<{ key: PartyTies; label: string }> = [
  { key: "tight_knit", label: "Слаженный боевой отряд (давние соратники, прикрывают спины)" },
  { key: "strangers", label: "Незнакомцы (судьба свела вместе, присматриваются и не знают чужих тайн)" },
  { key: "mercenaries", label: "Наёмники (общий контракт или гильдия, деловой расчёт)" },
  { key: "friends", label: "Друзья детства / Соклановцы (крепкая эмоциональная связь, преданность)" },
];

export const STARTING_SITUATION_OPTIONS: Array<{ key: StartingSituation; label: string; desc: string }> = [
  {
    key: "strangers",
    label: "Незнакомцы в беде",
    desc: "Герои не знакомы, общий кризис заставляет их объединиться",
  },
  {
    key: "established_party",
    label: "Слаженный отряд со стажем",
    desc: "Герои уже доверяют друг другу и имеют общее боевое прошлое",
  },
  {
    key: "captives_or_survivors",
    label: "Узники / Выжившие",
    desc: "Старт в плену, в темнице или сразу после катастрофы",
  },
  {
    key: "patron_contract",
    label: "Контракт гильдии или лорда",
    desc: "Отряд нанят влиятельным покровителем для опасного дела",
  },
];

// Текст для промпта; совпадает с tiesMap в story-arc.ts
export const PARTY_TIES_DESCRIPTIONS: Record<PartyTies, string> = {
  tight_knit: "Слаженный боевой отряд (давние соратники, прикрывают спины)",
  strangers: "Незнакомцы (судьба свела вместе, присматриваются и не знают тайн друг друга)",
  mercenaries: "Наёмники на контракте (профессиональный расчёт, взаимная выгода)",
  friends: "Друзья детства / Соклановцы (глубокая преданность и верность)",
};

const LEGACY_TONE_LABELS: Record<string, Tone> = {
  "Мрачный и напряженный": "dark",
  "Мрачный и напряжённый": "dark",
  "Героический и эпический": "heroic",
  "Мистический детектив": "mystery",
  "Классический D&D": "classic",
};

const DIFFICULTY_KEYS: Difficulty[] = ["easy", "normal", "hard", "brutal"];
const DM_STYLE_KEYS: DmStyle[] = DM_STYLE_OPTIONS.map((o) => o.key);
const PARTY_TIES_KEYS: PartyTies[] = PARTY_TIES_OPTIONS.map((o) => o.key);
const STARTING_SITUATION_KEYS: StartingSituation[] = STARTING_SITUATION_OPTIONS.map((o) => o.key);
const TONE_KEYS: Tone[] = TONE_OPTIONS.map((o) => o.key);

const DEFAULTS = {
  tone: "dark" as Tone,
  difficulty: "normal" as Difficulty,
  dmStyle: "balanced" as DmStyle,
  partyTies: "tight_knit" as PartyTies,
  startingSituation: "strangers" as StartingSituation,
};

function clampLevel(value: number, startingLevel: number): number {
  return Math.min(MAX_LEVEL, Math.max(startingLevel, value));
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function normalizeTone(value: unknown): Tone {
  if (typeof value !== "string") return DEFAULTS.tone;
  if (LEGACY_TONE_LABELS[value]) return LEGACY_TONE_LABELS[value];
  return pickEnum(value, TONE_KEYS, DEFAULTS.tone);
}

function normalizeDifficulty(value: unknown): Difficulty {
  // Окно настройки присылает «deadly» для смертоносной сложности: это тот же уровень, что brutal
  const mapped = value === "deadly" ? "brutal" : value;
  return pickEnum(mapped, DIFFICULTY_KEYS, DEFAULTS.difficulty);
}

function normalizeLevelTo(value: unknown, startingLevel: number): number {
  const numeric = Number(value);
  const fallback = startingLevel + 4;
  return clampLevel(Number.isFinite(numeric) && value !== null && value !== "" ? numeric : fallback, startingLevel);
}

export function levelToChoices(startingLevel: number): number[] {
  const raw = [startingLevel + 2, startingLevel + 4, 10, 20];
  const unique = Array.from(new Set(raw.map((v) => clampLevel(v, startingLevel))));
  return unique;
}

export function defaultCampaignSetup(startingLevel: number): CampaignSetupValues {
  return {
    title: "",
    setting: DEFAULT_SETTING,
    tone: DEFAULTS.tone,
    difficulty: DEFAULTS.difficulty,
    dmStyle: DEFAULTS.dmStyle,
    partyTies: DEFAULTS.partyTies,
    startingSituation: DEFAULTS.startingSituation,
    levelTo: clampLevel(startingLevel + 4, startingLevel),
    customDmNotes: null,
  };
}

export function normalizeCampaignSetup(
  input: Record<string, unknown>,
  startingLevel: number
): CampaignSetupValues {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const setting = typeof input.setting === "string" && input.setting.trim() ? input.setting.trim() : DEFAULT_SETTING;
  const notes = typeof input.customDmNotes === "string" ? input.customDmNotes.trim() : "";

  return {
    title,
    setting,
    tone: normalizeTone(input.tone),
    difficulty: normalizeDifficulty(input.difficulty),
    dmStyle: pickEnum(input.dmStyle, DM_STYLE_KEYS, DEFAULTS.dmStyle),
    partyTies: pickEnum(input.partyTies, PARTY_TIES_KEYS, DEFAULTS.partyTies),
    startingSituation: pickEnum(input.startingSituation, STARTING_SITUATION_KEYS, DEFAULTS.startingSituation),
    levelTo: normalizeLevelTo(input.levelTo, startingLevel),
    customDmNotes: notes || null,
  };
}

// Только ключи, которые клиент реально прислал: частичное обновление не сбрасывает остальные поля
export function normalizeCampaignSetupPatch(
  input: Record<string, unknown>,
  startingLevel: number
): Partial<CampaignSetupValues> {
  const full = normalizeCampaignSetup(input, startingLevel);
  const patch: Partial<CampaignSetupValues> = {};
  for (const key of Object.keys(full) as Array<keyof CampaignSetupValues>) {
    if (input[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = full[key];
    }
  }
  return patch;
}

export function validateCampaignSetupInput(input: Partial<{ title: string; setting: string }>): {
  isValid: boolean;
  error?: string;
} {
  if (!input.title || !input.title.trim()) {
    return { isValid: false, error: "Укажите название кампании" };
  }
  if (!input.setting || !input.setting.trim()) {
    return { isValid: false, error: "Укажите сеттинг или жанр приключения" };
  }
  return { isValid: true };
}

export type CampaignSubmitResult = { ok: true; values: CampaignSetupValues } | { ok: false; error: string };

// Проверка перед отправкой формы: тот же набор правил, что и на сервере
export function prepareCampaignSubmit(draft: CampaignSetupValues, startingLevel: number): CampaignSubmitResult {
  const validation = validateCampaignSetupInput({ title: draft.title, setting: draft.setting });
  if (!validation.isValid) {
    return { ok: false, error: validation.error ?? "Проверьте правильность заполнения полей" };
  }
  return { ok: true, values: normalizeCampaignSetup(draft as unknown as Record<string, unknown>, startingLevel) };
}
