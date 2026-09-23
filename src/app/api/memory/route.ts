// API: получить факты памяти и события для UI
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId");

    if (!campaignId) {
      return Response.json({ error: "campaignId required" }, { status: 400 });
    }

    const [memories, events] = await Promise.all([
      db.memory.findMany({
        where: { campaignId, isArchived: false },
        orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
        take: 50,
      }),
      db.gameEvent.findMany({
        where: { campaignId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    return Response.json({ memories, events: events.reverse() });
  } catch (error) {
    console.error("[memory] GET error:", error);
    return Response.json({ error: "Failed to fetch memory" }, { status: 500 });
  }
}
