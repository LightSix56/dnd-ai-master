// AI Tools для D&D Master — function calling через AI SDK
// Батчевые по замыслу: roll_dice, update_character и record принимают массивы,
// чтобы весь ход закрывался минимумом шагов (каждый шаг = переотправка промпта).

import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { rollDice, abilityModifier, proficiencyBonus } from "@/lib/dnd/dice";
import { searchDuckDuckGo, fetchPageText } from "@/lib/dnd/search";
import { parseStoryArc, type StoryAct, generateNextChapter } from "./story-arc";
import { createTacticalEncounter } from "@/lib/combat/generator";

// Контекст кампании приходит per-request через toolsContext, а не через глобальное
// состояние модуля: иначе параллельные запросы перетирают campaignId друг друга.
const campaignContextSchema = z.object({ campaignId: z.string().optional() });

// Записи памяти попадают в контекст каждого запроса, поэтому их длина —
// это постоянный налог на каждый ход. Режем на входе.
const MEMORY_CONTENT_LIMIT = 220;
const EVENT_DESC_LIMIT = 120;

// Утилита для безопасного парсинга JSON-полей из SQLite
function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ============ ИНСТРУМЕНТЫ ДЛЯ КУБИКОВ И МАТЕМАТИКИ ============

// Батчевый бросок: раньше модель делала по отдельному вызову на каждый кубик
// (в логах — 9 подряд), а каждый вызов означает новый шаг и повторную отправку
// всего промпта. Массив rolls позволяет закрыть весь раунд одним шагом.
export const rollDiceTool = tool({
  description:
    "Броски кубиков D&D 5e. НЕ ВЫДУМЫВАЙ числа — только этот инструмент. " +
    "ВАЖНО: все броски одного хода делай ОДНИМ вызовом, передав массив rolls " +
    "(инициатива всех участников, серия атак, урон по нескольким целям). " +
    "Нотация: 'd20', '1d20+5', '2d6+3'.",
  inputSchema: z.object({
    rolls: z
      .array(
        z.object({
          notation: z.string().describe("Нотация, например 'd20+5'"),
          purpose: z
            .string()
            .describe("attack, damage, save, check, initiative"),
          label: z.string().optional().describe("Пояснение, например 'Атака гоблина'"),
        })
      )
      .min(1)
      .describe("Список всех бросков этого хода — заполняй разом, а не по одному"),
  }),
  execute: async ({ rolls }) => {
    const results = rolls.map(({ notation, purpose, label }) => {
      try {
        const result = rollDice(notation);
        return { ...result, purpose, label: label || purpose, notation };
      } catch (e) {
        return { notation, purpose, label: label || purpose, error: (e as Error).message };
      }
    });
    return { count: results.length, results };
  },
});

export const calculateTool = tool({
  description:
    "Калькулятор для точных вычислений D&D. Используй для расчёта урона с учётом сопротивлений, " +
    "модификаторов характеристик, бонусов мастерства. НЕ считай в уме — используй калькулятор. " +
    "Поддерживаются базовые операции: +, -, *, /, скобки, и функции: abilityMod(n), prof(level).",
  inputSchema: z.object({
    expression: z
      .string()
      .describe(
        "Математическое выражение, например '2d6+3+5' (если уже бросил) или '(15-10)/2' или 'abilityMod(16)+prof(5)'"
      ),
    context: z
      .string()
      .optional()
      .describe("Что считаем — для логирования"),
  }),
  execute: async ({ expression, context }) => {
    try {
      // Заменяем функции abilityMod и prof на их значения
      let expr = expression;

      // abilityMod(16) -> 3
      expr = expr.replace(/abilityMod\s*\(\s*(\d+)\s*\)/g, (_, n) =>
        String(abilityModifier(parseInt(n, 10)))
      );

      // prof(5) -> 3
      expr = expr.replace(/prof\s*\(\s*(\d+)\s*\)/g, (_, n) =>
        String(proficiencyBonus(parseInt(n, 10)))
      );

      // Простое вычисление: только цифры и операторы
      if (!/^[\d+\-*/().\s]+$/.test(expr)) {
        return { error: "Недопустимые символы в выражении", expression };
      }
      // Безопасное вычисление через Function
      const result = Function(`"use strict"; return (${expr});`)();
      const num = Number(result);
      if (!Number.isFinite(num)) {
        return { error: "Результат не является конечным числом (деление на ноль?)", expression };
      }
      return {
        expression,
        result: num,
        context: context || "",
      };
    } catch (e) {
      return { error: (e as Error).message, expression };
    }
  },
} as any);

