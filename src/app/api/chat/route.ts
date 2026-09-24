// API route для чата с AI DM
// Использует OpenAI-compatible API через Vercel AI SDK
// Streaming + tools (function calling)
//
// Экономия токенов держится на четырёх вещах:
//  1. Контекст сцены собирается с бюджетом символов (scene-context.ts), а не льётся целиком.
//  2. История обрезается скользящим окном, старое живёт в сводке (compact.ts).
//  3. Батчевые инструменты — меньше шагов, а каждый шаг переотправляет весь промпт.
//  4. prepareStep уводит служебные шаги на дешёвую модель, рассказ оставляя дорогой.

import { after } from "next/server";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  type UIMessage,
  type ModelMessage,
  type SystemModelMessage,
} from "ai";
import { dmTools, buildToolsContext } from "@/lib/ai/tools";
import type { CampaignContext, PlayerSummary } from "@/lib/ai/system-prompt";
import { createClient } from "@/lib/ai/client";

export function cleanAssistantNarrative(rawText: string): string {
  if (!rawText) return rawText;
  return rawText
    .replace(/\s*(?:Вступительная сцена развёрнута|Жду твоего решения,? мастер|Ключевые NPC созданы|Служебный отчёт|Техническая операция завершена)[\s\S]*$/i, "")
    .trim();
}
import { parseStoryArc } from "@/lib/ai/story-arc";
import { compactHistory } from "@/lib/ai/compact";
import { syncSceneState } from "@/lib/ai/scene-synchronizer";
import { BOOKKEEPING_TOOLS, resolveCheapModel, resolveDmModel } from "@/lib/ai/models";
import { calculateCostRub } from "@/lib/ai/cost";
import { db } from "@/lib/db";
import {
  buildFrozenSystemPrompt,
  getDeterministicTools,
  compactHistoryWithMilestones,
  fetchEphemeralSceneTail,
  injectEphemeralTailToLastUserMessage,
} from "@/lib/ai/caching";

export const maxDuration = 60;

// Шагов теперь нужно меньше: броски, обновления и записи батчатся.
const MAX_STEPS = 6;

