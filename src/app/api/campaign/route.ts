// API для управления кампаниями с изоляцией по пользователям
import { denyCampaignAccess } from "@/lib/auth/campaign-access";
import { db } from "@/lib/db";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { normalizeCampaignSetup, normalizeCampaignSetupPatch } from "@/lib/campaign/setup-params";

export async function GET(req: Request) {
  try {
    const { user } = await getAuthUserFromRequest(req);
    // Без входа в аккаунт кампаний не показываем: раньше все «ничьи» кампании были видны любому гостю сайта
    if (!user) return Response.json({ campaigns: [], authRequired: true });
    const userIdFilter = user.id;

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
    console.error("[campaign] GET error:", error);
    return Response.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await getAuthUserFromRequest(req);
    if (!user) {
      return Response.json(
        { error: "Войдите в аккаунт, чтобы создать кампанию.", authRequired: true },
        { status: 401 }
      );
    }
    const userId = user.id;

    const body = await req.json();
    const {
      name,
      description,
      language = "ru",
      ruleStrictness = "standard",
      startingLevel = 1,
      levelFrom,
      worldDescription,
      pvpEnabled = false,
      restFrequency = "standard",
      makeActive = true,
    } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    // Диапазон уровней кампании: старт = levelFrom, поэтому startingLevel
    // подчиняем ему, иначе мастер и арка разойдутся в стартовом уровне.
    const clampLevel = (v: unknown, fallback: number) =>
      Math.max(1, Math.min(20, Number(v) || fallback));
    const from = clampLevel(levelFrom ?? startingLevel, 1);
    const setup = normalizeCampaignSetup(body, from);

    if (makeActive) {
      // Снимаем флаг активности только с кампаний текущего пользователя
      await db.campaign.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }

    const campaign = await db.campaign.create({
      data: {
        userId,
        name: name.trim(),
        description: description?.trim() || null,
        setting: setup.setting,
        tone: setup.tone,
        difficulty: setup.difficulty,
        language,
        dmStyle: setup.dmStyle,
        ruleStrictness,
        startingLevel: from,
        levelFrom: from,
        levelTo: setup.levelTo,
        worldDescription: worldDescription?.trim() || null,
        customDmNotes: setup.customDmNotes,
        pvpEnabled: Boolean(pvpEnabled),
        restFrequency,
        partyTies: setup.partyTies,
        startingSituation: setup.startingSituation,
        isActive: makeActive,
      },
    });

    return Response.json({ campaign });
  } catch (error: any) {
    console.error("[campaign] POST error:", error);
    const msg = error?.message || "Failed to create campaign";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, worldDescription } = body;
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await db.campaign.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Менять кампанию может владелец или участник её сетевой комнаты
    const denied = await denyCampaignAccess(req, id);
    if (denied) return denied;

    // title — поле формы, у кампании его нет: в PATCH оно не сохраняется, название идёт через name
    const { title: _formTitle, ...setupPatch } = normalizeCampaignSetupPatch(body, existing.levelFrom);
    const nameChange = typeof body.name === "string" && body.name.trim() ? { name: body.name.trim() } : {};

    const updated = await db.campaign.update({
      where: { id },
      data: {
        ...setupPatch,
        ...nameChange,
        ...(worldDescription !== undefined ? { worldDescription: worldDescription?.trim() || null } : {}),
      },
    });
    return Response.json({ campaign: updated });
  } catch (error) {
    console.error("[campaign] PATCH error:", error);
    return Response.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}
