// API: применение своей карты (ссылка или .dd2vtt) к бою
import { denyCombatAccess } from "@/lib/auth/campaign-access";
import { db } from "@/lib/db";
import { hydrateCombat, hydrateCombatant } from "@/lib/combat/serialize";
import { assignTacticalSpawns } from "@/lib/combat/maps/spawn-director";
import type { TacticalMapPreset } from "@/lib/combat/maps/types";
import { parsePublicHttpsUrlSyntax } from "@/lib/security/ssrf";
import { safeErrorDetails } from "@/lib/security/errors";

function isSafeBackgroundUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) {
    return !trimmed.startsWith("//") && !trimmed.includes("..") && !trimmed.includes("\\");
  }
  if (trimmed.startsWith("procgen://")) {
    return /^[a-z0-9_/:?=&.-]+$/i.test(trimmed);
  }
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed.length <= 10 * 1024 * 1024;
  }
  if (trimmed.startsWith("https://")) {
    try {
      parsePublicHttpsUrlSyntax(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}


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

    const denied = await denyCombatAccess(req, combatId);
    if (denied) return denied;

    const existingCombat = await db.combat.findUnique({ where: { id: combatId }, select: { id: true } });
    if (!existingCombat) {
      return Response.json({ error: "Бой не найден" }, { status: 404 });
    }

    let mapName = "";
    let gridWidth = 20;
    let gridHeight = 20;
    let backgroundUrl: string | null = null;
    let elements: any[] = [];

    if (customMap) {
      mapName = String(customMap.name || "Пользовательская карта VTT").slice(0, 120);
      gridWidth = Math.max(5, Math.min(100, Math.round(Number(customMap.gridWidth) || 20)));
      gridHeight = Math.max(5, Math.min(100, Math.round(Number(customMap.gridHeight) || 20)));
      if (customMap.backgroundUrl != null && customMap.backgroundUrl !== "") {
        const bg = String(customMap.backgroundUrl);
        if (!isSafeBackgroundUrl(bg)) {
          return Response.json({ error: "Недопустимый URL фонового изображения карты" }, { status: 400 });
        }
        backgroundUrl = bg;
      }
      elements = Array.isArray(customMap.elements) ? customMap.elements.slice(0, 2000) : [];
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
      { error: "Не удалось применить карту", details: safeErrorDetails(error) },
      { status: 500 }
    );
  }
}