// ============ ИНСТРУМЕНТЫ ДЛЯ ПОИСКА ПО ЛОРУ И ПРАВИЛАМ ============

export const searchWebTool = tool({
  description:
    "Поиск в интернете по правилам D&D 5e, лору Забытых Королевств, монстрам, заклинаниям. " +
    "Используй когда сомневаешься в правиле или механике. Запрос формулируй на английском " +
    "для лучших результатов (например: 'DnD 5e Grapple rules', 'Waterdeep City Watch ranks').",
  inputSchema: z.object({
    query: z.string().describe("Поисковый запрос (лучше на английском)"),
    limit: z.number().int().min(1).max(5).default(3).describe("Количество результатов"),
  }),
  execute: async ({ query, limit }) => {
    const results = await searchDuckDuckGo(query, limit);
    return { count: results.length, results };
  },
});

export const fetchPageTool = tool({
  description:
    "Загрузить текст веб-страницы по URL. Используй для чтения найденных страниц с правилами.",
  inputSchema: z.object({
    url: z.string().url().describe("URL страницы для загрузки"),
  }),
  execute: async ({ url }) => {
    const text = await fetchPageText(url);
    return { url, text, length: text.length };
  },
});

// ============ ИНСТРУМЕНТЫ ДЛЯ УПРАВЛЕНИЯ ПЕРСОНАЖАМИ ============

export const listCharactersTool = tool({
  description:
    "Получить список всех персонажей в текущей кампании — игроков, NPC, врагов. " +
    "Используй в начале сцены или когда нужно вспомнить кто рядом.",
  inputSchema: z.object({
    type: z
      .enum(["all", "player", "npc", "enemy", "companion"])
      .optional()
      .describe("Фильтр по типу персонажа"),
  }),
  contextSchema: campaignContextSchema,
  execute: async ({ type }, { context }) => {
    const { campaignId } = context;
    const where = { campaignId, ...(type && type !== "all" ? { type } : {}) };
    const chars = await db.character.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
    return {
      count: chars.length,
      characters: chars.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        race: c.race,
        class: c.class,
        level: c.level,
        hp:
          c.type === "player"
            ? `${c.hpCurrent}/${c.hpMax}`
            : c.hpCurrent <= 0
              ? "без сознания / при смерти"
              : c.hpCurrent <= c.hpMax * 0.3
                ? "тяжело ранен"
                : c.hpCurrent < c.hpMax
                  ? "ранен"
                  : "невредим",
        ac: c.ac,
        isAlive: c.isAlive,
        location: c.location,
        status: c.notes || undefined,
      })),
    };
  },
} as any);

export const getCharacterTool = tool({
  description:
    "Получить полную информацию о персонаже по имени или id — характеристики, инвентарь, заклинания, состояние. " +
    "Используй перед боем или когда нужно узнать детали о персонаже.",
  inputSchema: z.object({
    nameOrId: z
      .string()
      .describe("Имя персонажа или его id"),
  }),
  contextSchema: campaignContextSchema,
  execute: async ({ nameOrId }, { context }) => {
    const { campaignId } = context;
    const char = await db.character.findFirst({
      where: {
        campaignId,
        OR: [
          { id: nameOrId },
          { name: { contains: nameOrId } },
        ],
      },
    });
    if (!char) {
      return { error: `Персонаж '${nameOrId}' не найден` };
    }
    return {
      id: char.id,
      name: char.name,
      type: char.type,
      race: char.race,
      class: char.class,
      subclass: char.subclass,
      level: char.level,
      background: char.background,
      stats: {
        str: char.str,
        dex: char.dex,
        con: char.con,
        int: char.int,
        wis: char.wis,
        cha: char.cha,
      },
      modifiers: {
        str: abilityModifier(char.str),
        dex: abilityModifier(char.dex),
        con: abilityModifier(char.con),
        int: abilityModifier(char.int),
        wis: abilityModifier(char.wis),
        cha: abilityModifier(char.cha),
      },
      hp: `${char.hpCurrent}/${char.hpMax}`,
      ac: char.ac,
      speed: char.speed,
      profBonus: char.profBonus,
      inventory: parseJSON(char.inventory, []),
      spells: parseJSON(char.spells, []),
      appearance: char.appearance,
      personality: char.personality,
      bonds: char.bonds,
      flaws: char.flaws,
      isAlive: char.isAlive,
      location: char.location,
      relation: char.relation,
      notes: char.notes,
    };
  },
});

