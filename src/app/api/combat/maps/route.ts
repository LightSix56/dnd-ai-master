// API: Каталог 24 тактических пресетов карт и применение карты к бою
import { ALL_PRESETS, getPresetById } from "@/lib/combat/maps/presets";
import { db } from "@/lib/db";
import { hydrateCombat, hydrateCombatant } from "@/lib/combat/serialize";
import { assignTacticalSpawns } from "@/lib/combat/maps/spawn-director";
import type { TacticalMapPreset } from "@/lib/combat/maps/types";


export async function GET() {
  try {
    const maps = ALL_PRESETS.map((p) => ({
      id: p.id,
      name: p.name,
      nameEn: p.nameEn,
      biome: p.biome,
      tags: p.tags,
      gridWidth: p.gridWidth,
      gridHeight: p.gridHeight,
      cellSizeFt: p.cellSizeFt,
      backgroundUrl: p.backgroundUrl || "",
      description: p.description || "",
      elementsCount: p.elements?.length || 0,
      spawnZonesCount: p.spawnZones?.length || 0,
    }));

    return Response.json({ maps });
  } catch (error) {
    console.error("[combat/maps GET] error:", error);
    return Response.json(
      { error: "Не удалось загрузить каталог карт", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
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
      const preset = getPresetById(mapPresetId);
      if (!preset) {
        return Response.json({ error: `Карта с ID '${mapPresetId}' не найдена` }, { status: 404 });
      }
      mapName = preset.name;
      gridWidth = preset.gridWidth;
      gridHeight = preset.gridHeight;
      backgroundUrl = preset.backgroundUrl || null;
      elements = preset.elements || [];
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
          customMap?.spawnZones && customMap.spawnZones.length > 0
            ? customMap.spawnZones
            : mapPresetId
            ? getPresetById(mapPresetId)?.spawnZones || []
            : [],
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
