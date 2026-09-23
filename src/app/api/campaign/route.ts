// API для управления кампаниями
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
    console.error("[campaign] GET error:", error);
    return Response.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      setting = "Forgotten Realms",
      tone = "heroic",
      difficulty = "normal",
      language = "ru",
      dmStyle = "balanced",
      ruleStrictness = "standard",
      startingLevel = 1,
      levelFrom,
      levelTo,
      worldDescription,
      customDmNotes,
      pvpEnabled = false,
      restFrequency = "standard",
      partyTies = "tight_knit",
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
    const to = Math.max(from, clampLevel(levelTo ?? from + 4, from + 4));

    if (makeActive) {
      // Снимаем флаг активности с других кампаний
      await db.campaign.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const campaign = await db.campaign.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        setting,
        tone,
        difficulty,
        language,
        dmStyle,
        ruleStrictness,
        startingLevel: from,
        levelFrom: from,
        levelTo: to,
        worldDescription: worldDescription?.trim() || null,
        customDmNotes: customDmNotes?.trim() || null,
        pvpEnabled: Boolean(pvpEnabled),
        restFrequency,
        partyTies,
        isActive: makeActive,
      },
    });

    return Response.json({ campaign });
  } catch (error) {
    console.error("[campaign] POST error:", error);
    return Response.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, setting, tone, difficulty, dmStyle, worldDescription, customDmNotes, partyTies } = body;
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }
    const updated = await db.campaign.update({
      where: { id },
      data: {
        ...(setting !== undefined ? { setting } : {}),
        ...(tone !== undefined ? { tone } : {}),
        ...(difficulty !== undefined ? { difficulty } : {}),
        ...(dmStyle !== undefined ? { dmStyle } : {}),
        ...(worldDescription !== undefined ? { worldDescription: worldDescription?.trim() || null } : {}),
        ...(customDmNotes !== undefined ? { customDmNotes: customDmNotes?.trim() || null } : {}),
        ...(partyTies !== undefined ? { partyTies } : {}),
      },
    });
    return Response.json({ campaign: updated });
  } catch (error) {
    console.error("[campaign] PATCH error:", error);
    return Response.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

