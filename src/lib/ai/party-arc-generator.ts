import { z } from "zod";
import { generateText } from "ai";
import { createClient, type AuthMode } from "./client";
import { resolveStoryModel } from "./models";

export interface PartyRosterMember {
  id: string;
  name: string;
  race?: string;
  className?: string;
  subclass?: string;
  level: number;
  background?: string;
  alignment?: string;
  personalityTraits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  backstory?: string;
}

export type StartingSituation =
  | "strangers"
  | "established_party"
  | "captives_or_survivors"
  | "patron_contract";

export interface PartyArcGenerationParams {
  title: string;
  setting: string;
  tone: string;
  difficulty: "easy" | "normal" | "hard" | "brutal";
  dmStyle?: string;
  ruleStrictness?: string;
  levelFrom: number;
  levelTo: number;
  startingSituation: StartingSituation;
  customDmNotes?: string | null;
  party: PartyRosterMember[];
}

export interface CombatDifficultyConfig {
  distribution: string;
  probabilities: {
    easy: number;
    medium: number;
    hard: number;
    deadly: number;
  };
}

export const partyAwareAct1Schema = z.object({
  title: z.string(),
  premise: z.string(),
  mainThreat: z.string(),
  levelFrom: z.number().int(),
  levelTo: z.number().int(),
  villains: z
    .array(
      z.object({
        name: z.string(),
        role: z.string(),
        motivation: z.string(),
        secret: z.string(),
        appearsInAct: z.number().int().default(1),
      })
    )
    .min(2),
  act: z.object({
    name: z.string(),
    levelFrom: z.number().int(),
    levelTo: z.number().int(),
    goal: z.string(),
    summary: z.string(),
    climaxObjective: z.string(),
    personalHooks: z.array(
      z.object({
        characterName: z.string(),
        hook: z.string(),
        relatedNpcOrItem: z.string().optional(),
      })
    ),
    scenes: z
      .array(
        z.object({
          name: z.string(),
          sceneType: z.enum([
            "exploration",
            "social",
            "combat",
            "stealth",
            "puzzle",
            "climax",
          ]),
          location: z.string(),
          description: z.string(),
          encounter: z.string(),
          involvedCharacters: z.array(z.string()).optional(),
        })
      )
      .min(5)
      .max(7),
    twist: z.string(),
    branches: z
      .array(
        z.object({
          ifPlayer: z.string(),
          then: z.string(),
        })
      )
      .min(2),
    rewards: z.string(),
  }),
  finaleHint: z.string(),
});

export type PartyAwareAct1 = z.infer<typeof partyAwareAct1Schema>;

/**
 * Extracts normalized character data from room participant snapshots.
 */
export function extractPartyRosterFromParticipants(
  participants: Array<{
    id: string;
    userId: string;
    characterSnapshot?: Record<string, unknown> | null;
  }>
): PartyRosterMember[] {
  const result: PartyRosterMember[] = [];

  for (const p of participants) {
    if (!p.characterSnapshot) continue;

    const snap = p.characterSnapshot as Record<string, any>;
    const nestedChar = snap.character || snap.data || snap;

    const name =
      snap.name ||
      nestedChar.name ||
      `Герой ${p.userId.slice(0, 4)}`;

    const race =
      snap.race ||
      nestedChar.race ||
      nestedChar.subrace ||
      undefined;

    const className =
      snap.className ||
      nestedChar.class ||
      nestedChar.className ||
      undefined;

    const subclass =
      snap.subclass ||
      nestedChar.subclass ||
      undefined;

    const level = Number(
      snap.level ||
      nestedChar.level ||
      1
    );

    const background =
      snap.background ||
      nestedChar.background ||
      nestedChar.data?.background ||
      undefined;

    const bonds =
      snap.bonds ||
      nestedChar.bonds ||
      nestedChar.data?.bonds ||
      undefined;

    const flaws =
      snap.flaws ||
      nestedChar.flaws ||
      nestedChar.data?.flaws ||
      undefined;

    const ideals =
      snap.ideals ||
      nestedChar.ideals ||
      nestedChar.data?.ideals ||
      undefined;

    const alignment =
      snap.alignment ||
      nestedChar.alignment ||
      undefined;

    const personalityTraits =
      snap.personalityTraits ||
      nestedChar.personalityTraits ||
      undefined;

    const backstory =
      snap.backstory ||
      nestedChar.backstory ||
      undefined;

    result.push({
      id: p.id,
      name: String(name),
      race: race ? String(race) : undefined,
      className: className ? String(className) : undefined,
      subclass: subclass ? String(subclass) : undefined,
      level: isNaN(level) ? 1 : level,
      background: background ? String(background) : undefined,
      alignment: alignment ? String(alignment) : undefined,
      personalityTraits: personalityTraits ? String(personalityTraits) : undefined,
      ideals: ideals ? String(ideals) : undefined,
      bonds: bonds ? String(bonds) : undefined,
      flaws: flaws ? String(flaws) : undefined,
      backstory: backstory ? String(backstory) : undefined,
    });
  }

  return result;
}

