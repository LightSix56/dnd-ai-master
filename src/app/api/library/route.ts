// API библиотеки: список ударов, заклинаний и способностей + создание/правка/удаление.
import { db } from "@/lib/db";
import { safeParse } from "@/lib/combat/serialize";
import type { ActionParameters, DamageRoll, AttackKind, ActionCost } from "@/lib/combat/types";

export async function GET() {
  try {
    const [attacks, spells, abilities] = await Promise.all([
      db.attackLibrary.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] }),
      db.spellLibrary.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] }),
      db.abilityLibrary.findMany({ orderBy: [{ className: "asc" }, { minLevel: "asc" }] }),
    ]);

    const formattedAttacks = attacks.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind as AttackKind,
      attackBonus: a.attackBonus,
      damage: safeParse<DamageRoll[]>(a.damage, []),
      rangeNormal: a.rangeNormal,
      rangeLong: a.rangeLong,
      finesse: a.finesse,
      actionCost: (a.actionCost || "action") as ActionCost,
      description: a.description,
    }));

    const formattedSpells = spells.map((s) => ({
      id: s.id,
      name: s.name,
      level: s.level,
      school: s.school,
      parameters: safeParse<ActionParameters>(s.parameters, {} as ActionParameters),
    }));

    const formattedAbilities = abilities.map((a) => {
      const params = safeParse<ActionParameters>(a.parameters, {} as ActionParameters);
      const isDamage =
        a.category === "damage" ||
        (Array.isArray(params.damage) && params.damage.length > 0 && !!params.damage[0]?.dice);
      return {
        id: a.id,
        name: a.name,
        source: a.source,
        className: a.className,
        minLevel: a.minLevel,
        category: (isDamage ? "damage" : "utility") as "damage" | "utility",
        parameters: params,
      };
    });

    const damageAbilities = formattedAbilities.filter((a) => a.category === "damage");
    const utilityAbilities = formattedAbilities.filter((a) => a.category === "utility");

    return Response.json({
      attacks: formattedAttacks,
      spells: formattedSpells,
      damageAbilities,
      utilityAbilities,
      abilities: formattedAbilities,
    });
  } catch (error) {
    console.error("[library] GET error:", error);
    return Response.json({ error: "Не удалось загрузить библиотеку" }, { status: 500 });
  }
}

/** Создание или обновление записи библиотеки */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      kind,
      id,
      name,
      level = 0,
      school = "",
      className = "",
      minLevel = 1,
      source = "manual",
      category = "utility",
      attackKind = "melee",
      attackBonus = 0,
      damage = [],
      rangeNormal = 5,
      rangeLong = null,
      finesse = false,
      actionCost = "action",
      description = "",
      parameters,
    }: {
      kind: "attack" | "spell" | "ability";
      id?: string;
      name?: string;
      level?: number;
      school?: string;
      className?: string;
      minLevel?: number;
      source?: string;
      category?: "damage" | "utility";
      attackKind?: AttackKind;
      attackBonus?: number;
      damage?: DamageRoll[];
      rangeNormal?: number;
      rangeLong?: number | null;
      finesse?: boolean;
      actionCost?: ActionCost;
      description?: string;
      parameters?: ActionParameters;
    } = body;

    if (!id && !name?.trim()) {
      return Response.json({ error: "Нужно название" }, { status: 400 });
    }

    if (kind === "attack") {
      const cleanName = (name || "").trim();
      const data = {
        name: cleanName,
        kind: attackKind,
        attackBonus: Number(attackBonus) || 0,
        damage: JSON.stringify(damage),
        rangeNormal: Number(rangeNormal) || 5,
        rangeLong: rangeLong ? Number(rangeLong) : null,
        finesse: Boolean(finesse),
        actionCost: actionCost || "action",
        description: description || "",
      };

      const row = id
        ? await db.attackLibrary.update({ where: { id }, data })
        : await db.attackLibrary.create({ data });

      return Response.json({ success: true, id: row.id, name: row.name });
    }

    if (kind === "spell") {
      if (!parameters) {
        return Response.json({ error: "Нужны параметры заклинания" }, { status: 400 });
      }
      const serialized = JSON.stringify(parameters);
      const row = id
        ? await db.spellLibrary.update({
            where: { id },
            data: { name: name?.trim(), level: Number(level) || 0, school, parameters: serialized },
          })
        : await db.spellLibrary.create({
            data: { name: name!.trim(), level: Number(level) || 0, school, parameters: serialized },
          });

      return Response.json({ success: true, id: row.id, name: row.name });
    }

    if (kind === "ability") {
      if (!parameters) {
        return Response.json({ error: "Нужны параметры способности" }, { status: 400 });
      }
      const serialized = JSON.stringify(parameters);
      const row = id
        ? await db.abilityLibrary.update({
            where: { id },
            data: {
              name: name?.trim(),
              className: className || "",
              minLevel: Number(minLevel) || 1,
              source: source || "manual",
              category: category || "utility",
              parameters: serialized,
            },
          })
        : await db.abilityLibrary.create({
            data: {
              name: name!.trim(),
              className: className || "",
              minLevel: Number(minLevel) || 1,
              source: source || "manual",
              category: category || "utility",
              parameters: serialized,
            },
          });

      return Response.json({ success: true, id: row.id, name: row.name });
    }

    return Response.json({ error: "Неизвестный тип элемента библиотеки" }, { status: 400 });
  } catch (error) {
    console.error("[library] POST error:", error);
    return Response.json(
      {
        error: "Не удалось сохранить в библиотеку",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { kind, id }: { kind: "attack" | "spell" | "ability"; id: string } = await req.json();
    if (!id) return Response.json({ error: "Нужен id" }, { status: 400 });

    if (kind === "attack") await db.attackLibrary.delete({ where: { id } });
    else if (kind === "spell") await db.spellLibrary.delete({ where: { id } });
    else await db.abilityLibrary.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[library] DELETE error:", error);
    return Response.json({ error: "Не удалось удалить запись" }, { status: 500 });
  }
}
