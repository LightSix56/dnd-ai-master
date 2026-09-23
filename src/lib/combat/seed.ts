// Сидирование базовой библиотеки атак, спеллов и умений D&D 5e
import { db } from "@/lib/db";
import { ATTACK_LIBRARY, SPELL_LIBRARY, ABILITY_LIBRARY } from "./library-data";

export async function seedLibrary() {
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
    await db.attackLibrary.upsert({
      where: { name: atk.name },
      update: data,
      create: { name: atk.name, ...data },
    });
  }

  for (const spell of SPELL_LIBRARY) {
    const data = {
      level: spell.level,
      school: spell.school,
      parameters: JSON.stringify(spell.parameters),
    };
    await db.spellLibrary.upsert({
      where: { name: spell.name },
      update: data,
      create: { name: spell.name, ...data },
    });
  }

  for (const ability of ABILITY_LIBRARY) {
    const data = {
      source: ability.source,
      className: ability.className,
      minLevel: ability.minLevel,
      category: ability.category ?? "utility",
      parameters: JSON.stringify(ability.parameters),
    };
    await db.abilityLibrary.upsert({
      where: { name: ability.name },
      update: data,
      create: { name: ability.name, ...data },
    });
  }
}
