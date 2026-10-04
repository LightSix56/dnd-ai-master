import { generateText } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { createClient, type AuthMode } from "./client";
import { resolveCheapModel } from "./models";
import { extractTokenUsage } from "./cost";

// ─── Разбор и извлечение JSON ───

export function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export function extractStatusFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/\[(?:Статус|Состояние):\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
}

export function applyStatusToNotes(oldNotes: string | null | undefined, newStatus: string): string {
  const statusTag = `[Статус: ${newStatus.trim()}]`;
  if (!oldNotes || !oldNotes.trim()) {
    return statusTag;
  }
  const clean = oldNotes.replace(/\[(?:Статус|Состояние):\s*[^\]]+\]/gi, "").trim();
  return clean ? `${statusTag}\n${clean}` : statusTag;
}

export const newNpcSchema = z.object({
  name: z.string(),
  type: z.enum(["npc", "enemy", "companion"]).default("npc"),
  location: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  race: z.string().nullable().optional(),
  class: z.string().nullable().optional(),
});

export const sceneUpdateSchema = z.object({
  currentLocation: z.string().nullable().optional(),
  updates: z
    .array(
      z.object({
        id: z.string(),
        inScene: z.boolean(),
        status: z.string().nullable().optional(),
        characterInsight: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        hpDelta: z.number().optional().default(0),
        relationDelta: z.number().optional().default(0),
      })
    )
    .default([]),
  newNpc: z
    .union([newNpcSchema, z.array(newNpcSchema)])
    .nullable()
    .optional(),
  newNpcs: z.array(newNpcSchema).optional().default([]),
  characterMemory: z
    .object({
      characterName: z.string(),
      insight: z.string(),
      importance: z.number().default(8),
    })
    .nullable()
    .optional(),
});

export type SceneUpdate = z.infer<typeof sceneUpdateSchema>;

export interface SyncSceneStateParams {
  campaignId: string;
  playerMessage: string;
  assistantResponse: string;
  apiKey?: string;
  authMode?: AuthMode;
  baseURL?: string;
  cheapModel?: string;
}

/** Ответ короче этого порога — обычно просьба сделать бросок или уточнение: сцена не изменилась */
export const SYNC_MIN_RESPONSE_CHARS = 140;

/** Сколько персонажей кампании максимум отдаём летописцу за один ход */
const SYNC_MAX_CHARACTERS = 25;

interface SyncCandidate {
  name: string;
  type: string;
  inScene: boolean;
}

/**
 * Кого показывать летописцу. Раньше в запрос шли ВСЕ персонажи кампании, и на каждого
 * модель обязана была вернуть запись — на длинной кампании это десятки записей за ход,
 * из которых менялись две-три. Теперь идут только герои, те, кто в сцене, и те, чьё имя
 * прозвучало в этом ходе.
 */
export function selectCharactersForSync<T extends SyncCandidate>(
  characters: T[],
  playerMessage: string,
  assistantResponse: string
): T[] {
  const text = `${playerMessage}\n${assistantResponse}`.toLowerCase();
  const mentioned = (name: string) => {
    const full = name.trim().toLowerCase();
    if (full.length >= 3 && text.includes(full)) return true;
    // Имена склоняются («Гуннара», «Гуннару») — сверяем по основе первого слова
    const first = full.split(/\s+/)[0] ?? "";
    const stem = first.length > 5 ? first.slice(0, first.length - 2) : first;
    return stem.length >= 4 && text.includes(stem);
  };
  const picked = characters.filter((c) => c.type === "player" || c.inScene || mentioned(c.name));
  if (picked.length <= SYNC_MAX_CHARACTERS) return picked;
  // Переполнение: герои и упомянутые важнее просто присутствующих
  const rank = (c: T) => (c.type === "player" ? 0 : mentioned(c.name) ? 1 : 2);
  return [...picked].sort((a, b) => rank(a) - rank(b)).slice(0, SYNC_MAX_CHARACTERS);
}

