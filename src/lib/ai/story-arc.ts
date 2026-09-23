// Генератор сюжетной арки кампании.
//
// Почему не generateObject: провайдер (claudehub.fun) на длинных запросах
// игнорирует переданную JSON-схему и отдаёт markdown с РУССКИМИ ключами
// ("название_кампании" вместо "title"), из-за чего generateObject не парсится.
// Опытным путём: generateText с явным JSON-шаблоном в промпте даёт корректные
// английские ключи стабильно, поэтому разбираем и валидируем вручную.
//
// Почему поэтапно: монолитный запрос на всю арку не проходит — sonnet-5 ломает
// формат, opus-5 упирается в Gateway Time-out (~12 минут). Дробим на этапы:
// скелет → акты по одному. Каждый этап живёт ~2-3 минуты и сохраняется отдельно.

import { generateText } from "ai";
import { z } from "zod";
import { createClient, type AuthMode } from "./client";
import { db } from "@/lib/db";
import { resolveStoryModel } from "./models";

// ─── Схемы ───

export const villainSchema = z.object({
  name: z.string(),
  role: z.string(),
  motivation: z.string(),
  secret: z.string(),
  appearsInAct: z.number().optional(),
});

export const actSchema = z.object({
  name: z.string(),
  levelFrom: z.number(),
  levelTo: z.number(),
  goal: z.string(),
  summary: z.string(),
  scenes: z.array(
    z.object({
      name: z.string(),
      location: z.string(),
      description: z.string(),
      encounter: z.string(),
    })
  ),
  twist: z.string(),
  branches: z.array(z.object({ ifPlayer: z.string(), then: z.string() })),
  rewards: z.string(),
});

export const storyArcSchema = z.object({
  title: z.string(),
  premise: z.string(),
  mainThreat: z.string(),
  levelFrom: z.number(),
  levelTo: z.number(),
  villains: z.array(villainSchema),
  acts: z.array(actSchema),
  finale: z.string(),
  generatedAt: z.string(),
  model: z.string(),
});

export type Villain = z.infer<typeof villainSchema>;
export type StoryAct = z.infer<typeof actSchema>;
export type StoryArc = z.infer<typeof storyArcSchema>;

// Прогресс генерации — его читает UI, пока идёт работа
export interface ArcProgress {
  stage: "skeleton" | "acts" | "finale" | "done" | "failed";
  stageLabel: string;
  actsTotal: number;
  actsDone: number;
  error?: string;
}

// ─── Разбор ответа ───

// Модель то заворачивает JSON в ```json, то отдаёт голым — вытаскиваем оба варианта
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

const ARC_INSTRUCTIONS = `Ты — сценарист кампаний D&D 5e. Ты отвечаешь ТОЛЬКО валидным JSON.
КРИТИЧНО: все КЛЮЧИ JSON строго на английском, ровно как в шаблоне запроса — не переводи их.
Все ЗНАЧЕНИЯ пиши на русском языке, живо и содержательно.
Никакого текста до или после JSON. Никаких пояснений.`;

// Один запрос к модели с разбором и валидацией. Одна повторная попытка:
// провайдер иногда срывается в свободный формат, второй раз обычно отвечает верно.
async function requestJson<T>(
  client: ReturnType<typeof createClient>,
  model: string,
  prompt: string,
  schema: z.ZodType<T>,
  what: string
): Promise<T> {
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await generateText({
      model: client.chat(model),
      system: ARC_INSTRUCTIONS,
      prompt:
        attempt === 1
          ? prompt
          : `${prompt}\n\nВАЖНО: предыдущий ответ был отклонён (${lastError}). Верни СТРОГО валидный JSON с английскими ключами по шаблону.`,
      temperature: 0.9,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(result.text));
    } catch (e) {
      lastError = `невалидный JSON: ${(e as Error).message}`;
      continue;
    }

    const validated = schema.safeParse(parsed);
    if (validated.success) return validated.data;

    lastError = validated.error.issues
      .slice(0, 4)
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
  }
  throw new Error(`Не удалось получить ${what}. Последняя ошибка — ${lastError}`);
}

// ─── Параметры кампании для генерации ───

