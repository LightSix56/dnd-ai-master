// API сюжетной арки кампании.
// POST — запустить генерацию, GET — прочитать статус/прогресс/готовую арку.
//
// Генерация занимает минуты (скелет ~2.5 мин + по ~2.5 мин на акт), поэтому
// POST не ждёт результат: он помечает кампанию как "generating" и возвращается
// сразу, а работа идёт фоном с записью прогресса в БД. UI опрашивает GET.

import { after } from "next/server";
import { db } from "@/lib/db";
import {
  generateStoryArc,
  parseStoryArc,
  parseArcProgress,
  planActCount,
  type ArcProgress,
} from "@/lib/ai/story-arc";
import { resolveStoryModel } from "@/lib/ai/models";

export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId");
    if (!campaignId) {
      return Response.json({ error: "campaignId required" }, { status: 400 });
    }

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: {
        arcStatus: true,
        arcProgress: true,
        arcModel: true,
        arcCurrentAct: true,
        storyArc: true,
        levelFrom: true,
        levelTo: true,
      },
    });
    if (!campaign) {
      return Response.json({ error: "Кампания не найдена" }, { status: 404 });
    }

    return Response.json({
      status: campaign.arcStatus,
      progress: parseArcProgress(campaign.arcProgress),
      model: campaign.arcModel,
      currentAct: campaign.arcCurrentAct,
      levelFrom: campaign.levelFrom,
      levelTo: campaign.levelTo,
      arc: parseStoryArc(campaign.storyArc),
    });
  } catch (error) {
    console.error("[arc] GET error:", error);
    return Response.json({ error: "Failed to fetch story arc" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const {
      campaignId,
      model,
      apiKey,
      authMode,
      baseURL,
      force = false,
    }: {
      campaignId?: string;
      model?: string;
      apiKey?: string;
      authMode?: "bearer" | "x-api-key" | "raw";
      baseURL?: string;
      force?: boolean;
    } = await req.json();

    if (!campaignId) {
      return Response.json({ error: "campaignId required" }, { status: 400 });
    }

    const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return Response.json({ error: "Кампания не найдена" }, { status: 404 });
    }
    const isStuck =
      campaign.arcStatus === "generating" &&
      Date.now() - new Date(campaign.updatedAt).getTime() > 3 * 60 * 1000;

    if (campaign.arcStatus === "generating" && !force && !isStuck) {
      return Response.json({ error: "Генерация уже идёт" }, { status: 409 });
    }
    if (campaign.arcStatus === "ready" && !force) {
      return Response.json({ error: "История уже сгенерирована" }, { status: 409 });
    }

    const cleanKey = (apiKey || process.env.AI_API_KEY || "").trim();
    if (!cleanKey) {
      return Response.json(
        { error: "API ключ не указан. Откройте настройки и введите ключ." },
        { status: 401 }
      );
    }

    const arcModel = resolveStoryModel(model);
    const actsTotal = 1;
    const initialProgress: ArcProgress = {
      stage: "skeleton",
      stageLabel: "Готовлюсь придумывать завязку и Акт 1",
      actsTotal,
      actsDone: 0,
    };

    await db.campaign.update({
      where: { id: campaignId },
      data: {
        arcStatus: "generating",
        arcModel,
        arcProgress: JSON.stringify(initialProgress),
        storyArc: null,
        arcCurrentAct: 0,
      },
    });

    // Фоновая работа: на Vercel используем after(), чтобы функция не замораживалась после отправки ответа.
    // Ошибки обязательно пишем в БД — иначе UI будет вечно ждать "generating".
    after(async () => {
      try {
        const players = await db.character.findMany({
          where: { campaignId, type: "player" },
          orderBy: { name: "asc" },
        });

        const arc = await generateStoryArc({
          model: arcModel,
          apiKey: cleanKey,
          authMode,
          baseURL,
          params: {
            name: campaign.name,
            setting: campaign.setting,
            tone: campaign.tone,
            difficulty: campaign.difficulty,
            dmStyle: campaign.dmStyle,
            ruleStrictness: campaign.ruleStrictness,
            levelFrom: campaign.levelFrom,
            levelTo: campaign.levelTo,
            worldDescription: campaign.worldDescription,
            customDmNotes: campaign.customDmNotes,
            language: campaign.language,
            partyTies: campaign.partyTies,
            partyMembers: players.map((p) => ({
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
            })),
          },
          onProgress: async (progress) => {
            await db.campaign.update({
              where: { id: campaignId },
              data: { arcProgress: JSON.stringify(progress) },
            });
          },
        });

        await db.campaign.update({
          where: { id: campaignId },
          data: {
            storyArc: JSON.stringify(arc),
            arcStatus: "ready",
            arcCurrentAct: 0,
            arcProgress: JSON.stringify({
              stage: "done",
              stageLabel: "История готова",
              actsTotal: arc.acts.length,
              actsDone: arc.acts.length,
            } satisfies ArcProgress),
          },
        });

        // Кладём арку в долгосрочную память, чтобы мастер видел её и в контексте
        await db.memory.create({
          data: {
            campaignId,
            category: "quest",
            subject: `Сюжетная арка: ${arc.title}`,
            content: `${arc.premise}\n\nГлавная угроза: ${arc.mainThreat}\n\nАкты: ${arc.acts
              .map((a) => `${a.levelFrom}-${a.levelTo} «${a.name}»`)
              .join(", ")}`,
            importance: 10,
          },
        });

        console.log(`[arc] Готово: "${arc.title}", актов ${arc.acts.length}, модель ${arcModel}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[arc] Генерация провалилась:", message);
        await db.campaign
          .update({
            where: { id: campaignId },
            data: {
              arcStatus: "failed",
              arcProgress: JSON.stringify({
                stage: "failed",
                stageLabel: "Не удалось сгенерировать историю",
                actsTotal,
                actsDone: 0,
                error: message,
              } satisfies ArcProgress),
            },
          })
          .catch((e) => console.error("[arc] не удалось записать статус ошибки:", e));
      }
    });

    return Response.json({ started: true, model: arcModel, actsTotal });
  } catch (error) {
    console.error("[arc] POST error:", error);
    return Response.json({ error: "Failed to start arc generation" }, { status: 500 });
  }
}
