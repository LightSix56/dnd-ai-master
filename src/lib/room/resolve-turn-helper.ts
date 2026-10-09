import { generateText, streamText, stepCountIs } from "ai";
import { bundleTurnInputs, type CharacterTurnStatus } from "./turn-batcher";
import { createClient, type AuthMode } from "@/lib/ai/client";
import { BOOKKEEPING_TOOLS, resolveDmModel } from "@/lib/ai/models";
import { db } from "@/lib/db";
import { RoomService, RESOLVE_HEARTBEAT_SECONDS } from "./room-service";
import type { Room, RoomParticipant, RoomTurn, RoomWithParticipants } from "./types";
import { dmTools, buildToolsContext } from "@/lib/ai/tools";
import { getDeterministicTools, buildDmHistory, buildFrozenSystemPrompt } from "@/lib/ai/caching";
import { loadCampaignContext } from "@/lib/ai/campaign-context";
import { compactHistory } from "@/lib/ai/compact";
import { syncSceneState } from "@/lib/ai/scene-synchronizer";
import { calculateCostRub, extractTokenUsage, type TokenUsage } from "@/lib/ai/cost";

export interface RoomTurnStats {
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    totalTokens: number;
  };
  costRub: number;
}

export interface ResolveActiveRoomTurnOptions {
  dmResponse?: string;
  gmWhisperDirective?: string;
  afkCharacters?: Array<{ name: string; className?: string }>;
  partyStatus?: Array<CharacterTurnStatus>;
  apiKey?: string;
  model?: string;
  cheapModel?: string;
  authMode?: string;
  baseURL?: string;
  roomService?: RoomService;
  onChunk?: (delta: string, fullText: string) => void;
  onStatus?: (status: string) => void;
}


export interface ResolveActiveRoomTurnResult {
  completedTurn: RoomTurn;
  nextTurn: RoomTurn;
  dmResponse: string;
  stats?: RoomTurnStats;
}

/**
 * Создаёт строго детерминированный и замороженный системный промпт комнаты (Зона 1).
 * Гарантирует 100% побайтовое совпадение префикса от раунда к раунду:
 * - Все участники сортируются алфавитно по userId/id для стабильного порядка.
 * - Включает только неизменяемый паспорт персонажей (имя, раса, класс, уровень).
 * - Никаких динамических HP, временных состояний, ранений или номеров раундов!
 */