export interface ArcPartyMember {
  name: string;
  race?: string | null;
  class?: string | null;
  level?: number;
  background?: string | null;
  personality?: string | null;
  bonds?: string | null;
  flaws?: string | null;
  appearance?: string | null;
  notes?: string | null;
}

export interface ArcGenerationParams {
  name: string;
  setting: string;
  tone: string;
  difficulty: string;
  dmStyle: string;
  ruleStrictness: string;
  levelFrom: number;
  levelTo: number;
  worldDescription?: string | null;
  customDmNotes?: string | null;
  language?: string;
  partyTies?: string;
  partyMembers?: ArcPartyMember[];
}

function describeCampaign(p: ArcGenerationParams): string {
  const lines = [
    `Кампания: "${p.name}"`,
    `Сеттинг: ${p.setting}`,
    `Тон: ${p.tone}`,
    `Сложность боёв: ${p.difficulty}`,
    `Стиль мастера: ${p.dmStyle}`,
    `Строгость правил: ${p.ruleStrictness}`,
    `Диапазон уровней: с ${p.levelFrom} по ${p.levelTo} включительно`,
  ];

  if (p.partyTies) {
    const tiesMap: Record<string, string> = {
      tight_knit: "Слаженный боевой отряд (давние соратники, прикрывают спины)",
      strangers: "Незнакомцы (судьба свела вместе, присматриваются и не знают тайн друг друга)",
      mercenaries: "Наёмники на контракте (профессиональный расчёт, взаимная выгода)",
      friends: "Друзья детства / Соклановцы (глубокая преданность и верность)",
    };
    lines.push(`Отношения в отряде: ${tiesMap[p.partyTies] || p.partyTies}`);
  }

  if (p.partyMembers && p.partyMembers.length > 0) {
    const partyList = p.partyMembers
      .map((m, idx) => {
        const details = [m.race, m.class, m.level ? `${m.level} ур.` : null].filter(Boolean).join(" ");
        const bg = m.background ? `, предыстория: ${m.background}` : "";
        const traits = [
          m.personality ? `черты: ${m.personality}` : "",
          m.bonds ? `узы: ${m.bonds}` : "",
          m.flaws ? `слабости: ${m.flaws}` : "",
        ]
          .filter(Boolean)
          .join("; ");
        const traitStr = traits ? ` [${traits}]` : "";
        return `  ${idx + 1}. ${m.name} (${details || "герой"}${bg})${traitStr}`;
      })
      .join("\n");
    lines.push(`Состав отряда героев:\n${partyList}`);
  }

  if (p.worldDescription) lines.push(`Описание мира от игрока: ${p.worldDescription}`);
  if (p.customDmNotes) lines.push(`Пожелания игрока к мастеру: ${p.customDmNotes}`);
  return lines.join("\n");
}

// Сколько актов делать: примерно по 2 уровня на акт, но в разумных рамках
export function planActCount(levelFrom: number, levelTo: number): number {
  const span = Math.max(1, levelTo - levelFrom + 1);
  return Math.min(7, Math.max(3, Math.round(span / 2)));
}

// ─── Этап 1: скелет ───

const skeletonSchema = z.object({
  title: z.string(),
  premise: z.string(),
  mainThreat: z.string(),
  villains: z.array(villainSchema).min(2),
  acts: z
    .array(
      z.object({
        name: z.string(),
        levelFrom: z.number(),
        levelTo: z.number(),
        goal: z.string(),
      })
    )
    .min(2),
  finale: z.string(),
});

type Skeleton = z.infer<typeof skeletonSchema>;

