import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_PRESETS } from "@/lib/combat/preset-data";
import type { CharacterPreset } from "@/lib/combat/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // player, enemy, etc.
    const query = searchParams.get("q")?.toLowerCase();

    // 1. Извлекаем кастомные пресеты из базы данных
    let dbPresets: CharacterPreset[] = [];
    try {
      const records = await (db as any).characterPreset.findMany({
        orderBy: { createdAt: "desc" },
      });
      dbPresets = records.map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        className: r.className,
        level: r.level,
        cr: r.cr,
        size: r.size,
        color: r.color,
        icon: r.icon,
        hpMax: r.hpMax,
        ac: r.ac,
        speed: r.speed,
        attacksPerAction: r.attacksPerAction,
        abilityMods: JSON.parse(r.abilityMods || "{}"),
        saves: JSON.parse(r.saves || "{}"),
        profBonus: r.profBonus,
        attacks: JSON.parse(r.attacks || "[]"),
        spells: JSON.parse(r.spells || "{}"),
        abilities: JSON.parse(r.abilities || "[]"),
        description: r.description,
        tags: JSON.parse(r.tags || "[]"),
        isTemplate: false,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    } catch (e) {
      console.warn("Could not load presets from DB, using memory/defaults:", e);
    }

    // 2. Объединяем с дефолтными системными шаблонами (Бестиарием)
    let allPresets: CharacterPreset[] = [...DEFAULT_PRESETS, ...dbPresets];

    if (type) {
      allPresets = allPresets.filter((p) => p.type === type);
    }

    if (query) {
      allPresets = allPresets.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.className.toLowerCase().includes(query) ||
          p.tags?.some((t) => t.toLowerCase().includes(query)) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({ presets: allPresets });
  } catch (error: any) {
    console.error("GET /api/combat/presets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      type = "enemy",
      className = "",
      level = 1,
      cr,
      size = "medium",
      color = "#6b7280",
      icon,
      hpMax = 10,
      ac = 10,
      speed = 30,
      attacksPerAction = 1,
      abilityMods = {},
      saves = {},
      profBonus = 2,
      attacks = [],
      spells = { slots: {}, known: [] },
      abilities = [],
      description = "",
      tags = [],
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Имя пресета обязательно" }, { status: 400 });
    }

    const data = {
      name,
      type,
      className,
      level: Number(level),
      cr: cr ? String(cr) : null,
      size,
      color,
      icon: icon || null,
      hpMax: Number(hpMax),
      ac: Number(ac),
      speed: Number(speed),
      attacksPerAction: Number(attacksPerAction),
      abilityMods: JSON.stringify(abilityMods),
      saves: JSON.stringify(saves),
      profBonus: Number(profBonus),
      attacks: JSON.stringify(attacks),
      spells: JSON.stringify(spells),
      abilities: JSON.stringify(abilities),
      description: description || "",
      tags: JSON.stringify(tags),
      isTemplate: false,
    };

    let result;
    if (id && !id.startsWith("preset-")) {
      result = await (db as any).characterPreset.upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });
    } else {
      result = await (db as any).characterPreset.create({
        data,
      });
    }

    const preset: CharacterPreset = {
      id: result.id,
      name: result.name,
      type: result.type as any,
      className: result.className,
      level: result.level,
      cr: result.cr,
      size: result.size as any,
      color: result.color,
      icon: result.icon,
      hpMax: result.hpMax,
      ac: result.ac,
      speed: result.speed,
      attacksPerAction: result.attacksPerAction,
      abilityMods: JSON.parse(result.abilityMods),
      saves: JSON.parse(result.saves),
      profBonus: result.profBonus,
      attacks: JSON.parse(result.attacks),
      spells: JSON.parse(result.spells),
      abilities: JSON.parse(result.abilities),
      description: result.description,
      tags: JSON.parse(result.tags),
      isTemplate: false,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };

    return NextResponse.json({ preset });
  } catch (error: any) {
    console.error("POST /api/combat/presets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }

    if (id.startsWith("preset-")) {
      return NextResponse.json({ error: "Нельзя удалять системные базовые пресеты" }, { status: 400 });
    }

    await (db as any).characterPreset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error("DELETE /api/combat/presets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
