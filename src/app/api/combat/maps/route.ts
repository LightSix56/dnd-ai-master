// API: применение своей карты (ссылка или .dd2vtt) к бою
import { db } from "@/lib/db";
import { hydrateCombat, hydrateCombatant } from "@/lib/combat/serialize";
import { assignTacticalSpawns } from "@/lib/combat/maps/spawn-director";
import type { TacticalMapPreset } from "@/lib/combat/maps/types";


// Готовые карты убраны: карта боя собирается генератором (procgen), сюда остаётся
// только своя карта по ссылке или из файла .dd2vtt
export async function GET() {
  return Response.json({ maps: [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { combatId, mapPresetId, customMap } = body;

    if (!combatId || (!mapPresetId && !customMap)) {
      return Response.json({ error: "combatId и либо mapPresetId, либо customMap обязательны" }, { status: 400 });
    }

    let mapName = "";
    let gridWidth = 20;
    let gridHeight = 20;
    let backgroundUrl: string | null = null;
    let elements: any[] = [];

    if (customMap) {
      mapName = customMap.name || "Пользовательская карта VTT";
      gridWidth = customMap.gridWidth || 20;
      gridHeight = customMap.gridHeight || 20;
      backgroundUrl = customMap.backgroundUrl || null;
      elements = customMap.elements || [];
    } else {
      return Response.json(
        { error: "Готовые карты больше не используются: карта боя собирается генератором" },
        { status: 404 }
      );
    }

    // Удаляем старые элементы карты боя
    await db.mapElement.deleteMany({ where: { combatId } });

    // Добавляем новые элементы карты
    for (const el of elements) {
      await db.mapElement.create({
        data: {
          combatId,
          type: el.type,
          x: el.x,
          y: el.y,
          width: el.width || 1,
          height: el.height || 1,
          properties: JSON.stringify(el.properties || {}),
        },
      });
    }

    // Обновляем размеры сетки боя и фоновое изображение
    await db.combat.update({
      where: { id: combatId },
      data: {
        name: mapName,
        gridWidth,
        gridHeight,
        backgroundUrl,
      },
    });

    // Перемещаем существующих бойцов на тактические позиции новой карты
    const currentCombat = await db.combat.findUnique({
      where: { id: combatId },
      include: { combatants: true },
    });

    if (currentCombat && currentCombat.combatants.length > 0) {
      const tacticalPreset: TacticalMapPreset = {
        id: mapPresetId || "custom-map",
        name: mapName,
        nameEn: mapName,
        biome: (customMap?.biome || "dungeon_prison") as any,
        tags: customMap?.tags || [],
        gridWidth,
        gridHeight,
        cellSizeFt: customMap?.cellSizeFt || 5,
        backgroundUrl: backgroundUrl || undefined,
        description: "",
        elements: elements,
        spawnZones:
          customMap?.spawnZones && customMap.spawnZones.length > 0 ? customMap.spawnZones : [],
      };

      const hydrated = currentCombat.combatants.map((c) => hydrateCombatant(c));
      const repositioned = assignTacticalSpawns(tacticalPreset, hydrated);

      for (const rep of repositioned) {
        await db.combatant.update({
          where: { id: rep.id },
          data: { x: rep.x, y: rep.y },
        });
      }
    }

    const updated = await db.combat.findUnique({
      where: { id: combatId },
      include: { combatants: true, mapElements: true },
    });

    return Response.json({
      success: true,
      mapName,
      combat: updated ? hydrateCombat(updated) : null,
    });
  } catch (error) {
    console.error("[combat/maps POST] error:", error);
    return Response.json(
      { error: "Не удалось применить карту", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