async function generateSkeleton(
  client: ReturnType<typeof createClient>,
  model: string,
  p: ArcGenerationParams
): Promise<Skeleton> {
  const actCount = planActCount(p.levelFrom, p.levelTo);
  const prompt = `Придумай скелет сюжетной арки кампании D&D 5e.

${describeCampaign(p)}

Верни JSON РОВНО такой структуры (ключи не переводить):
{
  "title": "название кампании",
  "premise": "завязка истории, 4-6 предложений",
  "mainThreat": "главная угроза кампании и что произойдёт, если игрок проиграет",
  "villains": [{"name": "имя", "role": "роль в сюжете", "motivation": "чего он хочет и почему", "secret": "тайна, которую игрок узнаёт не сразу", "appearsInAct": 1}],
  "acts": [{"name": "название акта", "levelFrom": ${p.levelFrom}, "levelTo": ${p.levelFrom + 1}, "goal": "цель акта в одном предложении"}],
  "finale": "чем заканчивается кампания, 3-5 предложений"
}

Требования:
- Злодеев: 3-4. У каждого свой мотив и тайна, они не должны дублировать друг друга.
- Актов: ровно ${actCount}. Они покрывают уровни с ${p.levelFrom} по ${p.levelTo} подряд, без пропусков и перекрытий: первый акт начинается с ${p.levelFrom}, последний заканчивается на ${p.levelTo}.
- appearsInAct — номер акта (1..${actCount}), в котором злодей впервые выходит на сцену.
- Детали сцен НЕ описывай, это только скелет.
- Учитывай тон "${p.tone}" и стиль "${p.dmStyle}".`;

  return requestJson(client, model, prompt, skeletonSchema, "скелет истории");
}

// ─── Этап 2: акт ───

async function generateAct(
  client: ReturnType<typeof createClient>,
  model: string,
  p: ArcGenerationParams,
  skeleton: Skeleton,
  actIndex: number
): Promise<StoryAct> {
  const act = skeleton.acts[actIndex];
  const villains = skeleton.villains
    .map((v) => `${v.name} (${v.role}) — хочет: ${v.motivation}; тайна: ${v.secret}`)
    .join("\n");
  const allActs = skeleton.acts
    .map((a, i) => `${i + 1}. уровни ${a.levelFrom}-${a.levelTo} "${a.name}": ${a.goal}`)
    .join("\n");

  const prompt = `Распиши подробно ОДИН акт кампании D&D 5e.

${describeCampaign(p)}

История: "${skeleton.title}"
Завязка: ${skeleton.premise}
Главная угроза: ${skeleton.mainThreat}

Злодеи кампании:
${villains}

Все акты кампании:
${allActs}

РАСПИСАТЬ НУЖНО ТОЛЬКО АКТ ${actIndex + 1}: уровни ${act.levelFrom}-${act.levelTo}, "${act.name}" — ${act.goal}

Верни JSON РОВНО такой структуры (ключи не переводить):
{
  "name": "${act.name}",
  "levelFrom": ${act.levelFrom},
  "levelTo": ${act.levelTo},
  "goal": "цель акта",
  "summary": "что происходит в акте, 5-8 предложений",
  "scenes": [{"name": "название сцены", "location": "где происходит", "description": "что видит и чувствует игрок, 3-5 предложений", "encounter": "бой, ловушка, загадка или социальная сцена — с конкретикой по существам и сложности"}],
  "twist": "поворот сюжета внутри акта — что оказывается не тем, чем казалось",
  "branches": [{"ifPlayer": "что может сделать игрок", "then": "как из-за этого меняется сюжет"}],
  "rewards": "награды, предметы и информация, которые игрок получает в акте"
}

Требования:
- Сцен: 4-5, они связаны между собой и ведут к цели акта.
- Развилок: 2-3. Это реальные расхождения сюжета, а не косметика.
- Энкаунтеры подбирай под уровни ${act.levelFrom}-${act.levelTo} и сложность "${p.difficulty}".
- Соблюдай тон "${p.tone}". Не пересказывай другие акты.`;

  return requestJson(client, model, prompt, actSchema, `акт ${actIndex + 1}`);
}

// ─── Полная генерация ───

export interface GenerateArcOptions {
  params: ArcGenerationParams;
  model: string;
  apiKey?: string;
  authMode?: AuthMode;
  baseURL?: string;
  onProgress?: (progress: ArcProgress) => void | Promise<void>;
}

const unifiedArcSchema = storyArcSchema.omit({ generatedAt: true, model: true });