// Батчевое обновление: в бою за один ход меняются HP сразу нескольких участников,
// и раньше это стоило по отдельному шагу на каждого.
const characterUpdatesSchema = z.object({
  hpCurrent: z.number().int().optional(),
  hpMax: z.number().int().optional(),
  ac: z.number().int().optional(),
  level: z.number().int().optional(),
  inventory: z.array(z.any()).optional(),
  spells: z.array(z.any()).optional(),
  location: z.string().optional(),
  relation: z.number().int().min(-100).max(100).optional(),
  isAlive: z.boolean().optional(),
  notes: z.string().optional(),
  statusDescription: z
    .string()
    .optional()
    .describe(
      "Краткий нарративный статус/действие NPC (например: 'ведёт бой', 'разговаривает с героем', 'настороже', 'тяжело ранен')"
    ),
});

export const updateCharacterTool = tool({
  description:
    "Обновить состояние персонажей: HP, инвентарь, уровень, локация, отношение, жив/мёртв, статус. " +
    "ВАЖНО: все изменения одного хода передавай ОДНИМ вызовом через массив changes. " +
    "НЕ выдумывай изменения — только то, что реально произошло.",
  inputSchema: z.object({
    changes: z
      .array(
        z.object({
          nameOrId: z.string().describe("Имя или id персонажа"),
          updates: characterUpdatesSchema.describe("Только изменённые поля"),
          reason: z.string().describe("Причина — коротко, для журнала"),
        })
      )
      .min(1)
      .describe("Список всех изменений этого хода"),
  }),
  contextSchema: campaignContextSchema,
  execute: async ({ changes }, { context }) => {
    const { campaignId } = context;
    const results: any[] = [];

    for (const { nameOrId, updates, reason } of changes) {
      const char = await db.character.findFirst({
        where: {
          campaignId,
          OR: [{ id: nameOrId }, { name: { contains: nameOrId } }],
        },
      });
      if (!char) {
        results.push({ nameOrId, error: `Персонаж '${nameOrId}' не найден` });
        continue;
      }

      const data: Record<string, unknown> = {};
      if (updates.hpCurrent !== undefined) data.hpCurrent = updates.hpCurrent;
      if (updates.hpMax !== undefined) data.hpMax = updates.hpMax;
      if (updates.ac !== undefined) data.ac = updates.ac;
      if (updates.level !== undefined) {
        data.level = updates.level;
        data.profBonus = proficiencyBonus(updates.level);
      }
      if (updates.inventory !== undefined) data.inventory = JSON.stringify(updates.inventory);
      if (updates.spells !== undefined) data.spells = JSON.stringify(updates.spells);
      if (updates.location !== undefined) data.location = updates.location;
      if (updates.relation !== undefined) data.relation = updates.relation;
      if (updates.isAlive !== undefined) data.isAlive = updates.isAlive;
      if (updates.statusDescription !== undefined) {
        data.notes = updates.statusDescription;
      } else if (updates.notes !== undefined) {
        data.notes = updates.notes;
      }

      const updated = await db.character.update({ where: { id: char.id }, data });

      await db.gameEvent.create({
        data: {
          campaignId,
          type: "character_update",
          description: `${char.name}: ${reason}`,
          participants: JSON.stringify([char.id]),
          result: JSON.stringify(data),
        },
      });

      results.push({
        name: updated.name,
        hp: `${updated.hpCurrent}/${updated.hpMax}`,
        updatedFields: Object.keys(data),
      });
    }

    return { success: true, count: results.length, results };
  },
} as any);