export async function syncSceneState({
  campaignId,
  playerMessage,
  assistantResponse,
  apiKey,
  authMode = "bearer",
  baseURL,
  cheapModel,
}: SyncSceneStateParams): Promise<SceneUpdate | null> {
  if (!campaignId || !assistantResponse.trim()) return null;

  // Короткий ответ мастера («Сделай проверку Ловкости») сцену не меняет — вызов модели не нужен
  if (assistantResponse.trim().length < SYNC_MIN_RESPONSE_CHARS) return null;

  const allCharacters = await db.character.findMany({
    where: { campaignId },
    select: {
      id: true,
      name: true,
      type: true,
      location: true,
      inScene: true,
      hpCurrent: true,
      hpMax: true,
      notes: true,
      isAlive: true,
      relation: true,
    },
  });

  if (allCharacters.length === 0) return null;

  const characters = selectCharactersForSync(allCharacters, playerMessage, assistantResponse);

  // Пока идёт тактический бой, хиты ведёт боевой движок: догадки летописца их не трогают
  let combatActive = false;
  try {
    combatActive = !!(await db.combat.findFirst({
      where: { campaignId, status: "active" },
      select: { id: true },
    }));
  } catch {
    combatActive = false;
  }

  const charSummary = characters
    .map((c) => {
      const status = extractStatusFromNotes(c.notes);
      return `- ID: "${c.id}", Имя: "${c.name}", Тип: ${c.type}, Локация: "${c.location || "не указана"}", В сцене: ${c.inScene}, Отношение: ${c.relation ?? 0}, HP: ${c.hpCurrent}/${c.hpMax}${status ? `, Статус: "${status}"` : ""}`;
    })
    .join("\n");

  const prompt = `Ты — системный синхронизатор состояния сцены (Scene State Tracker) для D&D 5e.
Проанализируй последний ход между игроком и Мастером и определи, как изменилось окружение и состояние персонажей.

## Действие игрока:
${playerMessage}

## Ответ Мастера:
${assistantResponse}

## Персонажи, которых мог затронуть этот ход:
${charSummary}

Инструкции:
1. "currentLocation": определи, где СЕЙЧАС физически находится игрок (например: "Подвалы Док-Уорда", "Кухня таверны").
2. В массив "updates" включай ТОЛЬКО тех персонажей из списка, у кого в этом ходе что-то изменилось (появился или покинул сцену, сменил локацию или состояние, получил урон или лечение, изменилось отношение, раскрылась новая черта). Тех, у кого ничего не изменилось, НЕ включай. Если не изменилось ни у кого — верни пустой массив []. Для каждого изменившегося:
   - "id": точный ID персонажа из списка выше.
   - "inScene": true, если персонаж сейчас находится в той же локации/комнате в зоне прямой видимости или прямого контакта/взаимодействия с игроком. false, если персонаж остался в другой комнате/локации, сбежал, скрылся или остался позади. (ВНИМАНИЕ: для игрока всегда true!).
   - "status": краткое конкретное описание актуального физического/сюжетного состояния персонажа (например: "без сознания на полу, сжимает пергамент", "заперся за дверью, хором шепчет заклинание", "замер в оцепенении").
   - "characterInsight": если персонаж (особенно герой или соратник) в этом ходе проявил новую характерную черту, привычку, раскрыл секрет или изменил отношение/узы, кратко сформулируй её (например: "боится магии огня", "поклялся защитить трактирщицу"). Иначе null.
   - "location": актуальная локация (например: "Подвалы Док-Уорда", "За железной дверью подвала", "Зал таверны").
   - "hpDelta": 0 (или отрицательное/положительное число, если в этом ходе персонаж получил урон или лечение).
   - "relationDelta": число от -25 до +25 (+5..+20 если игрок помог, проявил сочувствие/откровенность или защитил персонажа; -5..-20 если угрожал, хамил, напал или обманул; 0 если отношение не изменилось).
3. "newNpcs": список новых сюжетных персонажей (соратников/спутников игрока, именных NPC или сюжетных противников), появившихся в тексте. Фоновый шум и безымянных прохожих ("толпа", "курица", "гости", "прохожие") ИГНОРИРОВАТЬ!
   Если появились соратники или NPC — добавь их в массив:
   [
     {
       "name": "Имя персонажа",
       "type": "companion" (для спутников/соратников игрока) | "npc" (для нейтральных/мирных) | "enemy" (для врагов),
       "race": "раса если известна",
       "class": "класс если известен",
       "location": "локация",
       "status": "актуальное состояние/действие"
     }
   ]
   Если новых персонажей нет — передай пустой массив [].
4. "characterMemory": если в ходе хода выяснилась важная новая деталь о герое (его тайна, прошлое, клятва, важное личное решение), верни объект: { "characterName": "имя персонажа", "insight": "краткая суть факта", "importance": 8 }. Если ничего принципиально нового не раскрыто — null.

Верни СТРОГО JSON следующей структуры (ключи строго на английском):
{
  "currentLocation": "название локации",
  "updates": [
    {
      "id": "id",
      "inScene": true,
      "status": "актуальный статус",
      "characterInsight": null,
      "location": "локация",
      "hpDelta": 0,
      "relationDelta": 0
    }
  ],
  "newNpcs": [],
  "characterMemory": null
}`;

  try {
    const client = createClient(apiKey, authMode, baseURL);
    const modelToUse = cheapModel ? resolveCheapModel(cheapModel) : "google/gemini-2.5-flash-lite";

    const result = await generateText({
      model: client.chat(modelToUse),
      system: "Ты — бесстрастный системный наблюдатель D&D 5e. Отвечай ТОЛЬКО валидным JSON без маркдаун-оберток и пояснений.",
      prompt,
      temperature: 0.1,
      maxRetries: 1,
    });

    const parsedJson = JSON.parse(extractJson(result.text));
    const validated = sceneUpdateSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.warn("[SceneSync] Ошибка валидации JSON:", validated.error);
      return null;
    }

    const { updates, newNpc, newNpcs, currentLocation, characterMemory } = validated.data;

    // Применяем обновления персонажей в БД
    for (const u of updates) {
      const char = characters.find((c) => c.id === u.id);
      if (!char) continue;

      const isPlayer = char.type === "player";
      const updateData: Record<string, unknown> = {};

      // Для игрока inScene всегда true
      if (!isPlayer) {
        updateData.inScene = u.inScene;
      } else {
        updateData.inScene = true;
      }

      if (u.location) {
        updateData.location = u.location;
      } else if (currentLocation && isPlayer) {
        updateData.location = currentLocation;
      }

      if (u.status) {
        updateData.notes = applyStatusToNotes(char.notes, u.status);
      }

      if (u.characterInsight) {
        const existingNotes = (updateData.notes as string) || char.notes || "";
        if (!existingNotes.includes(u.characterInsight)) {
          updateData.notes = existingNotes ? `${existingNotes}\n• ${u.characterInsight}` : `• ${u.characterInsight}`;
        }
      }

      if (u.hpDelta && u.hpDelta !== 0 && !combatActive) {
        updateData.hpCurrent = Math.max(0, Math.min(char.hpMax, char.hpCurrent + u.hpDelta));
      }

      if (typeof u.relationDelta === "number" && u.relationDelta !== 0 && !isPlayer) {
        const cur = char.relation ?? 0;
        updateData.relation = Math.max(-100, Math.min(100, cur + u.relationDelta));
      }

      if (Object.keys(updateData).length > 0) {
        await db.character.update({
          where: { id: char.id },
          data: updateData,
        });
      }
    }

    // Сохраняем сюжетный факт о герое в общую память кампании
    if (characterMemory && characterMemory.characterName && characterMemory.insight) {
      // Один и тот же факт модель любит «открывать» повторно — дубли в память не пишем
      const insightKey = characterMemory.insight.trim().toLowerCase();
      let duplicate = false;
      try {
        const existing = await db.memory.findMany({
          where: { campaignId, subject: characterMemory.characterName },
          select: { content: true },
          take: 50,
        });
        duplicate = (existing ?? []).some((m) => {
          const c = (m.content || "").trim().toLowerCase();
          return !!c && (c === insightKey || c.includes(insightKey) || insightKey.includes(c));
        });
      } catch {
        duplicate = false;
      }
      if (!duplicate) await db.memory.create({
        data: {
          campaignId,
          category: "character",
          subject: characterMemory.characterName,
          content: characterMemory.insight,
          importance: characterMemory.importance || 8,
        },
      });
    }

    // Собираем всех новых NPC/спутников (поддерживаем массив newNpcs, а также массив или одиночный объект newNpc)
    const npcsToCreate: Array<z.infer<typeof newNpcSchema>> = [];
    if (Array.isArray(newNpc)) {
      npcsToCreate.push(...newNpc);
    } else if (newNpc && typeof newNpc === "object" && (newNpc as any).name) {
      npcsToCreate.push(newNpc as any);
    }
    if (Array.isArray(newNpcs)) {
      npcsToCreate.push(...newNpcs);
    }

    for (const npc of npcsToCreate) {
      if (!npc.name) continue;
      const alreadyExists = allCharacters.some(
        (c) => c.name.toLowerCase() === npc.name.toLowerCase()
      );
      if (!alreadyExists) {
        const isCompanion = npc.type === "companion";
        const isEnemy = npc.type === "enemy";
        const defaultHp = isCompanion ? 12 : isEnemy ? 11 : 10;
        const defaultAc = isCompanion ? 14 : isEnemy ? 12 : 10;

        const created = await db.character.create({
          data: {
            campaignId,
            name: npc.name,
            type: npc.type || "npc",
            race: npc.race || null,
            class: npc.class || null,
            hpCurrent: defaultHp,
            hpMax: defaultHp,
            ac: defaultAc,
            speed: 30,
            profBonus: 2,
            location: npc.location || currentLocation || null,
            inScene: true,
            notes: npc.status ? `[Статус: ${npc.status}]` : null,
          },
        });
        allCharacters.push({
          id: created.id,
          name: created.name,
          type: created.type,
          location: created.location,
          inScene: created.inScene,
          hpCurrent: created.hpCurrent,
          hpMax: created.hpMax,
          notes: created.notes,
          isAlive: created.isAlive,
          relation: created.relation,
        });
        console.log(`[SceneSync] Создан новый персонаж: "${npc.name}" (${npc.type})`);
      }
    }

    const syncUsage = extractTokenUsage(result.usage);
    console.log(
      `[SceneSync] Показано персонажей: ${characters.length} из ${allCharacters.length}, изменено: ${updates.length}. Локация: ${currentLocation || "—"}. Токенов: вход ${syncUsage.inputTokens} / выход ${syncUsage.outputTokens}`
    );
    return validated.data;
  } catch (error) {
    console.error("[SceneSync] Ошибка при синхронизации сцены:", error);
    return null;
  }
}
