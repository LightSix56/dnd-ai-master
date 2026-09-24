// API: удалить кампанию по id с проверкой владельца
import { db } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/supabase/client";

export async function POST(req: Request) {
  try {
    const { user } = await getAuthUserFromRequest(req);
    const { campaignId }: { campaignId: string } = await req.json();
    if (!campaignId) {
      return Response.json({ error: "campaignId required" }, { status: 400 });
    }

    // Проверяем существование
    const existing = await db.campaign.findUnique({ where: { id: campaignId } });
    if (!existing) {
      return Response.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Защита: нельзя удалить чужую кампанию
    if (existing.userId && user && existing.userId !== user.id) {
      return Response.json({ error: "Доступ запрещён: нельзя удалить чужую кампанию" }, { status: 403 });
    }

    const wasActive = existing.isActive;

    // Удаляем кампанию — каскадно удалятся characters, events, memories, chatMessages, summaries
    // (задано через onDelete: Cascade в схеме)
    await db.campaign.delete({ where: { id: campaignId } });

    // Если удалили активную — активируем последнюю из оставшихся кампаний этого же пользователя
    if (wasActive) {
      const latest = await db.campaign.findFirst({
        where: { userId: existing.userId },
        orderBy: { updatedAt: "desc" },
      });
      if (latest) {
        await db.campaign.update({
          where: { id: latest.id },
          data: { isActive: true },
        });
      }
    }

    return Response.json({
      success: true,
      message: `Кампания "${existing.name}" удалена`,
      activatedReplacement: wasActive,
    });
  } catch (error) {
    console.error("[campaign/delete] error:", error);
    return Response.json(
      {
        error: "Failed to delete campaign",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
