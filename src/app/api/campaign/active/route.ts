// API: получить активную кампанию текущего пользователя
import { db } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/supabase/client";

export async function GET(request: Request) {
  try {
    const { user } = await getAuthUserFromRequest(request);
    const userIdFilter = user ? user.id : null;

    const { searchParams } = new URL(request.url);
    const requestedCampaignId = searchParams.get("campaignId")?.trim();

    // Если запрошена конкретная кампания (например, привязанная к сетевой комнате)
    if (requestedCampaignId) {
      const target = await db.campaign.findUnique({
        where: { id: requestedCampaignId },
        include: {
          characters: {
            orderBy: [{ type: "asc" }, { name: "asc" }],
          },
          _count: {
            select: {
              events: true,
              memories: true,
              chatMessages: true,
            },
          },
        },
      });

      if (target) {
        return Response.json({ campaign: target });
      }
    }

    let active = await db.campaign.findFirst({
      where: { userId: userIdFilter, isActive: true },
      orderBy: { updatedAt: "desc" },
      include: {
        characters: {
          orderBy: [{ type: "asc" }, { name: "asc" }],
        },
        _count: {
          select: {
            events: true,
            memories: true,
            chatMessages: true,
          },
        },
      },
    });

    // Если нет активной, но у пользователя есть кампании — активируем последнюю созданную
    if (!active) {
      const latest = await db.campaign.findFirst({
        where: { userId: userIdFilter },
        orderBy: { updatedAt: "desc" },
      });
      if (latest) {
        active = await db.campaign.update({
          where: { id: latest.id },
          data: { isActive: true },
          include: {
            characters: {
              orderBy: [{ type: "asc" }, { name: "asc" }],
            },
            _count: {
              select: {
                events: true,
                memories: true,
                chatMessages: true,
              },
            },
          },
        });
      }
    }

    return Response.json({ campaign: active });
  } catch (error) {
    console.error("[active campaign] error:", error);
    return Response.json({ error: "Failed to fetch active campaign" }, { status: 500 });
  }
}