export async function generateStoryArc({
  params,
  model,
  apiKey,
  authMode,
  baseURL,
  onProgress,
}: GenerateArcOptions): Promise<StoryArc> {
  const client = createClient(apiKey, authMode, baseURL);
  const report = async (p: ArcProgress) => {
    try {
      await onProgress?.(p);
    } catch (e) {
      console.error("[arc] не удалось сообщить прогресс:", e);
    }
  };

  await report({
    stage: "skeleton",
    stageLabel: "Создаю макро-завязку мира и вводный Акт 1...",
    actsTotal: 1,
    actsDone: 0,
  });

  const actLevelTo = Math.min(params.levelTo, params.levelFrom + 1);

  const prompt = `Сгенерируй сюжетную завязку кампании D&D 5e и вводный Акт 1.

${describeCampaign(params)}

Верни строго JSON по шаблону (все ключи строго на английском):
{
  "title": "название кампании",
  "premise": "завязка истории, 2-4 предложения",
  "mainThreat": "главная угроза кампании (BBEG) и замысел злодея",
  "levelFrom": ${params.levelFrom},
  "levelTo": ${params.levelTo},
  "villains": [
    {"name": "имя", "role": "роль в сюжете", "motivation": "чего хочет и почему", "secret": "тайна, которую игрок узнает не сразу", "appearsInAct": 1}
  ],
  "acts": [
    {
      "name": "название вводного акта",
      "levelFrom": ${params.levelFrom},
      "levelTo": ${actLevelTo},
      "goal": "цель первого акта",
      "summary": "краткое содержание первого акта, 3-5 предложений",
      "scenes": [
        {"name": "Сцена 1: Завязка", "location": "где происходит", "description": "что видит и ощущает герой (2-3 предложения)", "encounter": "исследование, диалог или легкая стычка"},
        {"name": "Сцена 2: Опасность", "location": "где происходит", "description": "развитие напряженности (2-3 предложения)", "encounter": "боевая сцена, ловушка или расследование"},
        {"name": "Сцена 3: Кульминация", "location": "где происходит", "description": "кульминационный момент первого акта (2-3 предложения)", "encounter": "ключевой бой или важная сюжетная встреча"}
      ],
      "twist": "неожиданный сюжетный поворот в финале акта",
      "branches": [
        {"ifPlayer": "вариант решения игрока", "then": "последствия для сюжета"},
        {"ifPlayer": "альтернативное решение", "then": "последствия"}
      ],
      "rewards": "награды, трофеи и зацепка ко второму акту"
    }
  ],
  "finale": "замысел финала всей кампании (2-3 предложения)"
}

Требования:
- Злодеев: 2-3 (главный антагонист BBEG и ключевые приспешники).
- Сцен в Акте 1: ровно 3 (завязка, развитие, кульминация первого акта).
- Развилок: 2 реальных пути.
- Пиши емко, атмосферно, конкретно, соблюдая тон "${params.tone}" и стиль "${params.dmStyle}". Без общих пустых фраз.`;

  const rawArc = await requestJson(
    client,
    model,
    prompt,
    unifiedArcSchema,
    "сюжетную завязку и Акт 1"
  );

  await report({
    stage: "done",
    stageLabel: "История готова (Акт 1)",
    actsTotal: 1,
    actsDone: 1,
  });

  return {
    ...rawArc,
    generatedAt: new Date().toISOString(),
    model,
  };
}

// ─── Чтение сохранённой арки ───

export function parseStoryArc(raw: string | null | undefined): StoryArc | null {
  if (!raw) return null;
  try {
    const parsed = storyArcSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseArcProgress(raw: string | null | undefined): ArcProgress | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ArcProgress;
  } catch {
    return null;
  }
}

// ─── Адаптивная эпизодическая генерация следующей главы (Just-in-Time) ───

export interface GenerateNextChapterOptions {
  campaignId: string;
  outcome: string;
  model?: string;
  apiKey?: string;
  authMode?: AuthMode;
  baseURL?: string;
}