/**
 * Builds rich, detailed prompt block for the party roster,
 * instructing the LLM to integrate each player's personal backstory.
 */
export function synthesizePartyRosterPrompt(party: PartyRosterMember[]): string {
  if (party.length === 0) {
    return "Отряд путешественников (состав формируется по ходу сюжета).";
  }

  const lines = [
    "### Состав отряда героев (Действующие персонажи игроков):",
  ];

  party.forEach((member, idx) => {
    const classInfo = member.subclass
      ? `${member.className} (${member.subclass})`
      : member.className || "Класс не указан";

    const parts = [
      `${idx + 1}. **${member.name}** — ${member.race || "Раса не указана"}, ${classInfo}, ${member.level} ур.`,
    ];

    if (member.background) parts.push(`   - Предыстория: ${member.background}`);
    if (member.bonds) parts.push(`   - Привязанности: ${member.bonds}`);
    if (member.flaws) parts.push(`   - Слабости: ${member.flaws}`);
    if (member.ideals) parts.push(`   - Идеалы: ${member.ideals}`);
    if (member.backstory) parts.push(`   - Краткая предыстория: ${member.backstory}`);

    lines.push(parts.join("\n"));
  });

  lines.push(
    "\nОБЯЗАТЕЛЬНОЕ ТРЕБОВАНИЕ К ИИ:",
    "- Для КАЖДОГО героя отряда должна быть создана как минимум одна конкретная личная сюжетная зацепка (Personal Plot Hook).",
    "- Зацепка должна связывать предысторию, расу, привязанность или тайну персонажа с событиями и NPC Акта 1."
  );

  return lines.join("\n");
}

/**
 * Maps campaign combat difficulty to encounter probability distribution (DMG p. 82).
 */
export function getCombatDifficultyConfig(difficulty: string): CombatDifficultyConfig {
  switch (difficulty) {
    case "easy":
      return {
        distribution: "60% Easy / 30% Medium / 10% Hard",
        probabilities: { easy: 0.6, medium: 0.3, hard: 0.1, deadly: 0.0 },
      };
    case "hard":
      return {
        distribution: "40% Hard / 40% Deadly / 20% Medium",
        probabilities: { easy: 0.0, medium: 0.2, hard: 0.4, deadly: 0.4 },
      };
    case "brutal":
      return {
        distribution: "60% Deadly / 30% Hard / 10% Medium",
        probabilities: { easy: 0.0, medium: 0.1, hard: 0.3, deadly: 0.6 },
      };
    case "normal":
    default:
      return {
        distribution: "50% Medium / 30% Hard / 20% Deadly",
        probabilities: { easy: 0.0, medium: 0.5, hard: 0.3, deadly: 0.2 },
      };
  }
}

const startingSituationDescriptions: Record<StartingSituation, string> = {
  strangers:
    "«Незнакомцы, сведённые судьбой» — герои не знают друг друга и встречаются в момент неожиданного общего кризиса (нападение на таверну, шторм, засада на караван).",
  established_party:
    "«Сплочённый отряд со стажем» — герои уже давно путешествуют вместе, доверяют друг другу и имеют общие боевые победы и репутацию.",
  captives_or_survivors:
    "«Узники / Выжившие» — приключение начинается экстремально: герои очнулись в плену, темнице, на невольничьем корабле или чудом выжили после крушения.",
  patron_contract:
    "«Контракт от гильдии или могущественного покровителя» — отряд нанят влиятельной фракцией или эксцентричным лордом для выполнения сложного и опасного поручения.",
};

/**
 * Builds the dynamic prompt for generating strictly Act 1.
 * Enforces dynamic scene pacing (bans rigid templates) and integrates party hooks.
 */
