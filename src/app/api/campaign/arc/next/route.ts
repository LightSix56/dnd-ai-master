import { after } from "next/server";
import { db } from "@/lib/db";
import { generateNextChapter, parseStoryArc, type ArcProgress } from "@/lib/ai/story-arc";
import { resolveDmModel } from "@/lib/ai/models";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const {
      campaignId,
      outcome = "Герои успешно завершили предыдущую главу и готовы продолжить путь",
      model,
      apiKey,
      authMode,
      baseURL,
    }: {
      campaignId?: string;
      outcome?: string;
      model?: string;
      apiKey?: string;
      authMode?: "bearer" | "x-api-key" | "raw";
      baseURL?: string;
    } = await req.json();

    if (!campaignId) {
      return Response.json({ error: "campaignId required" }, { status: 400 });
    }

    const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return Response.json({ error: "Кампания не найдена" }, { status: 404 });
    }
    if (campaign.arcStatus === "generating") {
      return Response.json({ error: "Генерация уже идёт" }, { status: 409 });
    }

    const cleanKey = (apiKey || process.env.AI_API_KEY || "").trim();
    if (!cleanKey) {
      return Response.json(
        { error: "API ключ не указан. Откройте настройки и введите ключ." },
        { status: 401 }
      );
    }

    const arc = parseStoryArc(campaign.storyArc);
    if (!arc) {
      return Response.json({ error: "У кампании нет базовой сюжетной арки" }, { status: 400 });
    }

    const nextActNumber = (arc.acts?.length ?? 0) + 1;
    const dmModel = resolveDmModel(model);

    const progress: ArcProgress = {
      stage: "acts",
      stageLabel: `Генерирую Акт ${nextActNumber}...`,
      actsTotal: nextActNumber,
      actsDone: nextActNumber - 1,
    };

    await db.campaign.update({
      where: { id: campaignId },
      data: {
        arcStatus: "generating",
        arcProgress: JSON.stringify(progress),
      },
    });

    // Фоновая генерация следующего акта (на Vercel через after)
    after(async () => {
      try {
        const nextChapter = await generateNextChapter({
          campaignId,
          outcome,
          model: dmModel,
          apiKey: cleanKey,
          authMode,
          baseURL,
        });

        await db.campaign.update({
          where: { id: campaignId },
          data: {
            arcStatus: "ready",
            arcCurrentAct: nextChapter.actNumber - 1,
            arcProgress: JSON.stringify({
              stage: "done",
              stageLabel: `Акт ${nextChapter.actNumber} готов`,
              actsTotal: nextChapter.actNumber,
              actsDone: nextChapter.actNumber,
            } satisfies ArcProgress),
          },
        });

        // Добавляем память о новом акте
        await db.memory.create({
          data: {
            campaignId,
            category: "quest",
            subject: `Акт ${nextChapter.actNumber}: ${nextChapter.act.name}`,
            content: `Цель: ${nextChapter.act.goal}\nСводка: ${nextChapter.act.summary}`,
            importance: 9,
          },
        });

        console.log(`[arc/next] Успешно создан Акт ${nextChapter.actNumber}: «${nextChapter.act.name}»`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[arc/next] Ошибка генерации следующего акта:", message);
        await db.campaign
          .update({
            where: { id: campaignId },
            data: {
              arcStatus: "ready", // возвращаем ready, чтобы интерфейс не зависал в generating
              arcProgress: JSON.stringify({
                stage: "failed",
                stageLabel: "Не удалось сгенерировать следующий акт",
                actsTotal: nextActNumber,
                actsDone: nextActNumber - 1,
                error: message,
              } satisfies ArcProgress),
            },
          })
          .catch((e) => console.error("[arc/next] не удалось записать статус ошибки:", e));
      }
    });

    return Response.json({ started: true, nextActNumber });
  } catch (error) {
    console.error("[arc/next] POST error:", error);
    return Response.json({ error: "Failed to start next act generation" }, { status: 500 });
  }
}
