// API: заполнить библиотеку ударами, заклинаниями и способностями из library-data.
// Идемпотентно: существующие записи обновляются, чтобы правки в данных доезжали.
import { AUTH_REQUIRED_MESSAGE, getRequestUserId } from "@/lib/auth/campaign-access";
import { db } from "@/lib/db";
import { ATTACK_LIBRARY, SPELL_LIBRARY, ABILITY_LIBRARY } from "@/lib/combat/library-data";
import { safeErrorDetails } from "@/lib/security/errors";

const SEED_COOLDOWN_MS = 60_000;
const seedLastCall = new Map<string, number>();

export async function POST(req?: Request) {
  try {
    const userId = req ? await getRequestUserId(req) : null;
    if (!userId) {
      return Response.json({ error: AUTH_REQUIRED_MESSAGE }, { status: 401 });
    }
    const now = Date.now();
    const prev = seedLastCall.get(userId) ?? 0;
    if (now - prev < SEED_COOLDOWN_MS) {
      return Response.json({ error: "Синхронизацию можно запускать не чаще раза в минуту" }, { status: 429 });
    }
    if (seedLastCall.size > 1000) seedLastCall.clear();
    seedLastCall.set(userId, now);
    let attacksCreated = 0;
    let attacksUpdated = 0;

    for (const atk of ATTACK_LIBRARY) {
      const data = {
        kind: atk.kind,
        attackBonus: atk.attackBonus,
        damage: JSON.stringify(atk.damage),
        rangeNormal: atk.rangeNormal,
        rangeLong: atk.rangeLong ?? null,
        finesse: atk.finesse ?? false,
        actionCost: atk.actionCost ?? "action",
        description: atk.description ?? "",
      };
      const existing = await db.attackLibrary.findUnique({ where: { name: atk.name } });
      if (existing) {
        await db.attackLibrary.update({ where: { name: atk.name }, data });
        attacksUpdated++;
      } else {
        await db.attackLibrary.create({ data: { name: atk.name, ...data } });
        attacksCreated++;
      }
    }

    let spellsCreated = 0;
    let spellsUpdated = 0;

    for (const spell of SPELL_LIBRARY) {
      const data = {
        level: spell.level,
        school: spell.school,
        parameters: JSON.stringify(spell.parameters),
      };
      const existing = await db.spellLibrary.findUnique({ where: { name: spell.name } });
      if (existing) {
        await db.spellLibrary.update({ where: { name: spell.name }, data });
        spellsUpdated++;
      } else {
        await db.spellLibrary.create({ data: { name: spell.name, ...data } });
        spellsCreated++;
      }
    }

    let abilitiesCreated = 0;
    let abilitiesUpdated = 0;

    for (const ability of ABILITY_LIBRARY) {
      const data = {
        source: ability.source,
        className: ability.className,
        minLevel: ability.minLevel,
        category: ability.category ?? "utility",
        parameters: JSON.stringify(ability.parameters),
      };
      const existing = await db.abilityLibrary.findUnique({ where: { name: ability.name } });
      if (existing) {
        await db.abilityLibrary.update({ where: { name: ability.name }, data });
        abilitiesUpdated++;
      } else {
        await db.abilityLibrary.create({ data: { name: ability.name, ...data } });
        abilitiesCreated++;
      }
    }

    return Response.json({
      success: true,
      attacks: { created: attacksCreated, updated: attacksUpdated, total: ATTACK_LIBRARY.length },
      spells: { created: spellsCreated, updated: spellsUpdated, total: SPELL_LIBRARY.length },
      abilities: {
        created: abilitiesCreated,
        updated: abilitiesUpdated,
        total: ABILITY_LIBRARY.length,
      },
    });
  } catch (error) {
    console.error("[library/seed] error:", error);
    return Response.json(
      { error: "Не удалось заполнить библиотеку", details: safeErrorDetails(error) },
      { status: 500 }
    );
  }
}