export function buildFrozenRoomSystemPrompt(room: Room | RoomWithParticipants): string {
  const participants: RoomParticipant[] =
    "participants" in room && Array.isArray(room.participants)
      ? [...room.participants].sort((a, b) =>
          (a.userId || a.id || "").localeCompare(b.userId || b.id || "")
        )
      : [];

  const partyList = participants
    .map((p) => {
      const s = (p.character || {}) as any;
      const name = s.name || s.characterName || "Герой";
      const race = s.race || "Раса не указана";
      const className = s.className || s.class || "Класс не указан";
      const level = s.level || room.startingLevel;
      return `- ${name} (${race}, ${className}, ${level} ур.)`;
    })
    .join("\n");

  const arc = room.storyArc as any;
  const act = arc?.act || arc?.acts?.[0];
  const actContext = act
    ? `\n### Сюжетный контекст Акта 1 («${act.name || "Акт 1"}», уровни ${act.levelFrom || room.startingLevel}-${act.levelTo || room.startingLevel + 2}):
- Главная цель отряда: ${act.goal || "Исследовать угрозу"}
- Краткое содержание: ${act.summary || ""}
- Кульминационная цель: ${act.climaxObjective || ""}
${act.personalHooks?.length ? `- Личные сюжетные зацепки героев:\n${act.personalHooks.map((h: any) => `  * ${h.characterName}: ${h.hook}`).join("\n")}` : ""}
${arc?.villains?.length ? `- Антагонисты на сцене:\n${arc.villains.map((v: any) => `  * ${v.name} (${v.role}): ${v.motivation}`).join("\n")}` : ""}`
    : "";

  return `Ты — опытный Dungeon Master (Ведущий) в настольной ролевой игре D&D 5-й редакции.
Ты ведёшь кооперативную кампанию для живого отряда игроков.

## КАМПАНИЯ: «${(room.campaignSettings as any)?.title || room.name}»
- Сеттинг: ${(room.campaignSettings as any)?.setting || "Фэнтези"}
- Тон: ${(room.campaignSettings as any)?.tone || "Героический"}
- Сложность боёв: ${(room.campaignSettings as any)?.difficulty || "normal"}
- Стартовый уровень: ${room.startingLevel} (максимальный уровень кампании: ${room.maxLevel})

## СОСТАВ ОТРЯДА:
${partyList || "- Герои приключения"}
${actContext}

## ЯЗЫКОВЫЕ ПРАВИЛА (СТРОГО):
- ОТВЕЧАЙ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ!
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать китайский язык, иероглифы (например, 主持人, 场外, 战斗, 攻击, 投骰, 回合) или любые другие языки, включая любые внеигровые/OOC ремарки или мета-комментарии.

## ПРАВИЛА И ПОВЕДЕНИЕ ВЕДУЩЕГО (D&D 5e):
1. **СВЯЗНОЕ ПОВЕСТВОВАНИЕ:**
   - Перед тобой одновременные действия всех участников партии в текущем раунде.
   - Сплети их заявки в единую динамичную, кинематографичную сцену (2-4 содержательных абзаца).
   - Опиши последствия каждого действия, реакцию окружающего мира, врагов и NPC.
2. **ТАКТИЧЕСКИЙ БОЙ НА СЕТКЕ (start_combat):**
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вести бой текстом в чате, рисовать таблицы HP/AC врагов и участников, самостоятельно бросать инициативу или имитировать раунды боя в тексте!
   - Когда по сюжету начинается сражение (нападение монстров, засада, драка, дуэль, штурм, боссфайт) или игроки заявляют атаку/бой:
     1. ТЫ ОБЯЗАН НЕЗАМЕДЛИТЕЛЬНО ВЫЗВАТЬ ИНСТРУМЕНТ \`start_combat\`.
     2. Инструмент \`start_combat\` автоматически развернёт тактическую сетку боя, расставит участников и врагов из официального бестиария D&D 5e и рассчитает XP.
     3. После вызова \`start_combat\` кратко опиши завязку столкновения и передай управление интерактивной сетке боя.
3. **ПРАВИЛА ОТДЫХА И ПОВЫШЕНИЯ УРОВНЯ (REST & LEVEL-UP RULES):**
   - **Запрет прокачки в бою:** персонажи категорически НЕ могут повышать уровень, изучать новые заклинания или восстанавливать базовые ячейки/хиты посреди тактической схватки.
   - **Условия повышения уровня:** повышение уровня происходит исключительно во время **продолжительного отдыха (Long Rest / сон не менее 8 часов)** в безопасном укрытии (лагерь с дозором, таверна, святилище) и с подтверждения Ведущего при достижении сюжетной вехи или порога опыта (XP).
   - Если герои завершают важную веху текущего Акта 1 или побеждают босса — отметь возможность отдыха и прокачки при следующем безопасном ночлеге.
4. **ТАЙНОЕ УКАЗАНИЕ ВЕДУЩЕГО (GM WHISPER):**
   - Если передана скрытая директива от Человека-Мастера, органично и скрытно интегрируй её в повествование как естественное событие мира, не упоминая игрокам сам факт шёпота.
5. **ФОРМАТ ЗАВЕРШЕНИЯ РАУНДА:**
   - Закончи описание новой изменившейся обстановкой и кратким вопросом к отряду: «Что вы делаете дальше?».
   - Отвечай на русском языке, образно, атмосферно, в аутентичном средневековом стиле D&D 5e.`;
}

/** Чем ведение отряда в комнате отличается от сольной игры — добавляется к общему промпту мастера */
const COOP_ROUND_RULES = `

# СОВМЕСТНЫЙ РАУНД В СЕТЕВОЙ КОМНАТЕ
- За столом несколько живых игроков. Каждый раунд ты получаешь одним сообщением заявки ВСЕХ героев сразу.
- Сплети заявки в единую динамичную сцену (2-4 содержательных абзаца): покажи последствия действий КАЖДОГО героя, реакцию мира, врагов и NPC. Никого не пропускай и никому не отдавай всю сцену.
- Герои, отмеченные как ожидающие (AFK), держат позицию и прикрывают отряд: не действуй за них сверх этого и не принимай за них решений.
- Если в сообщении раунда есть скрытое указание Ведущего-человека — вплети его в повествование как естественное событие мира и не упоминай сам факт указания.
- Проверки проси поимённо («Торин, сделай проверку Силы»), сложность не называй.
- Заверши раунд изменившейся обстановкой и вопросом к отряду: «Что вы делаете дальше?»`;