export function buildPartyAct1Prompt(params: PartyArcGenerationParams): string {
  const diffConfig = getCombatDifficultyConfig(params.difficulty);
  const partyPrompt = synthesizePartyRosterPrompt(params.party);
  const situationText = startingSituationDescriptions[params.startingSituation] || params.startingSituation;
  const actLevelTo = Math.min(params.levelTo, Math.max(params.levelFrom + 2, 3));

  return `Ты — ведущий геймдизайнер и сценарист кампаний D&D 5e.
Твоя задача — сгенерировать глобальный замысел кампании и ПОЛНОЦЕННЫЙ, ГЛУБОКИЙ, НАСЫЩЕННЫЙ ТОЛЬКО АКТ 1.

ВНИМАНИЕ: БУДУЩИЕ АКТЫ (2, 3 и т.д.) НЕ ГЕНЕРИРУЮТСЯ СЕЙЧАС!
Ты НЕ знаешь, сколько всего будет актов в кампании и когда она закончится.
Ты знаешь только:
1. Макро-завязку мира и главного антагониста (BBEG).
2. Диапазон кампании: с ${params.levelFrom} по ${params.levelTo} уровень.
3. Вводный Акт 1 на уровни ${params.levelFrom}-${actLevelTo}.

## Параметры кампании
- Название: «${params.title}»
- Сеттинг / Жанр: ${params.setting}
- Тон повествования: ${params.tone}
- Сложность боёв: ${params.difficulty} (${diffConfig.distribution})
- Начальная связь героев: ${situationText} (Код: ${params.startingSituation})
- Стиль мастера: ${params.dmStyle || "Сбалансированный (баланс боёв, расследования и отыгрыша)"}
${params.customDmNotes ? `- Особые авторские пожелания Человека-ДМа: ${params.customDmNotes}` : ""}

${partyPrompt}

## КАТЕГОРИЧЕСКИЕ ПРАВИЛА КОМПОЗИЦИИ (СТРОГИЙ ЗАПРЕТ НА ШАБЛОНЫ):
1. ЗАПРЕЩЕНО использовать шаблонную фиксированную последовательность сцен (вроде: 1.таверна -> 2.разведка -> 3.засада -> 4.пещера -> 5.минибосс -> 6.твист -> 7.босс).
2. Структура и темп Акта 1 ДОЛЖНЫ органично вытекать из сеттинга («${params.setting}») и завязки («${params.startingSituation}»)!
   - Например, если завязка «Узники / Выжившие» — Акт 1 начинается прямо в пылу побега или опасности, а не с мирного опроса горожан.
   - Если жанр «Готический детектив» — упор на осмотр места преступления, психологическое напряжение, ложные улики.
   - Если «Военный штурм» — активная оборона, прорыв сквозь брешь, диверсия.
3. Акт 1 должен содержать от 5 до 7 сцен с разнообразными типами: "exploration", "social", "combat", "stealth", "puzzle", "climax".
4. Кульминация Акта 1 (climaxObjective) должна быть чётко сформулированной задачей, по достижении которой Человек-ДМ сможет перевести отряд в Акт 2.

Верни строго валидный JSON по следующей схеме (все ключи строго на английском):
{
  "title": "название кампании",
  "premise": "макро-завязка истории мира (3-5 предложений)",
  "mainThreat": "главная угроза всей кампании (BBEG) и его конечный замысел",
  "levelFrom": ${params.levelFrom},
  "levelTo": ${params.levelTo},
  "villains": [
    {"name": "имя главного злодея (BBEG)", "role": "Главный антагонист", "motivation": "чего жаждет", "secret": "сокровенная тайна BBEG", "appearsInAct": 1},
    {"name": "имя лейтенанта", "role": "Полевой командир Акта 1", "motivation": "почему служит BBEG", "secret": "слабость или уязвимость", "appearsInAct": 1}
  ],
  "act": {
    "name": "Название Акта 1",
    "levelFrom": ${params.levelFrom},
    "levelTo": ${actLevelTo},
    "goal": "Главная цель отряда в Акте 1",
    "summary": "Развернутое содержание Акта 1 (4-6 предложений)",
    "climaxObjective": "Конкретная цель кульминации Акта 1 (победа над кем-то, спасение святыни, побег)",
    "personalHooks": [
      {"characterName": "Имя героя 1", "hook": "Специфическая зацепка к его предыстории/бондам", "relatedNpcOrItem": "связанный NPC или реликвия"}
    ],
    "scenes": [
      {
        "name": "Название сцены",
        "sceneType": "combat",
        "location": "Атмосферное место",
        "description": "Что происходит, что видят и слышат герои (2-3 предложения)",
        "encounter": "Описание ситуации, угрозы или тактического столкновения",
        "involvedCharacters": ["Имя героя"]
      }
    ],
    "twist": "Сюжетный поворот в финале Акта 1, переворачивающий понимание ситуации",
    "branches": [
      {"ifPlayer": "Если игроки выбирают путь А", "then": "Последствия для мира"},
      {"ifPlayer": "Если игроки выбирают путь Б", "then": "Альтернативные последствия"}
    ],
    "rewards": "Награды отряду, добыча, уровень и зацепка к следующему акту"
  },
  "finaleHint": "Краткий намёк на то, к чему в итоге может привести победа над BBEG (2 предложения)"
}`;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/**
 * Generates Party-Aware Act 1 using the story model.
 */
export async function generatePartyAwareAct1(
  params: PartyArcGenerationParams,
  options?: {
    model?: string;
    apiKey?: string;
    authMode?: AuthMode;
    baseURL?: string;
  }
): Promise<PartyAwareAct1> {
  const client = createClient(options?.apiKey, options?.authMode, options?.baseURL);
  const storyModel = resolveStoryModel(options?.model);
  const prompt = buildPartyAct1Prompt(params);

  const result = await generateText({
    model: client.chat(storyModel),
    system:
      "Ты — элитный сценарист D&D 5e. Твоя задача — генерировать только валидный JSON без markdown-оберток и лишнего текста.",
    prompt,
    temperature: 0.7,
  });

  const rawJson = extractJson(result.text);
  const parsedJson = JSON.parse(rawJson);
  return partyAwareAct1Schema.parse(parsedJson);
}