export async function POST(req: Request) {
  try {
    const {
      messages,
      campaignId,
      model,
      cheapModel,
      apiKey: userApiKey,
      authMode,
      baseURL,
    }: {
      messages: UIMessage[];
      campaignId?: string;
      model?: string;
      cheapModel?: string;
      apiKey?: string;
      authMode?: "bearer" | "x-api-key" | "raw";
      baseURL?: string;
    } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "messages is required" }, { status: 400 });
    }

    // Проверка API-ключа до запроса к LLM
    const cleanKey = (userApiKey || process.env.AI_API_KEY || "").trim();
    if (!cleanKey) {
      return Response.json({
        error: "API ключ не указан. Откройте настройки и введите ключ с https://polza.ai",
      }, { status: 401 });
    }

    // Конвертируем UIMessage[] (с parts) → ModelMessage[] (со string content)
    // Это нужно потому что useChat в AI SDK 7.x отправляет сообщения в формате parts
    const allModelMessages = await convertToModelMessages(messages);

    // Зона 2: Дискретное сжатие вехами (Append-Only Milestone Compactor)
    // Предотвращает постоянный сдвиг токенов и сброс KV-кэша префикса
    const compactedMessages = compactHistoryWithMilestones(allModelMessages);

    // Извлекаем последнее действие/реплику игрока для контекста синхронизатора сцены
    const lastUserMsg = [...allModelMessages].reverse().find((m) => m.role === "user");
    const playerMessageText =
      typeof lastUserMsg?.content === "string"
        ? lastUserMsg.content
        : Array.isArray(lastUserMsg?.content)
        ? (lastUserMsg.content as Array<{ text?: string }>).map((p) => p.text || "").join(" ")
        : "";

    // Определяем активную кампанию
    let activeCampaignId = campaignId;
    if (!activeCampaignId) {
      const active = await db.campaign.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      });
      activeCampaignId = active?.id;
    }

    // Зона 3: Ephemeral Tail — волатильный срез сцены (HP, NPC, недавние события)
    // Инжектируется строго в хвост последнего сообщения пользователя, сохраняя
    // 100% Cache Hit префикса (Зона 1) и предшествующей истории (Зона 2).
    let modelMessages: ModelMessage[] = compactedMessages;
    if (activeCampaignId) {
      const ephemeralTail = await fetchEphemeralSceneTail(activeCampaignId);
      if (ephemeralTail) {
        modelMessages = injectEphemeralTailToLastUserMessage(compactedMessages, ephemeralTail);
      }
    }

    let campaignContext: CampaignContext | undefined;

    if (activeCampaignId) {
      const campaign = await db.campaign.findUnique({
        where: { id: activeCampaignId },
      });
      if (campaign) {
        const players = await db.character.findMany({
          where: { campaignId: activeCampaignId, type: "player" },
          orderBy: { name: "asc" },
        });

        const partySummaries: PlayerSummary[] = players.map((p) => ({
          id: p.id,
          name: p.name,
          race: p.race,
          class: p.class,
          level: p.level,
          background: p.background,
          personality: p.personality,
          bonds: p.bonds,
          flaws: p.flaws,
          appearance: p.appearance,
          notes: p.notes,
        }));

        campaignContext = {
          name: campaign.name,
          setting: campaign.setting,
          tone: campaign.tone,
          difficulty: campaign.difficulty,
          language: campaign.language,
          dmStyle: campaign.dmStyle,
          ruleStrictness: campaign.ruleStrictness,
          startingLevel: campaign.startingLevel,
          worldDescription: campaign.worldDescription,
          customDmNotes: campaign.customDmNotes,
          pvpEnabled: campaign.pvpEnabled,
          restFrequency: campaign.restFrequency,
          partyTies: campaign.partyTies,
          partyMembers: partySummaries,
          levelFrom: campaign.levelFrom,
          levelTo: campaign.levelTo,
          storyArc: parseStoryArc(campaign.storyArc),
          currentAct: campaign.arcCurrentAct,
          playerCharacter: players[0]
            ? `${players[0].name}, ${players[0].race || "?"} ${players[0].class || "?"} ${players[0].level} ур.`
            : undefined,
        };
      }
    }

    const selectedModel = resolveDmModel(model);
    const openai = createClient(userApiKey, authMode, baseURL);
    // Используем chat.completions API (классический OpenAI формат) — он поддерживается
    // всеми OpenAI-compatible провайдерами (включая polza.ai)
    const modelInstance = openai.chat(selectedModel);

    // Дешёвая модель для служебных шагов. У claudehub.fun opus-4.7 дешевле haiku.
    const cheapModelName = resolveCheapModel(cheapModel);
    const cheapModelInstance = openai.chat(cheapModelName);

    // Зона 1: Замороженный системный промпт (Frozen Prefix)
    // Содержит лор, правила и паспорта персонажей без волатильных HP и статусов
    const frozenSystemPrompt = buildFrozenSystemPrompt(campaignContext);

    // Короткая инструкция для служебных шагов: на них не нужен ни лор, ни арка,
    // ни правила отыгрыша — только корректно закрыть вызов инструмента.
    const bookkeeperInstructions: SystemModelMessage[] = [
      {
        role: "system",
        content: `TECHNICAL BOOKKEEPER ONLY. Do not write any narrative, story, or conversational text. Do not address the master or player. Do not output status reports. If you must respond, output an empty response.`,
      },
    ];

    // Сохраняем последнюю ошибку из streamText, чтобы передать её в onError UI-стрима
    let lastStreamError: unknown = null;

    // Без активной кампании инструменты, работающие с БД, не имеют контекста
    // (contextSchema не пройдёт валидацию) — отдаём только независимые от campaignId.
    // Сортируем ключи инструментов детерминированно для сохранения KV-кэша
    const baseTools = getDeterministicTools({
      roll_dice: dmTools.roll_dice,
      calculate: dmTools.calculate,
      search_web: dmTools.search_web,
      fetch_page: dmTools.fetch_page,
      start_combat: dmTools.start_combat,
      get_combat_status: dmTools.get_combat_status,
    });

    const commonOptions = {
      model: modelInstance,
      instructions: [
        { role: "system", content: frozenSystemPrompt } as SystemModelMessage,
      ],
      messages: modelMessages,
      stopWhen: [
        stepCountIs(MAX_STEPS),
        ({ steps }: { steps: Array<{ toolCalls?: Array<{ toolName: string }> }> }) => {
          const lastStep = steps[steps.length - 1];
          const lastCalls = lastStep?.toolCalls ?? [];
          return (
            lastCalls.length > 0 &&
            lastCalls.every((c) =>
              (BOOKKEEPING_TOOLS as readonly string[]).includes(c.toolName)
            )
          );
        },
      ],
      temperature: 0.8,
      // Разделение моделей по ролям. Ход всегда начинается на дорогой модели —
      // она ведёт рассказ и решает, что делать. Но как только она ушла в чистую
      // бухгалтерию (record / update_character / create_character), дальше говорить
      // игроку уже нечего: остаток шага дожимает дешёвая модель с коротким промптом.
      prepareStep: ({ steps }: { steps: Array<{ toolCalls?: Array<{ toolName: string }> }> }) => {
        const lastStep = steps[steps.length - 1];
        const lastCalls = lastStep?.toolCalls ?? [];
        if (lastCalls.length === 0) return {};

        const allBookkeeping = lastCalls.every((c) =>
          (BOOKKEEPING_TOOLS as readonly string[]).includes(c.toolName)
        );
        if (!allBookkeeping) return {};

        return {
          model: cheapModelInstance,
          instructions: bookkeeperInstructions,
        };
      },
      onError: (event: { error: unknown }) => {
        // Сохраняем ошибку для последующей передачи клиенту
        lastStreamError = event.error;
        console.error("[DM stream error]", event.error);
      },
      onFinish: async ({
        text,
        toolCalls,
        toolResults,
        usage,
      }: {
        text: string;
        toolCalls?: unknown[];
        toolResults?: unknown[];
        usage?: {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
          inputTokenDetails?: { cacheReadTokens?: number };
        };
      }) => {
        const inTokens = usage?.inputTokens ?? 0;
        const outTokens = usage?.outputTokens ?? 0;
        const cachedTokens = usage?.inputTokenDetails?.cacheReadTokens ?? 0;
        const totalTokens = usage?.totalTokens ?? (inTokens + outTokens);
        const costRub = calculateCostRub(selectedModel, {
          inputTokens: inTokens,
          outputTokens: outTokens,
          cachedTokens,
          totalTokens,
        });

        const cleanedText = cleanAssistantNarrative(text);

        if (activeCampaignId && cleanedText) {
          const statsPayload = {
            model: selectedModel,
            usage: {
              inputTokens: inTokens,
              outputTokens: outTokens,
              cachedTokens,
              totalTokens,
            },
            costRub,
          };

          let serializedResults: string | null = null;
          try {
            serializedResults = JSON.stringify({
              calls: toolCalls || [],
              results: toolResults || [],
              _stats: statsPayload,
            });
          } catch {
            serializedResults = toolResults ? JSON.stringify(toolResults) : null;
          }

          await db.chatMessage.create({
            data: {
              campaignId: activeCampaignId,
              role: "assistant",
              content: cleanedText,
              toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
              toolResults: serializedResults,
            },
          });
        }
        console.log(
          `[DM] Ответ сохранён. Инструментов: ${toolCalls?.length || 0}. Символов: ${cleanedText.length}. Токенов: вход ${inTokens} (кеш ${cachedTokens}) / выход ${outTokens}. Стоимость: ~${costRub.toFixed(4)} ₽`
        );

        // Фоновая синхронизация состояния сцены, NPC и свёртки истории (на Vercel через after)
        if (activeCampaignId) {
          after(async () => {
            try {
              if (cleanedText) {
                await syncSceneState({
                  campaignId: activeCampaignId,
                  playerMessage: playerMessageText,
                  assistantResponse: cleanedText,
                  apiKey: cleanKey,
                  authMode,
                  baseURL,
                  cheapModel: cheapModelName,
                });
              }
              await compactHistory({
                campaignId: activeCampaignId,
                apiKey: cleanKey,
                authMode,
                cheapModel: cheapModelName,
                baseURL,
              });
            } catch (err) {
              console.error("[chat background error]", err);
            }
          });
        }
      },
    };

    const result = activeCampaignId
      ? streamText({
          ...commonOptions,
          tools: getDeterministicTools(dmTools),
          toolsContext: buildToolsContext(activeCampaignId),
        })
      : streamText({ ...commonOptions, tools: baseTools });

    // Функция для преобразования ошибки API в читаемое сообщение для клиента
    const handleStreamError = (_error: unknown): string => {
      // Используем ошибку из streamText.onError, т.к. toUIMessageStream теряет её
      const error = lastStreamError ?? _error;

      // AI SDK оборачивает ошибки в APICallError с полями statusCode, responseBody
      const err = (error || {}) as Record<string, unknown>;
      const statusCode = (err.statusCode ?? (err as any).status ?? (err as any)?.cause?.statusCode) as number | undefined;
      const responseBody = (err.responseBody ?? (err as any)?.cause?.responseBody) as string | undefined;
      const message = (err.message ?? (err as any)?.cause?.message) as string | undefined;

      // 401 — неверный API-ключ
      if (statusCode === 401) {
        return "❌ Неверный API-ключ. Откройте настройки (кнопка справа сверху) и введите валидный ключ с https://polza.ai";
      }
      // 429 — лимиты
      if (statusCode === 429) {
        return "⏳ Превышен лимит запросов к API. Пополните баланс или подождите минуту на polza.ai";
      }
      // 404 — модель не найдена
      if (statusCode === 404) {
        return `❌ Модель "${selectedModel}" не найдена. Откройте настройки и проверьте название модели.`;
      }
      // 5xx — серверная ошибка провайдера
      if (statusCode && statusCode >= 500) {
        return "⚠️ Сервер AI временно недоступен. Попробуйте через минуту.";
      }
      // Если есть тело ответа с сообщением
      if (responseBody) {
        try {
          const parsed = JSON.parse(responseBody);
          if (parsed?.error?.message) {
            return `❌ Ошибка API: ${parsed.error.message}`;
          }
        } catch {
          // не парсится — пропускаем
        }
      }
      // Фоллбэк
      return `❌ Ошибка: ${message || "Неизвестная ошибка"}. Проверьте API-ключ в настройках.`;
    };

    // Сохраняем сообщение пользователя в БД (в AI SDK 7.x UIMessage использует parts)
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (activeCampaignId && lastUserMessage) {
      const userText = (lastUserMessage.parts ?? [])
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
      if (userText) {
        await db.chatMessage.create({
          data: {
            campaignId: activeCampaignId,
            role: "user",
            content: userText,
          },
        });
      }
    }

    // Один вызов toUIMessageStream: обёртка результата ещё раз через toUIMessageStream({stream})
    // теряет поле delta у text-delta, и клиент получает пустые сообщения.
    return createUIMessageStreamResponse({
      status: 200,
      stream: result.toUIMessageStream({
        onError: handleStreamError,
        messageMetadata: ({ part }) => {
          if (part.type === "finish") {
            const u = part.totalUsage;
            const inTokens = u?.inputTokens ?? 0;
            const outTokens = u?.outputTokens ?? 0;
            const cachedTokens = (u as any)?.inputTokenDetails?.cacheReadTokens ?? 0;
            const totalTokens = u?.totalTokens ?? (inTokens + outTokens);
            const costRub = calculateCostRub(selectedModel, {
              inputTokens: inTokens,
              outputTokens: outTokens,
              cachedTokens,
              totalTokens,
            });

            return {
              model: selectedModel,
              usage: {
                inputTokens: inTokens,
                outputTokens: outTokens,
                cachedTokens,
                totalTokens,
              },
              costRub,
            };
          }
        },
      }),
    });
  } catch (error) {
    console.error("[chat] Error:", error);
    return Response.json(
      {
        error: "Failed to process chat",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
