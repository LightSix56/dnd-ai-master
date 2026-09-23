import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_PRESETS, createCombatantFromPreset } from "@/lib/combat/preset-data";
import { loadDefaultManifest, loadMonsterDefinition } from "@/lib/combat/encounters/encounter-generator";
import { monsterDefinitionToCombatant } from "@/lib/combat/monsters/monster-adapter";
import type { CharacterPreset, Combatant } from "@/lib/combat/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { combatId, presetId, slug, monsterSlug, preset: customPreset, count = 1, startX, startY } = body;
    const targetSlug = slug || monsterSlug;

    if (!combatId) {
      return NextResponse.json({ error: "combatId обязателен" }, { status: 400 });
    }

    const combat = await db.combat.findUnique({
      where: { id: combatId },
      include: { combatants: true, mapElements: true },
    });

    if (!combat) {
      return NextResponse.json({ error: "Бой не найден" }, { status: 404 });
    }

    // Проверяем, не является ли запрос спавном монстра из бестиария 2,875 существ
    let monsterDef: any = null;
    if (targetSlug) {
      const manifest = loadDefaultManifest();
      const entry = manifest.find(
        (m) =>
          m.slug.toLowerCase() === targetSlug.toLowerCase() ||
          m.id.toLowerCase() === targetSlug.toLowerCase() ||
          m.name.toLowerCase() === targetSlug.toLowerCase() ||
          m.nameEn.toLowerCase() === targetSlug.toLowerCase()
      );
      if (entry) {
        monsterDef = loadMonsterDefinition(entry.slug, entry);
      }
    }

    // Ищем обычный пресет, если не найден монстр
    let targetPreset: CharacterPreset | undefined = customPreset;
    if (!monsterDef && !targetPreset && presetId) {
      targetPreset = DEFAULT_PRESETS.find((p) => p.id === presetId);
      if (!targetPreset) {
        const dbP = await (db as any).characterPreset?.findUnique({
          where: { id: presetId },
        });
        if (dbP) {
          targetPreset = {
            id: dbP.id,
            name: dbP.name,
            type: dbP.type,
            className: dbP.className,
            level: dbP.level,
            cr: dbP.cr,
            size: dbP.size,
            color: dbP.color,
            icon: dbP.icon,
            hpMax: dbP.hpMax,
            ac: dbP.ac,
            speed: dbP.speed,
            attacksPerAction: dbP.attacksPerAction,
            abilityMods: JSON.parse(dbP.abilityMods || "{}"),
            saves: JSON.parse(dbP.saves || "{}"),
            profBonus: dbP.profBonus,
            attacks: JSON.parse(dbP.attacks || "[]"),
            spells: JSON.parse(dbP.spells || "{}"),
            abilities: JSON.parse(dbP.abilities || "[]"),
            description: dbP.description,
            tags: JSON.parse(dbP.tags || "[]"),
            isTemplate: false,
          };
        }
      }

      // Если в пресетах не нашли, возможно presetId это slug монстра
      if (!targetPreset) {
        const manifest = loadDefaultManifest();
        const entry = manifest.find((m) => m.slug.toLowerCase() === presetId.toLowerCase());
        if (entry) {
          monsterDef = loadMonsterDefinition(entry.slug, entry);
        }
      }
    }

    if (!targetPreset && !monsterDef) {
      return NextResponse.json({ error: "Пресет или существо из бестиария не найдены" }, { status: 404 });
    }

    // Занятые клетки
    const occupied = new Set(combat.combatants.map((c) => c.x + "," + c.y));
    const walls = new Set(
      combat.mapElements
        .filter((e) => e.type === "wall" || e.type === "obstacle")
        .map((e) => e.x + "," + e.y)
    );

    const gridW = combat.gridWidth;
    const gridH = combat.gridHeight;

    // Функция поиска свободной клетки рядом с точкой
    function findFreeCell(originX: number, originY: number): { x: number; y: number } {
      for (let r = 0; r < 15; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            const x = originX + dx;
            const y = originY + dy;
            if (x >= 0 && x < gridW && y >= 0 && y < gridH) {
              const key = x + "," + y;
              if (!occupied.has(key) && !walls.has(key)) {
                occupied.add(key);
                return { x, y };
              }
            }
          }
        }
      }
      return { x: originX, y: originY };
    }

    // Определение стартовой позиции по умолчанию
    const isEnemy = monsterDef ? true : targetPreset!.type === "enemy";
    const defaultX = startX ?? (isEnemy ? combat.gridWidth - 4 : 3);
    const defaultY = startY ?? Math.floor(combat.gridHeight / 2);

    const spawnCount = Math.min(Math.max(1, Number(count)), 10);
    const createdList: any[] = [];
    const newTurnOrderIds: string[] = JSON.parse(combat.turnOrder || "[]");

    for (let i = 0; i < spawnCount; i++) {
      const cell = findFreeCell(defaultX, defaultY + (i % 3) * (i % 2 === 0 ? 1 : -1));

      let template: Combatant;
      if (monsterDef) {
        const instanceName = spawnCount > 1 ? `${monsterDef.name} ${i + 1}` : monsterDef.name;
        template = monsterDefinitionToCombatant(monsterDef, {
          id: `c_mon_${Date.now()}_${i}`,
          combatId,
          type: "enemy",
          color: "#ef4444",
          x: cell.x,
          y: cell.y,
          isAIControlled: true,
        });
        template.name = instanceName;
      } else {
        const customName =
          spawnCount > 1
            ? `${targetPreset!.name} ${i + 1}`
            : targetPreset!.name;
        template = createCombatantFromPreset(targetPreset!, cell, customName);
      }

      // Бросок инициативы: 1d20 + dexMod
      const d20 = Math.floor(Math.random() * 20) + 1;
      const init = d20 + (template.dexMod || 0);

      const dbCombatant = await db.combatant.create({
        data: {
          combatId,
          name: template.name,
          type: template.type,
          color: template.color || "#ef4444",
          x: template.x,
          y: template.y,
          hpCurrent: template.hpCurrent,
          hpMax: template.hpMax,
          hpTemp: template.hpTemp || 0,
          ac: template.ac,
          speed: template.speed,
          initiative: init,
          dexMod: template.dexMod,
          className: template.className || "",
          level: template.level || 1,
          size: template.size || "medium",
          attacksPerAction: template.attacksPerAction || 1,
          attacks: JSON.stringify(template.attacks || []),
          spells: JSON.stringify(template.spells || {}),
          abilities: JSON.stringify(template.abilities || []),
          saves: JSON.stringify(template.saves || {}),
          abilityMods: JSON.stringify(template.abilityMods || {}),
          profBonus: template.profBonus || 2,
          isAIControlled: template.isAIControlled ?? true,
        },
      });

      createdList.push(dbCombatant);
      newTurnOrderIds.push(dbCombatant.id);
    }

    // Логируем событие спавна
    const log = JSON.parse(combat.log || "[]");
    const spawnedTitle = monsterDef ? monsterDef.name : targetPreset!.name;
    const logMessage =
      spawnCount > 1
        ? `⚔️ На поле боя заспавнена группа: ${spawnedTitle} (×${spawnCount})`
        : `⚔️ На поле боя заспавнен боец: ${spawnedTitle}`;

    log.push({
      round: combat.round,
      text: logMessage,
      kind: "system",
      actor: "DM",
    });

    await db.combat.update({
      where: { id: combatId },
      data: {
        turnOrder: JSON.stringify(newTurnOrderIds),
        log: JSON.stringify(log),
      },
    });

    return NextResponse.json({
      success: true,
      spawnedCount: createdList.length,
      spawned: createdList,
    });
  } catch (error: any) {
    console.error("POST /api/combat/presets/spawn error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