/**
 * Системный промпт мастера для комнаты. Если у комнаты есть кампания — это тот же полный
 * промпт, что и в сольной игре (правила, настройки кампании, текущий акт сюжета с его злодеями
 * и переменами мира), плюс правила совместного раунда. Раньше комната собирала собственный
 * укороченный промпт и всегда брала первый акт, даже после генерации следующих.
 */
export async function buildRoomDmSystemPrompt(
  room: Room | RoomWithParticipants,
  campaignId?: string | null
): Promise<string> {
  if (campaignId) {
    try {
      const context = await loadCampaignContext(campaignId);
      if (context) return buildFrozenSystemPrompt(context) + COOP_ROUND_RULES;
    } catch (e) {
      console.warn("[resolveActiveRoomTurnHelper] Не удалось загрузить контекст кампании, беру промпт комнаты:", e);
    }
  }
  return buildFrozenRoomSystemPrompt(room);
}

/** Сколько шагов (ответ + вызовы инструментов) даём мастеру на один раунд */
const ROOM_MAX_STEPS = 4;

/**
 * Предел времени на генерацию раунда. Должен быть меньше maxDuration маршрутов (300 с):
 * тогда функция успевает сама вернуть раунд в ожидание, а не обрывается платформой
 * с раундом, навсегда застрявшим в «мастер думает».
 */
const ROOM_GENERATION_TIMEOUT_MS = 240_000;

/** Как часто рассылать игрокам текст по мере написания */
const BROADCAST_INTERVAL_MS = 700;

type StepLike = { text?: string; toolCalls?: Array<{ toolName: string }> };

/**
 * Условия остановки хода мастера. Каждый шаг заново отправляет весь контекст, поэтому лишние
 * шаги «бухгалтерии» после готового рассказа — это десятки секунд: раунд из трёх-четырёх
 * шагов не укладывался в лимит функции и зависал.
 */
const roomStopWhen = [
  stepCountIs(ROOM_MAX_STEPS),
  ({ steps }: { steps: StepLike[] }) => {
    const last = steps[steps.length - 1];
    const calls = last?.toolCalls ?? [];
    const allBookkeeping =
      calls.length > 0 && calls.every((c) => (BOOKKEEPING_TOOLS as readonly string[]).includes(c.toolName));
    const hasNarrative = steps.some((st) => typeof st?.text === "string" && st.text.trim().length > 0);
    return allBookkeeping && hasNarrative;
  },
];

/** Мастер не смог описать раунд: раунд не завершается, ведущий может повторить генерацию */
export class RoomTurnGenerationError extends Error {}

/**
 * Единая переиспользуемая функция резолвинга активного хода комнаты.
 * Используется как при авто-резолвинге (когда все участники готовы),
 * так и при ручном принудительном завершении раунда Человеком-ДМом.
 */
