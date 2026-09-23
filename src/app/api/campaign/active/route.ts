// API: получить активную кампанию
import { db } from "@/lib/db";

export async function GET() {
  try {
    const active = await db.campaign.findFirst({
      where: { isActive: true },
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
    return Response.json({ campaign: active });
  } catch (error) {
    console.error("[active campaign] error:", error);
    return Response.json({ error: "Failed to fetch active campaign" }, { status: 500 });
  }
}
