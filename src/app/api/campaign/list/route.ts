// API: список всех кампаний
import { db } from "@/lib/db";

export async function GET() {
  try {
    const campaigns = await db.campaign.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: {
            characters: true,
            events: true,
            memories: true,
            chatMessages: true,
          },
        },
      },
    });
    return Response.json({ campaigns });
  } catch (error) {
    console.error("[campaign/list] error:", error);
    return Response.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}