export const createCharacterTool = tool({
  description:
    "Создать нового персонажа — NPC, врага, спутника. " +
    "Используй когда в сюжете появляется новый значимый персонаж. " +
    "Заполни ВСЕ ключевые поля: имя, тип, расу, класс (если есть), уровень, характеристики, HP, AC. " +
    "Для NPC минимально: name, type='npc', race, hpMax, hpCurrent, ac.",
  inputSchema: z.object({
    name: z.string().describe("Имя персонажа"),
    type: z.enum(["player", "npc", "enemy", "companion"]),
    race: z.string().optional(),
    class: z.string().optional(),
    subclass: z.string().optional(),
    level: z.number().int().min(1).max(20).default(1),
    background: z.string().optional(),
    str: z.number().int().min(1).max(30).default(10),
    dex: z.number().int().min(1).max(30).default(10),
    con: z.number().int().min(1).max(30).default(10),
    int: z.number().int().min(1).max(30).default(10),
    wis: z.number().int().min(1).max(30).default(10),
    cha: z.number().int().min(1).max(30).default(10),
    hpMax: z.number().int().min(1).default(10),
    ac: z.number().int().min(1).default(10),
    speed: z.number().int().min(0).default(30),
    inventory: z.array(z.any()).default([]),
    spells: z.array(z.any()).default([]),
    appearance: z.string().optional(),
    personality: z.string().optional(),
    location: z.string().optional(),
    relation: z.number().int().min(-100).max(100).default(0),
    notes: z.string().optional(),
  }),
  contextSchema: campaignContextSchema,
  execute: async (params, { context }) => {
    const { campaignId } = context;
    const char = await db.character.create({
      data: {
        campaignId,
        name: params.name,
        type: params.type,
        race: params.race,
        class: params.class,
        subclass: params.subclass,
        level: params.level,
        background: params.background,
        str: params.str,
        dex: params.dex,
        con: params.con,
        int: params.int,
        wis: params.wis,
        cha: params.cha,
        hpMax: params.hpMax,
        hpCurrent: params.hpMax,
        ac: params.ac,
        speed: params.speed,
        profBonus: proficiencyBonus(params.level),
        inventory: JSON.stringify(params.inventory),
        spells: JSON.stringify(params.spells),
        appearance: params.appearance,
        personality: params.personality,
        location: params.location,
        relation: params.relation,
        notes: params.notes,
      },
    });
    return {
      success: true,
      characterId: char.id,
      name: char.name,
      message: `Создан персонаж: ${char.name} (${char.type})`,
    };
  },
} as any);

// ============ ИНСТРУМЕНТЫ ДЛЯ ПАМЯТИ ============

