import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateCombatLoot } from "@/lib/combat/rewards/loot-generator";
import type { Combatant } from "@prisma/client";

function isEnemyDefeatedOrFled(enemy: Combatant): boolean {
  if (enemy.hpCurrent <= 0) return true;
  if (!enemy.conditions) return false;

  try {
    const conds =
      typeof enemy.conditions === "string"
        ? JSON.parse(enemy.conditions)
        : enemy.conditions;

    if (Array.isArray(conds)) {
      return conds.some((cond: any) =>
        typeof cond === "string"
          ? cond === "fled"
          : cond?.id === "fled" || cond?.name === "fled"
      );
    }
  } catch {
    // If parsing fails, treat as not fled
  }

  return false;
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(props?.params);
    const combatId = resolvedParams?.id?.trim();

    if (!combatId) {
      return NextResponse.json(
        { ok: false, error: "combatId обязателен" },
        { status: 400 }
      );
    }

    const combat = await db.combat.findUnique({
      where: { id: combatId },
      include: { combatants: true },
    });

    if (!combat) {
      return NextResponse.json(
        { ok: false, error: `Бой с ID '${combatId}' не найден` },
        { status: 404 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is allowed
    }

    const force = Boolean(body?.force);
    const biome = body?.biome || "dungeon";

    const enemies = combat.combatants.filter((c) => c.type === "enemy");
    const players = combat.combatants.filter(
      (c) => c.type === "player" || c.type === "companion"
    );

    const allDefeated =
      enemies.length === 0 || enemies.every(isEnemyDefeatedOrFled);

    if (!allDefeated && !force && combat.status === "active") {
      return NextResponse.json(
        {
          ok: false,
          error: "В бою еще остались живые враги. Для завершения используйте force: true.",
        },
        { status: 400 }
      );
    }

    const victory = allDefeated;
    const partySize = players.length > 0 ? players.length : body?.partySize || 4;

    const loot = victory
      ? generateCombatLoot(
          enemies.map((e) => ({
            name: e.name,
            challengeRating: e.level,
            cr: e.level,
            type: e.className,
            role: (e as any).tacticalRole,
          })),
          biome,
          partySize
        )
      : generateCombatLoot([], biome, partySize);

    // Update combat status and append finish log
    let combatLog: any[] = [];
    try {
      combatLog =
        typeof combat.log === "string" ? JSON.parse(combat.log) : combat.log;
      if (!Array.isArray(combatLog)) combatLog = [];
    } catch {
      combatLog = [];
    }

    combatLog.push({
      timestamp: new Date().toISOString(),
      type: "combat_ended",
      message: victory
        ? `🏁 Победа в тактическом бою! ${loot.summaryText}`
        : "⚠️ Бой завершен отступлением или поражением отряда.",
      victory,
      lootSummary: victory ? loot.summaryText : undefined,
    });

    await db.combat.update({
      where: { id: combatId },
      data: {
        status: "ended",
        log: JSON.stringify(combatLog),
      },
    });

    return NextResponse.json({
      ok: true,
      combatId,
      loot,
      victory,
    });
  } catch (error: any) {
    console.error("[API /api/combat/[id]/complete] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Внутренняя ошибка при завершении боя",
      },
      { status: 500 }
    );
  }
}
