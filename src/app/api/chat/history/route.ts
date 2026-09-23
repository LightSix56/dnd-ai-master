// API: история чата кампании — сообщения пишутся в /api/chat, но без этого
// маршрута никто их не читал, и после перезагрузки страницы диалог пропадал.
import { db } from "@/lib/db";

const MAX_MESSAGES = 200;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId");

    if (!campaignId) {
      return Response.json({ error: "campaignId required" }, { status: 400 });
    }

    // Берём последние сообщения, а не первые: при длинной кампании интересен хвост.
    const rows = await db.chatMessage.findMany({
      where: { campaignId, role: { in: ["user", "assistant"] } },
      orderBy: { createdAt: "desc" },
      take: MAX_MESSAGES,
      select: { id: true, role: true, content: true, toolResults: true, createdAt: true },
    });

    // Формат UIMessage из AI SDK 7: текст живёт в parts, а не в content.
    const messages = rows.reverse().map((m) => {
      let metadata: unknown = undefined;
      if (m.toolResults) {
        try {
          const parsed = JSON.parse(m.toolResults);
          if (parsed?._stats) {
            metadata = parsed._stats;
          }
        } catch {
          // Игнорируем ошибки парсинга старых логов
        }
      }
      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: m.content }],
        ...(metadata ? { metadata } : {}),
      };
    });

    return Response.json({ messages });
  } catch (error) {
    console.error("[chat/history] GET error:", error);
    return Response.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
