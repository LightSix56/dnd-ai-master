// API: активировать кампанию по id с учетом владельца
import { denyCampaignAccess } from "@/lib/auth/campaign-access";
import { db } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/supabase/client";

export async function POST(req: Request) {
  try {
    const { user } = await getAuthUserFromRequest(req);
    const userId = user ? user.id : null;

    const { campaignId }: { campaignId: string; roomCode?: string } = await req.json();
    if (!campaignId) {
      return Response.json({ error: "campaignId required" }, { status: 400 });
    }

    // Проверяем, что кампания существует
    const existing = await db.campaign.findUnique({ where: { id: campaignId } });
    if (!existing) {
      return Response.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Доступ: владелец или участник сетевой комнаты этой кампании
    const denied = await denyCampaignAccess(req, campaignId);
    if (denied) return denied;

    // Участник комнаты получает кампанию стола, но «активной» у себя её не делает
    if (existing.userId && (!user || existing.userId !== user.id)) {
      const campaign = await db.campaign.findUnique({
        where: { id: campaignId },
        include: {
          characters: {
            orderBy: [{ type: "asc" }, { name: "asc" }],
          },
          _count: {
            select: { events: true, memories: true, chatMessages: true },
          },
        },
      });
      return Response.json({ campaign });
    }

    // Снимаем активность только с кампаний текущего пользователя
    await db.campaign.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Активируем выбранную
    const campaign = await db.campaign.update({
      where: { id: campaignId },
      data: { isActive: true },
      include: {
        characters: {
          orderBy: [{ type: "asc" }, { name: "asc" }],
        },
        _count: {
          select: { events: true, memories: true, chatMessages: true },
        },
      },
    });

    return Response.json({ campaign });
  } catch (error) {
    console.error("[campaign/activate] error:", error);
    return Response.json({ error: "Failed to activate campaign" }, { status: 500 });
  }
}