export async function generateNextChapter({
  campaignId,
  outcome,
  model,
  apiKey,
  authMode,
  baseURL,
}: GenerateNextChapterOptions): Promise<{ act: StoryAct; actNumber: number; isFinale: boolean }> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      characters: {
        where: { isAlive: true },
        select: { name: true, type: true, level: true, relation: true, notes: true },
      },
      memories: {
        where: { isArchived: false },
        orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: { category: true, subject: true, content: true },
      },
    },
  });

  if (!campaign) {
    throw new Error(`Кампания ${campaignId} не найдена`);
  }

  const arc = parseStoryArc(campaign.storyArc);
  if (!arc) {
    throw new Error("У кампании нет базовой сюжетной арки");
  }

  const client = createClient(apiKey, authMode, baseURL);
  const storyModel = resolveStoryModel(model || campaign.arcModel || undefined);

  const actNumber = (arc.acts?.length ?? 0) + 1;
  const player = campaign.characters.find((c) => c.type === "player");
  const currentLvl = player?.level ?? campaign.startingLevel;
  const lastAct = arc.acts && arc.acts.length > 0 ? arc.acts[arc.acts.length - 1] : null;
  const actLevelFrom = lastAct ? Math.min(campaign.levelTo, lastAct.levelTo) : currentLvl;
  const nextLevelTo = Math.min(campaign.levelTo, Math.max(actLevelFrom + 2, currentLvl + 2));
  const isFinale = nextLevelTo >= campaign.levelTo;

  // Живые союзники и спутники
  const allies =
    campaign.characters
      .filter((c) => c.type === "companion" || c.relation > 20)
      .map((c) => `${c.name} (${c.relation > 0 ? `+${c.relation}` : ""})`)
      .join(", ") || "нет явных";

  const keyFacts =
    campaign.memories
      .map((m) => `- [${m.category}] ${m.subject}: ${m.content}`)
      .join("\n") || "нет сохранённых записей";

  const prompt = `Ты — ведущий сценарист эпических кампаний D&D 5e.
Игрок успешно прошёл предыдущий этап кампании «${arc.title}».
Сюжет продолжается динамически на основе РЕАЛЬНЫХ выборов и решений игрока!

## Контекст мира и глобальный конфликт
- Завязка: ${arc.premise}
- Главная угроза (BBEG): ${arc.mainThreat}
- Злодеи в кампании: ${arc.villains.map((v) => `${v.name} (${v.role}) - хочет: ${v.motivation}; тайна: ${v.secret}`).join("; ")}

## Реальное состояние кампании
- Чем завершился предыдущий акт: «${outcome}»
- Уровень героев для этой главы: ${actLevelFrom}-${nextLevelTo} (максимальный уровень кампании: ${campaign.levelTo})
- Союзники игрока: ${allies}
- Ключевые решения и факты:
${keyFacts}

Сгенерируй НОВУЮ СЛЕДУЮЩУЮ ГЛАВУ (Акт ${actNumber}) на уровни ${actLevelFrom}-${nextLevelTo}.
Она должна логически вытекать из последствий решений игрока, развивать мир и приближать к разгадке замысла BBEG.
${isFinale ? `ВАЖНО: Это финальный этап кампании (достигнут ур. ${campaign.levelTo})! Кульминационная сцена 3 обязана быть решающим противостоянием с главным злодеем BBEG (${arc.mainThreat}).` : `Кампания продолжается вплоть до уровня ${campaign.levelTo}. Не раскрывай все карты раньше времени.`}

Верни JSON РОВНО такой структуры (ключи не переводить):
{
  "name": "название нового акта",
  "levelFrom": ${actLevelFrom},
  "levelTo": ${nextLevelTo},
  "goal": "новая цель акта, вытекающая из итогов прошлого",
  "summary": "развитие сюжета с учётом выборов игрока, 5-8 предложений",
  "scenes": [{"name": "название сцены", "location": "локация", "description": "описание сцены, 3-5 предложений", "encounter": "энкаунтер под ур. ${actLevelFrom}-${nextLevelTo}"}],
  "twist": "неожиданный сюжетный поворот",
  "branches": [{"ifPlayer": "вариант действий игрока", "then": "последствия"}],
  "rewards": "награды, зацепки и трофеи"
}`;

  const newAct = await requestJson(client, storyModel, prompt, actSchema, `акт ${actNumber}`);

  // Добавляем новый акт в сюжетную арку кампании
  arc.acts.push(newAct);
  await db.campaign.update({
    where: { id: campaignId },
    data: {
      storyArc: JSON.stringify(arc),
    },
  });

  return {
    act: newAct,
    actNumber,
    isFinale: nextLevelTo >= campaign.levelTo,
  };
}

