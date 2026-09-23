// API: импорт персонажа из генератора листа — файлом JSON или по share-коду с сайта.
import { db } from "@/lib/db";
import {
  isSheetCharacter,
  mapSheetToCharacter,
  deriveMemories,
  type SheetCharacter,
} from "@/lib/dnd/import-character";

export const maxDuration = 30;

const SHEET_BASE_URL = (
  process.env.SHEET_SITE_URL || "https://dnd5e-character-sheet-theta.vercel.app"
).replace(/\/+$/, "");

class ShareFetchError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function fetchSharedCharacter(code: string): Promise<SheetCharacter> {
  const res = await fetch(`${SHEET_BASE_URL}/api/share/${encodeURIComponent(code)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new ShareFetchError(
      "Код не найден или истёк. Создайте новую ссылку на сайте.",
      404
    );
  }
  if (!res.ok) {
    throw new ShareFetchError(`Сайт вернул HTTP ${res.status}`, 502);
  }

  const payload = await res.json();
  return (payload?.character?.data ?? payload?.data ?? payload) as SheetCharacter;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      campaignId,
      type = "player",
      shareCode,
      character,
    }: {
      campaignId?: string;
      type?: string;
      shareCode?: string;
      character?: unknown;
    } = body;

    let campaign = campaignId
      ? await db.campaign.findUnique({ where: { id: campaignId } })
      : await db.campaign.findFirst({
          where: { isActive: true },
          orderBy: { updatedAt: "desc" },
        });

    if (!campaign) {
      return Response.json(
        { error: "Нет активной кампании. Сначала создайте или активируйте кампанию." },
        { status: 400 }
      );
    }
    const activeCampaignId = campaign.id;

    let sheet: SheetCharacter;
    if (shareCode) {
      const code = String(shareCode).trim();
      // Принимаем и полную ссылку, и просто код.
      const fromUrl = code.match(/([A-Za-z0-9_-]{4,})\/?$/);
      sheet = await fetchSharedCharacter(fromUrl ? fromUrl[1] : code);
    } else if (character) {
      sheet = character as SheetCharacter;
    } else {
      return Response.json(
        { error: "Нужен shareCode или character" },
        { status: 400 }
      );
    }

    if (!isSheetCharacter(sheet)) {
      return Response.json(
        {
          error:
            "Не похоже на лист персонажа D&D 5e. Ожидается JSON с полем abilityScores (СИЛ, ЛОВ, ТЕЛ, ИНТ, МДР, ХАР).",
        },
        { status: 422 }
      );
    }

    const mapped = mapSheetToCharacter(sheet, type);

    // Рассчитываем текущий уровень отряда:
    // если в кампании уже есть персонажи игроков, новый персонаж должен соответствовать их уровню;
    // если отряд пуст — проверяется стартовый уровень кампании.
    const existingPlayers = await db.character.findMany({
      where: { campaignId: activeCampaignId, type: "player" },
      select: { level: true },
    });
    const currentPartyLevel =
      existingPlayers.length > 0
        ? Math.max(...existingPlayers.map((p) => p.level || 1))
        : campaign.startingLevel ?? campaign.levelFrom ?? 1;

    if (type === "player" && mapped.level !== currentPartyLevel) {
      return Response.json(
        {
          error: `Персонаж "${mapped.name}" имеет ${mapped.level} уровень. Для этой кампании требуется ровно ${currentPartyLevel} уровень (текущий уровень отряда).`,
        },
        { status: 422 }
      );
    }

    // Повторный импорт того же персонажа обновляет запись, а не плодит дубликаты.
    const existing = await db.character.findFirst({
      where: { campaignId: activeCampaignId, name: mapped.name },
    });

    const saved = existing
      ? await db.character.update({ where: { id: existing.id }, data: mapped })
      : await db.character.create({ data: { ...mapped, campaignId: activeCampaignId } });

    const memories = deriveMemories(sheet, mapped);
    let savedMemories = 0;
    for (const memory of memories) {
      const dup = await db.memory.findFirst({
        where: { campaignId: activeCampaignId, subject: memory.subject },
      });
      if (dup) {
        await db.memory.update({
          where: { id: dup.id },
          data: { content: memory.content, importance: memory.importance, isArchived: false },
        });
      } else {
        await db.memory.create({ data: { ...memory, campaignId: activeCampaignId } });
      }
      savedMemories++;
    }

    await db.gameEvent.create({
      data: {
        campaignId: activeCampaignId,
        type: "story",
        description: `${existing ? "Обновлён" : "Импортирован"} персонаж ${mapped.name} (${
          mapped.race || "?"
        } ${mapped.class || "?"} ${mapped.level} ур.)`,
        participants: JSON.stringify([saved.id]),
        isImportant: true,
      },
    });

    return Response.json({
      success: true,
      updated: Boolean(existing),
      character: {
        id: saved.id,
        name: saved.name,
        race: saved.race,
        class: saved.class,
        level: saved.level,
        hp: `${saved.hpCurrent}/${saved.hpMax}`,
        ac: saved.ac,
      },
      memoriesSaved: savedMemories,
      message: `${existing ? "Обновлён" : "Импортирован"}: ${mapped.name} — ${
        mapped.race || "?"
      } ${mapped.class || "?"} ${mapped.level} ур. Фактов в памяти: ${savedMemories}.`,
    });
  } catch (error) {
    console.error("[character/import] error:", error);
    const status = error instanceof ShareFetchError ? error.status : 500;
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status }
    );
  }
}
