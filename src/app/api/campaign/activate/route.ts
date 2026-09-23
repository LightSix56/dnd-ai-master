// API: активировать кампанию по id
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { campaignId }: { campaignId: string } = await req.json();
    if (!campaignId) {
      return Response.json({ error: "campaignId required" }, { status: 400 });
    }

    // Проверяем, что кампания существует
    const existing = await db.campaign.findUnique({ where: { id: campaignId } });
    if (!existing) {
      return Response.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Снимаем активность со всех
    await db.campaign.updateMany({
      where: { isActive: true },
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
