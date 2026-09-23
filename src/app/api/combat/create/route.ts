// API: создать новый бой — с тестовыми врагами
import { db } from "@/lib/db";
import { hydrateCombat } from "@/lib/combat/serialize";
import { createTacticalEncounter } from "@/lib/combat/generator";
import type { Attack } from "@/lib/combat/types";

interface TestEnemy {
  name: string;
  hpMax: number;
  ac: number;
  speed: number;
  dexMod: number;
  strMod: number;
  conMod: number;
  attacks: Attack[];
}

const TEST_ENEMIES: TestEnemy[] = [
  {
    name: "Гоблин-разведчик",
    hpMax: 7,
    ac: 13,
    speed: 30,
    dexMod: 2,
    strMod: -1,
    conMod: 0,
    attacks: [
      {
        id: "gob_scm",
        name: "Скимитар",
        attackBonus: 4,
        damage: [{ dice: "1d6", mod: 2, type: "slashing" }],
        kind: "melee",
        range: { normal: 5 },
        actionCost: "action",
        finesse: true,
      },
      {
        id: "gob_bow",
        name: "Короткий лук",
        attackBonus: 4,
        damage: [{ dice: "1d6", mod: 2, type: "piercing" }],
        kind: "ranged",
        range: { normal: 80, long: 320 },
        actionCost: "action",
      },
    ],
  },
  {
    name: "Гоблин-копейщик",
    hpMax: 9,
    ac: 12,
    speed: 30,
    dexMod: 2,
    strMod: 0,
    conMod: 0,
    attacks: [
      {
        id: "gob_spear",
        name: "Копьё",
        attackBonus: 4,
        damage: [{ dice: "1d6", mod: 2, type: "piercing" }],
        kind: "melee",
        range: { normal: 10 },
        actionCost: "action",
      },
    ],
  },
  {
    name: "Орк-берсерк",
    hpMax: 19,
    ac: 14,
    speed: 35,
    dexMod: 1,
    strMod: 3,
    conMod: 2,
    attacks: [
      {
        id: "orc_greatsword",
        name: "Двуручный меч",
        attackBonus: 5,
        damage: [{ dice: "2d6", mod: 3, type: "slashing" }],
        kind: "melee",
        range: { normal: 5 },
        actionCost: "action",
      },
    ],
  },
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name = "Бой",
      gridWidth = 20,
      gridHeight = 15,
      cellSize = 40,
      addTestEnemies = true,
      campaignId,
      biome,
      difficulty,
      mapPresetId,
      archetype,
      isActClimax,
      enemies,
      useGenerator,
    } = body;

    // Если запрошена процедурная генерация или указан биом / пресет / сложность
    if (useGenerator || biome || difficulty || mapPresetId || (campaignId && !addTestEnemies)) {
      const tactical = await createTacticalEncounter({
        campaignId,
        name,
        gridWidth: gridWidth ?? 50,
        gridHeight: gridHeight ?? 50,
        biome,
        difficulty,
        mapPresetId,
        archetype,
        isActClimax,
        enemies,
      });

      const result = await db.combat.findUnique({
        where: { id: tactical.combatId },
        include: { combatants: true, mapElements: true },
      });

      return Response.json({
        combat: result ? hydrateCombat(result) : null,
        encounter: tactical,
      });
    }

    await db.combat.updateMany({
      where: {
        status: "active",
        campaignId: campaignId || null,
      },
      data: { status: "ended" },
    });

    const combat = await db.combat.create({
      data: {
        campaignId: campaignId || null,
        name,
        gridWidth,
        gridHeight,
        cellSize,
        status: "active",
        turnOrder: "[]",
        log: "[]",
      },
    });

    if (addTestEnemies) {
      const enemyStartX = Math.max(1, Math.min(14, gridWidth - 5));
      const centerY = Math.floor(gridHeight / 2);
      const positions = [
        { x: enemyStartX, y: Math.max(1, centerY - 2) },
        { x: enemyStartX, y: centerY },
        { x: enemyStartX, y: Math.min(gridHeight - 2, centerY + 2) },
      ];

      for (let i = 0; i < TEST_ENEMIES.length && i < positions.length; i++) {
        const e = TEST_ENEMIES[i];
        const pos = positions[i];
        const mods = {
          STR: e.strMod,
          DEX: e.dexMod,
          CON: e.conMod,
          INT: -2,
          WIS: 0,
          CHA: -1,
        };
        await db.combatant.create({
          data: {
            combatId: combat.id,
            name: e.name,
            type: "enemy",
            color: "#ef4444",
            x: pos.x,
            y: pos.y,
            hpMax: e.hpMax,
            hpCurrent: e.hpMax,
            ac: e.ac,
            speed: e.speed,
            dexMod: e.dexMod,
            initiative: 0,
            initiativeTiebreak: Math.floor(Math.random() * 1_000_000),
            className: "",
            level: 1,
            size: "medium",
            conditions: "[]",
            isHidden: false,
            hasActed: false,
            movementUsed: 0,
            actionUsed: false,
            bonusActionUsed: false,
            reactionUsed: false,
            attacksPerAction: 1,
            attacksMadeThisAction: 0,
            extraActions: 0,
            hotbar: JSON.stringify(
              e.attacks.map((a) => ({ id: a.id, type: "attack", name: a.name }))
            ),
            attacks: JSON.stringify(e.attacks),
            spells: "{}",
            abilities: "[]",
            concentration: null,
            // mod уже итоговый: движок не досчитывает бонус мастерства
            saves: JSON.stringify(
              Object.fromEntries(
                Object.entries(mods).map(([k, v]) => [k, { prof: false, mod: v }])
              )
            ),
            abilityMods: JSON.stringify(mods),
            profBonus: 2,
            isAIControlled: true,
          },
        });
      }
    }

    const result = await db.combat.findUnique({
      where: { id: combat.id },
      include: { combatants: true, mapElements: true },
    });

    return Response.json({ combat: result ? hydrateCombat(result) : null });
  } catch (error) {
    console.error("[combat/create] error:", error);
    return Response.json(
      {
        error: "Не удалось создать бой",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