export async function resolveActiveRoomTurnHelper(
  room: Room | RoomWithParticipants,
  activeTurn: RoomTurn,
  options?: ResolveActiveRoomTurnOptions
): Promise<ResolveActiveRoomTurnResult> {
  const roomService = options?.roomService || new RoomService();

  // Рассылка хода работы мастера всем игрокам комнаты и «пульс» блокировки раунда.
  // Оба необязательны: у подменённого сервиса (тесты) этих методов может не быть.
  const svc = roomService as Partial<Pick<RoomService, "broadcastDmStream" | "touchResolvingLock">>;
  const canBroadcast = typeof svc.broadcastDmStream === "function";
  const broadcast = (payload: Record<string, unknown>): Promise<void> =>
    canBroadcast
      ? roomService.broadcastDmStream(room.id, { ...payload, turnId: activeTurn.id, round: activeTurn.roundNumber })
      : Promise.resolve();
  const heartbeat =
    typeof svc.touchResolvingLock === "function"
      ? setInterval(() => void roomService.touchResolvingLock(activeTurn.id), RESOLVE_HEARTBEAT_SECONDS * 1000)
      : null;
  const stopHeartbeat = () => {
    if (heartbeat) clearInterval(heartbeat);
  };

  const participants: RoomParticipant[] =
    "participants" in room && Array.isArray(room.participants)
      ? room.participants
      : [];

  let afkCharacters = options?.afkCharacters;
  if (!afkCharacters && participants.length > 0) {
    const activeParticipants = participants.filter(
      (p) => Boolean(p.character && ((p.character as any).name || (p.character as any).characterName))
    );
    const submittedUserIds = new Set(Object.keys(activeTurn.playerInputs || {}));
    const pending = activeParticipants.filter((p) => !submittedUserIds.has(p.userId));
    if (pending.length > 0) {
      afkCharacters = pending.map((p) => {
        const snap = p.character as any;
        return {
          name: snap?.name || snap?.characterName || "Герой",
          className: snap?.className || snap?.class,
        };
      });
    }
  }

  // Динамический срез состояния отряда (HP, временные статусы) из snapshot'ов участников
  let partyStatus = options?.partyStatus;
  if (!partyStatus && participants.length > 0) {
    const extracted: CharacterTurnStatus[] = [];
    for (const p of participants) {
      if (p.character) {
        const snap = p.character as any;
        const hpCurrent = snap.hpCurrent ?? snap.currentHp ?? snap.hp;
        const hpMax = snap.hpMax ?? snap.maxHp;
        const hpTemp = snap.hpTemp ?? snap.tempHp;
        const condition = snap.condition ?? snap.status ?? snap.conditions;
        const ac = snap.ac ?? snap.armorClass;

        if (hpCurrent !== undefined || hpMax !== undefined || condition || ac !== undefined) {
          extracted.push({
            name: snap.name || snap.characterName || "Герой",
            hpCurrent: typeof hpCurrent === "number" ? hpCurrent : undefined,
            hpMax: typeof hpMax === "number" ? hpMax : undefined,
            hpTemp: typeof hpTemp === "number" ? hpTemp : undefined,
            condition: typeof condition === "string" ? condition : undefined,
            ac: typeof ac === "number" ? ac : undefined,
          });
        }
      }
    }
    if (extracted.length > 0) {
      partyStatus = extracted;
    }
  }

  const prompt = bundleTurnInputs(activeTurn.playerInputs || {}, {
    roundNumber: activeTurn.roundNumber,
    gmWhisperDirective: options?.gmWhisperDirective,
    afkCharacters,
    partyStatus,
  });

  let campaignId =
    room.campaignId ||
    (room.campaignSettings as any)?.campaignId ||
    (room as any)?.campaign_settings?.campaignId;
  // Комната без привязанной кампании играет без истории и без записей в БД. Раньше в этом случае
  // бралась «любая активная кампания» из базы — то есть, возможно, кампания другого пользователя.

  let narrative = typeof options?.dmResponse === "string" ? options.dmResponse.trim() : "";
  let capturedSteps: any[] = [];
  let statsPayload: RoomTurnStats | undefined = undefined;

  if (!narrative) {
    const cleanKey = (options?.apiKey || process.env.AI_API_KEY || "").trim();

    if (cleanKey) {
      try {
        const client = createClient(cleanKey, options?.authMode as AuthMode, options?.baseURL);
        const aiModel = resolveDmModel(options?.model);

        const system = await buildRoomDmSystemPrompt(room, campaignId);

        // Память мастера в комнате: хроника кампании + последние ходы дословно.
        // Раньше в запрос шёл только системный промпт и ввод текущего раунда — мастер не помнил,
        // что было ход назад. История только дописывается в конец, поэтому читается из кэша.
        const history = campaignId ? await buildDmHistory(campaignId) : null;
        const turnInput =
          history && history.messages.length > 0
            ? { messages: [...history.messages, { role: "user" as const, content: prompt }] }
            : { prompt };

        const availableTools = campaignId
          ? getDeterministicTools(dmTools)
          : getDeterministicTools({
              roll_dice: dmTools.roll_dice,
              calculate: dmTools.calculate,
              search_web: dmTools.search_web,
              fetch_page: dmTools.fetch_page,
              start_combat: dmTools.start_combat,
              get_combat_status: dmTools.get_combat_status,
            });

        if (typeof options?.onChunk === "function" || canBroadcast) {
          let streamError: unknown = null;
          const status = "🎲 Мастер оценивает действия отряда...";
          options?.onStatus?.(status);
          void broadcast({ type: "status", status });

          const res = await (streamText as any)({
            model: client.chat(aiModel),
            system,
            ...turnInput,
            tools: availableTools,
            ...(campaignId ? { toolsContext: buildToolsContext(campaignId) } : {}),
            stopWhen: roomStopWhen,
            temperature: 0.7,
            abortSignal: AbortSignal.timeout(ROOM_GENERATION_TIMEOUT_MS),
            // Ошибку потока SDK не бросает, а отдаёт сюда: без этого сбой провайдера
            // выглядел как «пустой ответ» и раунд закрывался заглушкой
            onError: (event: { error: unknown }) => {
              streamError = event.error;
            },
          });

          let fullStreamText = "";
          let lastBroadcastAt = 0;
          for await (const chunk of res.textStream) {
            fullStreamText += chunk;
            options?.onChunk?.(chunk, fullStreamText);
            const now = Date.now();
            if (now - lastBroadcastAt >= BROADCAST_INTERVAL_MS) {
              lastBroadcastAt = now;
              void broadcast({ type: "chunk", text: fullStreamText });
            }
          }
          if (streamError && !fullStreamText.trim()) {
            throw streamError instanceof Error ? streamError : new Error(String(streamError));
          }

          const rawSteps = await res.steps;
          capturedSteps = Array.isArray(rawSteps) ? rawSteps : [];

          const rawUsage = await res.usage;
          const tokenUsage = extractTokenUsage(rawUsage);
          const costRub = calculateCostRub(aiModel, tokenUsage);

          statsPayload = {
            model: aiModel,
            usage: tokenUsage,
            costRub,
          };

          narrative = fullStreamText.trim();
          if (!narrative) {
            const stepTexts = capturedSteps
              .map((s: any) => (typeof s.text === "string" ? s.text.trim() : ""))
              .filter(Boolean);
            narrative = stepTexts.join("\n\n");
          }
        } else {
          const res = await (generateText as any)({
            model: client.chat(aiModel),
            system,
            ...turnInput,
            tools: availableTools,
            ...(campaignId ? { toolsContext: buildToolsContext(campaignId) } : {}),
            stopWhen: roomStopWhen,
            temperature: 0.7,
            abortSignal: AbortSignal.timeout(ROOM_GENERATION_TIMEOUT_MS),
          });

          const rawSteps = await res.steps;
          capturedSteps = Array.isArray(rawSteps) ? rawSteps : [];

          // Извлекаем расход токенов и рассчитываем стоимость
          const rawUsage = res.usage || (res as any).totalUsage;
          const tokenUsage = extractTokenUsage(rawUsage);
          const costRub = calculateCostRub(aiModel, tokenUsage);

          statsPayload = {
            model: aiModel,
            usage: tokenUsage,
            costRub,
          };

          // Извлекаем текст из всех шагов модели (включая шаги после вызова инструментов)
          const stepTexts = capturedSteps
            .map((s: any) => (typeof s.text === "string" ? s.text.trim() : ""))
            .filter(Boolean);

          narrative = stepTexts.join("\n\n") || (typeof res.text === "string" ? res.text.trim() : "");
        }

        if (!narrative) {
          const hadCombat = capturedSteps.some((s: any) =>
            s.toolCalls?.some((tc: any) => tc.toolName === "start_combat")
          );
          if (hadCombat) {
            narrative = "⚔️ Внимание, к оружию! Враги окружают отряд, воздух наполняется боевыми кличами — переходим к тактической сетке боя!";
          } else {
            narrative = "Действия отряда вызывают немедленный отклик окружающего мира. Обстановка стремительно меняется — герои заявляют о себе, и мир вокруг реагирует на их вызов. Что вы делаете дальше?";
          }
          if (options?.onChunk) {
            options.onChunk(narrative, narrative);
          }
        }

      } catch (aiErr: any) {
        // Раунд НЕ завершаем: раньше сюда подставлялась заглушка, раунд закрывался, и заявки
        // игроков пропадали — «повторить генерацию» было уже не с чем.
        console.error("[resolveActiveRoomTurnHelper] AI call failed:", aiErr);
        stopHeartbeat();
        void broadcast({ type: "error", error: aiErr?.message || "Мастер не ответил" });
        throw new RoomTurnGenerationError(
          `Мастер не смог описать раунд ${activeTurn.roundNumber}: ${aiErr?.message || "таймаут сервиса"}. Заявки игроков сохранены — ведущий может повторить генерацию.`
        );
      }
    } else {
      stopHeartbeat();
      throw new RoomTurnGenerationError(
        `Не задан API-ключ ИИ для описания раунда ${activeTurn.roundNumber}. Заявки игроков сохранены — укажите ключ в настройках и завершите раунд ещё раз.`
      );
    }
  }

  stopHeartbeat();
  let result: Awaited<ReturnType<RoomService["resolveRoomTurn"]>>;
  try {
    result = await roomService.resolveRoomTurn(room.id, narrative, activeTurn.id);
  } catch (completeErr) {
    void broadcast({ type: "error", error: (completeErr as Error)?.message || "Не удалось завершить раунд" });
    throw completeErr;
  }

  // Раунд уже закрыл другой запрос (перехват зависшей блокировки): его ответ и остаётся
  // в истории, свой не дублируем.
  if (result.alreadyCompleted) {
    return {
      completedTurn: result.completedTurn,
      nextTurn: result.nextTurn,
      dmResponse: result.completedTurn.dmResponse || narrative,
      stats: statsPayload,
    };
  }

  await broadcast({
    type: "finish",
    fullText: narrative,
    stats: statsPayload,
    nextTurn: result.nextTurn,
  });

  if (campaignId) {
    try {
      const allToolCalls = capturedSteps.flatMap((s: any) => s.toolCalls || []);
      const allToolResults = capturedSteps.flatMap((s: any) => s.toolResults || []);

      let serializedResults: string | null = null;
      try {
        serializedResults = JSON.stringify({
          calls: allToolCalls || [],
          results: allToolResults || [],
          ...(statsPayload ? { _stats: statsPayload } : {}),
        });
      } catch {
        serializedResults = allToolResults.length > 0 ? JSON.stringify(allToolResults) : null;
      }

      await db.chatMessage.create({
        data: {
          campaignId,
          role: "user",
          content: prompt,
          turn: activeTurn.roundNumber,
        },
      });
      await db.chatMessage.create({
        data: {
          campaignId,
          role: "assistant",
          content: narrative,
          turn: activeTurn.roundNumber,
          toolCalls: allToolCalls.length > 0 ? JSON.stringify(allToolCalls) : null,
          toolResults: serializedResults,
        },
      });
    } catch (dbErr) {
      console.warn("[resolveActiveRoomTurnHelper] Failed to save chat messages in SQLite:", dbErr);
    }

    // Хроника кампании дополняется в фоне, когда за пределами дословного окна накопился блок
    const compactKey = (options?.apiKey || process.env.AI_API_KEY || "").trim();
    if (compactKey && !narrative.trimStart().startsWith("⚠️")) {
      const playerTurnText = Object.values(activeTurn.playerInputs || {})
        .map((p) => `${p.characterName}: ${p.actionText}`)
        .join("\n");
      const runCompaction = async () => {
        // Служебная модель обновляет состояние сцены и NPC по итогам хода (как в соло-чате)
        await syncSceneState({
          campaignId,
          playerMessage: playerTurnText,
          assistantResponse: narrative,
          apiKey: compactKey,
          authMode: (options?.authMode as AuthMode) || "bearer",
          baseURL: options?.baseURL,
          cheapModel: options?.cheapModel,
        }).catch((e) => console.error("[resolveActiveRoomTurnHelper] scene sync failed:", e));
        await compactHistory({
          campaignId,
          apiKey: compactKey,
          authMode: options?.authMode as AuthMode,
          model: options?.model,
          baseURL: options?.baseURL,
        }).catch((e) => console.error("[resolveActiveRoomTurnHelper] compaction failed:", e));
      };
      try {
        // На Vercel фоновая работа должна быть зарегистрирована через after(), иначе функция
        // завершится раньше неё. Вне запроса (тесты, скрипты) after() бросает — тогда выполняем сразу.
        const { after } = await import("next/server");
        after(runCompaction);
      } catch {
        await runCompaction();
      }
    }
  }

  return {
    completedTurn: result.completedTurn,
    nextTurn: result.nextTurn,
    dmResponse: narrative,
    stats: statsPayload,
  };
}