// save_memory и log_event в логах всегда шли подряд, каждый — отдельным шагом
// с полной переотправкой промпта. Объединены в одну запись: и факты, и журнал
// за один вызов. Оба списка необязательны.
export const recordTool = tool({
  description:
    "Записать итоги хода: важные факты в память и события в журнал. ОДИН вызов на ход, в самом конце. " +
    "memories — только то, что влияет на сюжет (одно предложение на факт, без пересказа сцены). " +
    "events — короткие пометки о значимых действиях. " +
    "Банальности вроде 'игрок зашёл в таверну' не сохраняй.",
  inputSchema: z.object({
    memories: z
      .array(
        z.object({
          category: z.enum([
            "character",
            "location",
            "quest",
            "world",
            "item",
            "relationship",
            "prophecy",
            "decision",
          ]),
          subject: z.string().describe("О ком/о чём, например 'Барон Малкольм'"),
          content: z.string().describe("Факт одним предложением, до 200 символов"),
          importance: z.number().int().min(1).max(10).default(5),
        })
      )
      .optional()
      .describe("Факты для долгой памяти — обычно 0-2 за ход"),
    events: z
      .array(
        z.object({
          type: z.enum([
            "combat_start",
            "combat_end",
            "exploration",
            "social",
            "story",
            "rest",
            "level_up",
            "death",
            "quest",
            "discovery",
          ]),
          description: z.string().describe("Что произошло — до 100 символов"),
          location: z.string().optional(),
          isImportant: z.boolean().default(false),
        })
      )
      .optional()
      .describe("Записи в журнал событий"),
    characters: z
      .array(
        z.object({
          name: z.string().describe("Имя NPC, врага или спутника (например: 'Лианор', 'Похититель в сером плаще')"),
          type: z.enum(["npc", "enemy", "companion"]).default("npc"),
          race: z.string().optional().describe("Раса или происхождение ('полуэльф', 'человек')"),
          class: z.string().optional().describe("Класс или род занятий ('бард', 'культист')"),
          location: z.string().optional().describe("Текущая локация ('сцена таверны', 'за кулисами кухни')"),
          status: z.string().optional().describe("Качественный статус ('без сознания', 'утаскивают за занавес')"),
          relation: z.number().int().min(-100).max(100).default(0),
          notes: z.string().optional().describe("Краткая заметка мастера об NPC"),
        })
      )
      .optional()
      .describe("Новые NPC, появившиеся в этой сцене — автоматически сохраняются в боковое меню 'Персы'"),
    characterUpdates: z
      .array(
        z.object({
          name: z.string().describe("Имя существующего персонажа"),
          location: z.string().optional(),
          status: z.string().optional().describe("Новый статус: 'ранен', 'связан', 'скрылся'"),
          relation: z.number().int().min(-100).max(100).optional(),
          isAlive: z.boolean().optional(),
          notes: z.string().optional(),
        })
      )
      .optional()
      .describe("Обновления состояний существующих NPC в сцене"),
  }),
  contextSchema: campaignContextSchema,
  execute: async ({ memories, events, characters, characterUpdates }, { context }) => {
    const { campaignId } = context;

    // Обрезаем на входе: модель регулярно пишет в память абзацами
    // (в замерах средняя запись была 745 символов при максимуме 2000).
    const savedMemories = await Promise.all(
      (memories ?? []).map((m) =>
        db.memory.create({
          data: {
            campaignId,
            category: m.category,
            subject: m.subject.slice(0, 120),
            content: m.content.slice(0, MEMORY_CONTENT_LIMIT),
            importance: m.importance,
          },
        })
      )
    );

    const savedEvents = await Promise.all(
      (events ?? []).map((e) =>
        db.gameEvent.create({
          data: {
            campaignId,
            type: e.type,
            description: e.description.slice(0, EVENT_DESC_LIMIT),
            location: e.location,
            isImportant: e.isImportant,
          },
        })
      )
    );

    let charactersCreated = 0;
    if (characters && characters.length > 0) {
      for (const char of characters) {
        if (!char.name) continue;
        const existing = await db.character.findFirst({
          where: { campaignId, name: char.name },
        });
        if (!existing) {
          await db.character.create({
            data: {
              campaignId,
              name: char.name,
              type: char.type || "npc",
              race: char.race || null,
              class: char.class || null,
              location: char.location || null,
              notes: char.status ? `[Статус: ${char.status}] ${char.notes || ""}`.trim() : char.notes || null,
              relation: char.relation ?? 0,
            },
          });
          charactersCreated++;
        }
      }
    }

    let charactersUpdated = 0;
    if (characterUpdates && characterUpdates.length > 0) {
      for (const u of characterUpdates) {
        const existing = await db.character.findFirst({
          where: { campaignId, name: u.name },
        });
        if (existing) {
          const updateData: Record<string, unknown> = {};
          if (u.location !== undefined) updateData.location = u.location;
          if (u.relation !== undefined) updateData.relation = u.relation;
          if (u.isAlive !== undefined) updateData.isAlive = u.isAlive;
          if (u.status || u.notes) {
            const prefix = u.status ? `[Статус: ${u.status}] ` : "";
            updateData.notes = `${prefix}${u.notes || existing.notes || ""}`.trim();
          }
          await db.character.update({
            where: { id: existing.id },
            data: updateData,
          });
          charactersUpdated++;
        }
      }
    }

    return {
      success: true,
      memoriesSaved: savedMemories.length,
      eventsLogged: savedEvents.length,
      charactersCreated,
      charactersUpdated,
    };
  },
} as any);

