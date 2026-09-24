// API: список кампаний с изоляцией по аккаунту
import { db } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/supabase/client";

export async function GET(request: Request) {
  try {
    const { user } = await getAuthUserFromRequest(request);
    const userIdFilter = user ? user.id : null;

    const campaigns = await db.campaign.findMany({
      where: { userId: userIdFilter },
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
