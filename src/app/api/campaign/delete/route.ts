// API: удалить кампанию по id с проверкой владельца
import { db } from "@/lib/db";
import { getAuthUserFromRequest, getSupabaseAdminClient } from "@/lib/supabase/client";

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
    if (existing.userId && existing.userId !== user?.id) {
      return Response.json({ error: "Доступ запрещён: нельзя удалить чужую кампанию" }, { status: 403 });
    }

    const wasActive = existing.isActive;

    // Сначала удаляем версии героев этой кампании (строки в листах с campaign_id).
    // Если это не удалось, кампанию не трогаем: иначе версии останутся без владельца.
    // Оригиналы героев не трогаем.
    const supabase = getSupabaseAdminClient();
    let versionsError: { message: string } | null = null;
    const { data: versions, error: listError } = await supabase
      .from("characters")
      .select("id")
      .eq("campaign_id", campaignId);
    versionsError = listError;

    // Стол кампании закрываем, а места участников, занятые версиями, освобождаем:
    // room_participants ссылается на лист с ON DELETE RESTRICT, и с занятым местом
    // база не дала бы удалить версию (сетевые кампании не удалялись вовсе)
    if (!versionsError) {
      const { error } = await supabase
        .from("rooms")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .filter("campaign_settings->>campaignId", "eq", campaignId);
      versionsError = error;
    }
    const versionIds = (versions ?? []).map((v: { id: string }) => v.id);
    if (!versionsError && versionIds.length > 0) {
      const { error } = await supabase.from("room_participants").delete().in("character_id", versionIds);
      versionsError = error;
    }
    if (!versionsError) {
      const { error } = await supabase.from("characters").delete().eq("campaign_id", campaignId);
      versionsError = error;
    }
    if (versionsError) {
      console.error("[campaign/delete] не удалось удалить версии героев:", versionsError.message);
      return Response.json(
        { error: "Не удалось удалить версии героев, кампания не удалена", details: versionsError.message },
        { status: 500 }
      );
    }

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
