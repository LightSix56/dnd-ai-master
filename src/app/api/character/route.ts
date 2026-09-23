// API: управление персонажами
import { db } from "@/lib/db";
import { proficiencyBonus } from "@/lib/dnd/dice";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId");
    const type = url.searchParams.get("type");

    if (!campaignId) {
      return Response.json({ error: "campaignId required" }, { status: 400 });
    }

    const where: Record<string, unknown> = { campaignId };
    if (type && type !== "all") where.type = type;

    const characters = await db.character.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    return Response.json({ characters });
  } catch (error) {
    console.error("[character] GET error:", error);
    return Response.json({ error: "Failed to fetch characters" }, { status: 500 });
  }
}

// Удаление персонажа: убирает его и из контекста сцены (он собирается из
// db.character), поэтому ошибочно созданный NPC перестаёт есть токены сразу.
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }

    const character = await db.character.findUnique({ where: { id } });
    if (!character) {
      return Response.json({ error: "Персонаж не найден" }, { status: 404 });
    }

    await db.character.delete({ where: { id } });

    return Response.json({ ok: true, name: character.name });
  } catch (error) {
    console.error("[character] DELETE error:", error);
    return Response.json({ error: "Failed to delete character" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { campaignId, ...data } = body;

    if (!campaignId) {
      return Response.json({ error: "campaignId required" }, { status: 400 });
    }

    const char = await db.character.create({
      data: {
        campaignId,
        name: data.name,
        type: data.type || "player",
        race: data.race,
        class: data.class,
        subclass: data.subclass,
        level: data.level || 1,
        background: data.background,
        str: data.str || 10,
        dex: data.dex || 10,
        con: data.con || 10,
        int: data.int || 10,
        wis: data.wis || 10,
        cha: data.cha || 10,
        hpMax: data.hpMax || 10,
        hpCurrent: data.hpCurrent ?? data.hpMax ?? 10,
        ac: data.ac || 10,
        speed: data.speed || 30,
        profBonus: proficiencyBonus(data.level || 1),
        inventory: data.inventory ? JSON.stringify(data.inventory) : "[]",
        spells: data.spells ? JSON.stringify(data.spells) : "[]",
        appearance: data.appearance,
        personality: data.personality,
        bonds: data.bonds,
        flaws: data.flaws,
        location: data.location,
        notes: data.notes,
      },
    });

    return Response.json({ character: char });
  } catch (error) {
    console.error("[character] POST error:", error);
    return Response.json({ error: "Failed to create character" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, inScene, location, notes, hpCurrent, hpTemp, relation, inventory } = body;

    if (!id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (inScene !== undefined) data.inScene = inScene;
    if (location !== undefined) data.location = location;
    if (notes !== undefined) data.notes = notes;
    if (hpCurrent !== undefined) data.hpCurrent = hpCurrent;
    if (hpTemp !== undefined) data.hpTemp = hpTemp;
    if (relation !== undefined) data.relation = relation;
    if (inventory !== undefined) {
      data.inventory = typeof inventory === "string" ? inventory : JSON.stringify(inventory);
    }

    const updated = await db.character.update({
      where: { id },
      data,
    });

    return Response.json({ character: updated });
  } catch (error) {
    console.error("[character] PATCH error:", error);
    return Response.json({ error: "Failed to update character" }, { status: 500 });
  }
}