export const recallMemoriesTool = tool({
  description:
    "Получить сохранённые факты из долгосрочной памяти кампании. " +
    "Используй в начале сессии или когда нужно вспомнить детали: " +
    "имена NPC, квестовые зацепки, отношения, мировые события. " +
    "Можно фильтровать по категории или субъекту.",
  inputSchema: z.object({
    category: z
      .enum(["character", "location", "quest", "world", "item", "relationship", "prophecy", "decision"])
      .optional()
      .describe("Фильтр по категории"),
    subject: z
      .string()
      .optional()
      .describe("Поиск по субъекту (частичное совпадение)"),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  contextSchema: campaignContextSchema,
  execute: async ({ category, subject, limit }, { context }) => {
    const { campaignId } = context;
    const where: Record<string, unknown> = {
      campaignId,
      isArchived: false,
    };
    if (category) where.category = category;
    if (subject) where.subject = { contains: subject };

    const memories = await db.memory.findMany({
      where,
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return {
      count: memories.length,
      // Date нельзя отдавать как есть: на следующем шаге клиент присылает
      // результат инструмента обратно, и объект Date не проходит валидацию
      // ModelMessage[] — весь чат падает с "messages do not match the schema".
      memories: memories.map((m) => ({
        id: m.id,
        category: m.category,
        subject: m.subject,
        content: m.content,
        importance: m.importance,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  },
} as any);

// ============ ИНСТРУМЕНТЫ СЮЖЕТНОЙ АРКИ ============

// В промпт кладётся только текущий акт. Эти два инструмента дают доступ
// к следующему акту по требованию: заглянуть заранее (чтобы посеять зацепку)
// или перейти, когда цель текущего акта достигнута.

function formatAct(act: StoryAct, index: number): Record<string, unknown> {
  return {
    number: index + 1,
    name: act.name,
    levels: `${act.levelFrom}-${act.levelTo}`,
    goal: act.goal,
    summary: act.summary,
    scenes: act.scenes.map((s) => ({
      name: s.name,
      location: s.location,
      description: s.description,
      encounter: s.encounter,
    })),
    twist: act.twist,
    branches: act.branches.map((b) => `Если игрок ${b.ifPlayer} → ${b.then}`),
    rewards: act.rewards,
  };
}

async function loadArc(campaignId: string) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { storyArc: true, arcCurrentAct: true },
  });
  if (!campaign) return null;
  const arc = parseStoryArc(campaign.storyArc);
  if (!arc) return null;
  return { arc, current: campaign.arcCurrentAct };
}

export const peekNextActTool = tool({
  description:
    "Заглянуть в следующий акт сюжета, не переходя к нему. " +
    "Используй, когда нужно заранее посеять зацепку или намёк, ведущий к продолжению истории. " +
    "Игроку содержимое НЕ раскрывай — это твоя закрытая информация.",
  inputSchema: z.object({}),
  contextSchema: campaignContextSchema,
  execute: async (_args, { context }) => {
    const loaded = await loadArc(context.campaignId);
    if (!loaded) return { error: "У кампании нет сгенерированной арки" };
    const { arc, current } = loaded;
    const nextIndex = current + 1;
    if (nextIndex >= arc.acts.length) {
      return {
        isLast: true,
        message: "Текущий акт — последний.",
        finale: arc.finale,
      };
    }
    return { nextAct: formatAct(arc.acts[nextIndex], nextIndex) };
  },
});

export const advanceActTool = tool({
  description:
    "Перейти к следующему акту. Вызывай ТОЛЬКО когда цель текущего акта реально достигнута. " +
    "Инструмент сам запишет завершение акта в журнал и вернёт детали нового — веди игру по ним.",
  inputSchema: z.object({
    outcome: z.string().describe("Чем закончился текущий акт — одно-два предложения"),
  }),
  contextSchema: campaignContextSchema,
  execute: async ({ outcome }, { context }) => {
    const { campaignId } = context;
    const loaded = await loadArc(campaignId);
    if (!loaded) return { error: "У кампании нет сгенерированной арки" };
    const { arc, current } = loaded;

    await db.gameEvent.create({
      data: {
        campaignId,
        type: "story",
        description: `Акт ${current + 1} завершён: ${outcome}`.slice(0, EVENT_DESC_LIMIT),
        isImportant: true,
      },
    });
    await db.memory.create({
      data: {
        campaignId,
        category: "quest",
        subject: `Акт ${current + 1}: ${arc.acts[current]?.name ?? ""}`,
        content: outcome.slice(0, MEMORY_CONTENT_LIMIT),
        importance: 9,
      },
    });

    const nextIndex = current + 1;
    if (nextIndex >= arc.acts.length) {
      return {
        actCompleted: true,
        currentAct: current + 1,
        message: `Акт ${current + 1} («${arc.acts[current]?.name ?? ""}») успешно завершён героями! Художественно подведи итоги победы отряда, опиши плоды их трудов и вручи награды. Человек-мастер нажмёт кнопку «Сгенерировать следующий акт» в интерфейсе, чтобы запустить генерацию новой главы приключения.`,
      };
    }

    await db.campaign.update({
      where: { id: campaignId },
      data: { arcCurrentAct: nextIndex },
    });

    return {
      advancedTo: nextIndex + 1,
      totalActs: arc.acts.length,
      act: formatAct(arc.acts[nextIndex], nextIndex),
    };
  },
});

export const getRecentEventsTool = tool({
  description:
    "Получить последние события кампании — для контекста текущей сцены. " +
    "Используй когда нужно вспомнить что только что произошло.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(30).default(10),
  }),
  contextSchema: campaignContextSchema,
  execute: async ({ limit }, { context }) => {
    const { campaignId } = context;
    const events = await db.gameEvent.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return {
      count: events.length,
      events: events
        .reverse()
        .map((e) => ({
          id: e.id,
          type: e.type,
          description: e.description,
          location: e.location,
          isImportant: e.isImportant,
          time: e.createdAt.toISOString(),
        })),
    };
  },
});

// ============ ИНСТРУМЕНТЫ ДЛЯ ТАКТИЧЕСКОГО БОЯ ============

export const startCombatTool = tool({
  description:
    "Начать тактический пошаговый бой на интерактивной сетке D&D 5e. " +
    "Вызывай этот инструмент ВСЕГДА, когда по сюжету начинается сражение " +
    "(засада, нападение монстров, драка, дуэль, штурм). " +
    "Инструмент автоматически генерирует тактическую карту с укрытиями и препятствиями, " +
    "выбирает сбалансированных монстров из бестиария (2,875 существ), " +
    "расставляет союзников и врагов, бросает инициативу и рассчитывает честный опыт (DMG p. 82).",
  inputSchema: z.object({
    name: z.string().describe("Название битвы (например: 'Засада гоблинов на тракте', 'Схватка с пауками в пещере')"),
    biome: z.string().optional().describe("Биом местности (forest, dungeon, cave, swamp, lava, mountain, snow, coastal, ship, desert, urban или любой из 24 тактических пресетов)"),
    environment: z.enum([
      "dungeon",
      "cave",
      "tavern",
      "forest",
      "ruins",
      "arena",
      "open_field",
    ]).default("dungeon").describe("Тип окружения для тактической карты (legacy)"),
    difficulty: z.enum(["easy", "medium", "hard", "deadly"]).default("medium").describe("Сложность энкаунтера по DMG p. 82"),
    archetype: z.enum(["solo_boss", "boss_minions", "tactical_squad", "horde", "ambush_duo", "any"]).optional().describe("Тактический архетип отряда врагов"),
    isActClimax: z.boolean().optional().describe("Является ли бой кульминацией акта (боссфайт)"),
    mapPresetId: z.string().optional().describe("ID конкретного тактического пресета карты (опционально)"),
    gridWidth: z.number().int().min(10).max(50).default(20).describe("Ширина сетки"),
    gridHeight: z.number().int().min(10).max(50).default(15).describe("Высота сетки"),
    mapDescription: z.string().optional().describe("Краткое описание поля боя и препятствий"),
    enemies: z.array(
      z.object({
        name: z.string().describe("Имя врага (например: 'Гоблин-лучник', 'Орк-воин', 'Пещерный паук')"),
        hpMax: z.number().int().min(1).describe("Максимальное HP врага"),
        ac: z.number().int().min(5).max(30).describe("Класс доспеха (Armor Class)"),
        speed: z.number().int().min(10).max(60).default(30).describe("Скорость в футах"),
        dexMod: z.number().int().default(0).describe("Модификатор ловкости для инициативы"),
        strMod: z.number().int().default(0),
        conMod: z.number().int().default(0),
        intMod: z.number().int().default(0),
        wisMod: z.number().int().default(0),
        chaMod: z.number().int().default(0),
        size: z.enum(["small", "medium", "large", "huge"]).default("medium"),
        color: z.string().default("#ef4444"),
        attacks: z.array(
          z.object({
            name: z.string().describe("Название атаки (например: 'Скимитар', 'Короткий лук', 'Укус')"),
            kind: z.enum(["melee", "ranged", "spell"]).default("melee"),
            attackBonus: z.number().int().default(3).describe("Бонус к броску атаки (например +4)"),
            damageDice: z.string().describe("Кубик урона, например '1d6+2', '2d6+3', '1d8'"),
            damageType: z.string().default("slashing"),
            rangeNormal: z.number().int().default(5),
            rangeLong: z.number().int().optional(),
          })
        ).min(1).describe("Список атак врага"),
      })
    ).optional().describe("Ручной список врагов (опционально, если не задан — сгенерируется из бестиария по сложности)"),
  }),
  contextSchema: campaignContextSchema,
  execute: async ({ name, biome, environment, difficulty, archetype, isActClimax, mapPresetId, gridWidth, gridHeight, mapDescription, enemies }, { context }) => {
    let campaignId = context?.campaignId;
    if (!campaignId) {
      const active = await db.campaign.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      });
      campaignId = active?.id;
      if (!campaignId) {
        const created = await db.campaign.create({
          data: { name: "Быстрое сражение", isActive: true },
        });
        campaignId = created.id;
      }
    }

    const encounter = await createTacticalEncounter({
      campaignId,
      name,
      environment,
      biome: biome || environment,
      difficulty,
      archetype,
      isActClimax,
      mapPresetId,
      gridWidth,
      gridHeight,
      mapDescription,
      enemies,
    });

    // Записываем событие в историю
    const enemyListStr = encounter.enemyNames.length > 0 ? encounter.enemyNames.join(", ") : "враги";
    await db.gameEvent.create({
      data: {
        campaignId,
        type: "combat",
        description: `⚔️ Начался тактический бой: ${name} (${encounter.environment}). Враги: ${enemyListStr}. Награда за победу: ${encounter.awardedXP} XP (${encounter.xpPerPlayer} на игрока).`,
        isImportant: true,
      },
    });

    return {
      success: true,
      combatId: encounter.combatId,
      name: encounter.name,
      environment: encounter.environment,
      gridSize: `${encounter.gridWidth}x${encounter.gridHeight}`,
      combatantsCount: encounter.combatantsCount,
      enemyNames: encounter.enemyNames,
      awardedXP: encounter.awardedXP,
      xpPerPlayer: encounter.xpPerPlayer,
      message: `Тактический бой '${name}' успешно создан и запущен! Враги: ${enemyListStr}. Награда за победу: ${encounter.awardedXP} XP (${encounter.xpPerPlayer} на игрока). Игроку открыта тактическая сетка боя. Опиши начало сражения и передай ход инициативе.`,
    };
  },
} as any);

export const getCombatStatusTool = tool({
  description:
    "Проверить статус активного боя в кампании (раунд, оставшиеся участники, HP, победители).",
  inputSchema: z.object({}),
  contextSchema: campaignContextSchema,
  execute: async (_, { context }) => {
    let campaignId = context?.campaignId;
    if (!campaignId) {
      const active = await db.campaign.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      });
      campaignId = active?.id;
    }
    if (!campaignId) {
      return { active: false, message: "В данный момент нет активного боя." };
    }
    const combat = await db.combat.findFirst({
      where: { campaignId, status: "active" },
      include: { combatants: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!combat) {
      return { active: false, message: "В данный момент нет активного боя." };
    }
    const aliveAllies = combat.combatants.filter((c) => c.type !== "enemy" && c.hpCurrent > 0);
    const aliveEnemies = combat.combatants.filter((c) => c.type === "enemy" && c.hpCurrent > 0);
    return {
      active: true,
      combatId: combat.id,
      name: combat.name,
      round: combat.round,
      aliveAllies: aliveAllies.map((c) => `${c.name} (HP: ${c.hpCurrent}/${c.hpMax})`),
      aliveEnemies: aliveEnemies.map((c) => `${c.name} (HP: ${c.hpCurrent}/${c.hpMax})`),
      isOver: aliveAllies.length === 0 || aliveEnemies.length === 0,
      outcome: aliveEnemies.length === 0 ? "victory" : aliveAllies.length === 0 ? "defeat" : "ongoing",
    };
  },
} as any);

// ============ ЭКСПОРТ ВСЕХ ИНСТРУМЕНТОВ ============

// Инструменты, которым нужен campaignId — контекст задаётся per-request
// в chat/route.ts через toolsContext.
export function buildToolsContext(campaignId: string) {
  const ctx = { campaignId };
  return {
    list_characters: ctx,
    get_character: ctx,
    update_character: ctx,
    create_character: ctx,
    record: ctx,
    recall_memories: ctx,
    get_recent_events: ctx,
    peek_next_act: ctx,
    advance_act: ctx,
    start_combat: ctx,
    get_combat_status: ctx,
  };
}

export const dmTools = {
  roll_dice: rollDiceTool,
  calculate: calculateTool,
  search_web: searchWebTool,
  fetch_page: fetchPageTool,
  list_characters: listCharactersTool,
  get_character: getCharacterTool,
  update_character: updateCharacterTool,
  create_character: createCharacterTool,
  record: recordTool,
  recall_memories: recallMemoriesTool,
  get_recent_events: getRecentEventsTool,
  peek_next_act: peekNextActTool,
  advance_act: advanceActTool,
  start_combat: startCombatTool,
  get_combat_status: getCombatStatusTool,
};
