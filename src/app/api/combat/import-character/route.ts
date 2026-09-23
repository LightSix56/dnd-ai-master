// API: импорт персонажа из JSON листа в бой.
// Парсит боевые характеристики, определяет тип каждой атаки и её дальность,
// подтягивает классовые способности и заклинания из библиотеки.

import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { TYPE_COLORS, type Attack, type CombatAbility } from "@/lib/combat/types";
import { abilitiesForClass, attacksPerAction, sneakAttackDice } from "@/lib/combat/library-data";
import { abilityModifier, proficiencyBonus } from "@/lib/dnd/dice";
import { safeParse } from "@/lib/combat/serialize";

const DAMAGE_TYPE_RU: Record<string, string> = {
  кол: "piercing",
  руб: "slashing",
  дроб: "bludgeoning",
  огон: "fire",
  холод: "cold",
  молни: "lightning",
  электр: "lightning",
  гром: "thunder",
  звук: "thunder",
  яд: "poison",
  кислот: "acid",
  психическ: "psychic",
  некротическ: "necrotic",
  излучен: "radiant",
  силово: "force",
};

/** "1к6+4 кол" → [{dice:"1d6", mod:4, type:"piercing"}]; части через "и" дают несколько бросков */
function parseDamageString(damageStr: string): { dice: string; mod: number; type: string }[] {
  const parts = damageStr.split(/\s+и\s+/);
  let lastType = "slashing";

  const parsed = parts.map((part) => {
    const trimmed = part.trim();
    const diceMatch = trimmed.match(/(\d*)\s*[кk]\s*(\d+)/i);
    const dice = diceMatch ? `${diceMatch[1] || 1}d${diceMatch[2]}` : "";
    const modMatch = trimmed.match(/([+-]\s*\d+)/);
    const mod = modMatch ? parseInt(modMatch[1].replace(/\s/g, ""), 10) : 0;

    let type = "";
    const lower = trimmed.toLowerCase();
    for (const [ru, en] of Object.entries(DAMAGE_TYPE_RU)) {
      if (lower.includes(ru)) {
        type = en;
        break;
      }
    }
    if (type) lastType = type;
    return { dice, mod, type };
  });

  // Тип урона обычно указан один раз в конце строки — распространяем его назад
  return parsed.map((p) => ({ ...p, type: p.type || lastType }));
}

function parseBonus(bonusStr: string): number {
  const cleaned = String(bonusStr).trim().replace(/\s/g, "");
  return parseInt(cleaned, 10) || 0;
}

const ABILITY_RU_TO_EN: Record<string, string> = {
  СИЛ: "STR",
  ЛОВ: "DEX",
  ТЕЛ: "CON",
  ИНТ: "INT",
  МДР: "WIS",
  ХАР: "CHA",
};

interface WeaponProfile {
  kind: Attack["kind"];
  normal: number;
  long?: number;
  finesse?: boolean;
  thrown?: boolean;
}

/** Определяет тип и дальность оружия по названию */
function detectWeapon(rawName: string, className = ""): WeaponProfile {
  const n = rawName.toLowerCase();
  const isRogue =
    className.toLowerCase().includes("плут") ||
    className.toLowerCase().includes("вор") ||
    className.toLowerCase().includes("rogue");

  const has = (...words: string[]) => words.some((w) => n.includes(w));

  // Дальнобойное
  if (has("длинный лук", "длинн. лук", "longbow")) return { kind: "ranged", normal: 150, long: 600 };
  if (has("лук", "bow")) return { kind: "ranged", normal: 80, long: 320 };
  if (has("арбалет", "crossbow")) {
    if (has("ручн", "hand")) return { kind: "ranged", normal: 30, long: 120 };
    if (has("тяж", "heavy")) return { kind: "ranged", normal: 100, long: 400 };
    return { kind: "ranged", normal: 80, long: 320 };
  }
  if (has("праща", "sling")) return { kind: "ranged", normal: 30, long: 120 };
  if (has("дротик", "dart")) return { kind: "ranged", normal: 20, long: 60, finesse: true, thrown: true };

  // Заклинательные атаки
  if (has("терновый кнут", "thorn whip")) {
    return { kind: "spell", normal: 30 };
  }
  if (has("заклинан", "спелл", "луч", "снаряд", "spell")) {
    return { kind: "spell", normal: 60 };
  }

  // Ближний бой с фехтовальным свойством — важно для Скрытой атаки
  if (has("кинжал", "dagger")) return { kind: "melee", normal: 5, finesse: true, thrown: true };
  if (has("рапира", "rapier")) return { kind: "melee", normal: 5, finesse: true };
  if (has("короткий меч", "скимитар", "shortsword", "scimitar", "двойн", "парн", "dual")) {
    return { kind: "melee", normal: 5, finesse: true };
  }
  if (has("кнут", "whip")) return { kind: "melee", normal: 10, finesse: true };
  if (has("копь", "древко", "пика", "алебарда", "глефа", "spear", "pike", "halberd", "glaive")) {
    return { kind: "melee", normal: 10 };
  }
  if (has("ручной топор", "hand axe", "handaxe")) return { kind: "melee", normal: 5, thrown: true };
  if (has("когти", "claws")) return { kind: "melee", normal: 5 };
  if (has("посох", "дубинк", "staff", "shillelagh")) return { kind: "melee", normal: 5 };

  if (isRogue) {
    return { kind: "melee", normal: 5, finesse: true };
  }

  return { kind: "melee", normal: 5 };
}

/** Двойной удар тратит и Действие, и бонусное; вторая рука — бонусное */
function detectActionCost(rawName: string): Attack["actionCost"] {
  const n = rawName.toLowerCase();
  if (n.includes("двойн") || n.includes("две атаки") || n.includes("парн") || n.includes("залп") || n.includes("титаническ")) {
    return "action+bonus";
  }
  if (n.includes("вторая рука") || n.includes("второй рук") || n.includes("вторым") || n.includes("бонусн") || n.includes("offhand")) {
    return "bonus";
  }
  return "action";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      combatId,
      characterJson,
      type = "player",
      x,
      y,
    }: {
      combatId: string;
      characterJson: Record<string, any>;
      type?: "player" | "npc" | "enemy" | "companion";
      x?: number;
      y?: number;
    } = body;

    if (!combatId || !characterJson) {
      return Response.json({ error: "Нужны combatId и characterJson" }, { status: 400 });
    }

    const combat = await db.combat.findUnique({ where: { id: combatId } });
    if (!combat) return Response.json({ error: "Бой не найден" }, { status: 404 });

    const cj = characterJson;

    const name = cj.name || "Безымянный";
    const hpMax = cj.hpMax || 10;
    const hpCurrent = cj.hpCurrent ?? hpMax;
    const ac = cj.armorClass || cj.calculatedAC || cj.ac || 10;
    const speed = cj.speed || 30;
    const level = cj.level || 1;
    const className = cj.className || cj.class || "";
    const race = cj.race || "";
    const profBonus = proficiencyBonus(level);

    // Характеристики и спасброски
    const abilityScores = cj.abilityScores || cj.attributes || cj.stats || {};
    const abilityMods: Record<string, number> = {};
    for (const [ru, en] of Object.entries(ABILITY_RU_TO_EN)) {
      abilityMods[en] = abilityModifier(abilityScores[ru] ?? abilityScores[en] ?? 10);
    }

    const savesProf = cj.savingThrowProficiencies || {};
    const saves: Record<string, { prof: boolean; mod: number }> = {};
    for (const [ru, en] of Object.entries(ABILITY_RU_TO_EN)) {
      const prof = !!(savesProf[ru] ?? savesProf[en]);
      // mod уже итоговый — движок его не досчитывает
      saves[en] = { prof, mod: abilityMods[en] + (prof ? profBonus : 0) };
    }

    const dexMod = abilityMods.DEX ?? 0;

    // ============ АТАКИ ============
    const attacksRaw: any[] = cj.attacks || [];
    const attacks: Attack[] = attacksRaw.map((atk, idx) => {
      const rawName = atk.name || `Атака ${idx + 1}`;
      const weapon = detectWeapon(rawName, className);
      const damage = parseDamageString(atk.damageAndType || atk.damage || "1к4");

      return {
        id: `atk_${idx}_${Date.now()}`,
        name: rawName,
        attackBonus: parseBonus(atk.attackBonus ?? "+0"),
        damage,
        kind: weapon.kind,
        range: { normal: weapon.normal, long: weapon.long },
        actionCost: detectActionCost(rawName),
        finesse: weapon.finesse,
        thrown: weapon.thrown,
        description: atk.description,
      };
    });

    // ============ ЗАКЛИНАНИЯ ============
    const spellSlotsRaw = cj.spellSlots || {};
    const slots: Record<number, { max: number; used: number }> = {};
    for (const [levelStr, max] of Object.entries(spellSlotsRaw)) {
      const lvl = parseInt(levelStr, 10);
      if (lvl >= 1 && lvl <= 9 && typeof max === "number" && max > 0) {
        slots[lvl] = { max, used: 0 };
      }
    }

    const knownSpellNames: string[] = [];
    const collect = (entries: unknown) => {
      if (!Array.isArray(entries)) return;
      for (const entry of entries) {
        if (typeof entry === "string") knownSpellNames.push(entry);
        else if (entry && typeof entry === "object" && (entry as any).name) {
          knownSpellNames.push((entry as any).name);
        }
      }
    };
    const spellsByLevel = cj.spellByLevel || cj.spellsByLevel || {};
    for (const key of Object.keys(spellsByLevel)) collect(spellsByLevel[key]);
    collect(cj.cantrips);

    // Ищем в библиотеке без учёта регистра — листы пишут названия по-разному
    const library = await db.spellLibrary.findMany();
    const byLowerName = new Map(library.map((s) => [s.name.toLowerCase(), s]));
    const knownSpells: Array<{ id: string; name: string }> = [];
    for (const spellName of knownSpellNames) {
      const clean = spellName.replace(/\([^\)]*\)/g, "").trim().toLowerCase();
      const rawLower = spellName.trim().toLowerCase();
      let found = byLowerName.get(clean) || byLowerName.get(rawLower);
      if (!found) {
        const enMatch = spellName.match(/\(([^)]+)\)/);
        if (enMatch) {
          found = byLowerName.get(enMatch[1].trim().toLowerCase());
        }
      }
      if (found && !knownSpells.some((s) => s.id === found.id)) {
        knownSpells.push({ id: found.id, name: found.name });
      }
    }

    const spellAbilityRu = cj.spellcastingAbility || "";
    const spellAbility = ABILITY_RU_TO_EN[spellAbilityRu] || spellAbilityRu || "";
    const isCaster = !!cj.spellcastingClass || Object.keys(slots).length > 0 || knownSpells.length > 0;
    const castingAbility = spellAbility || (isCaster ? "WIS" : "");

    const spells = {
      slots,
      known: knownSpells.map((s) => s.id),
      prepared: knownSpells.map((s) => s.id),
      spellcastingAbility: castingAbility,
      spellSaveDC: castingAbility ? 8 + (abilityMods[castingAbility] ?? 0) + profBonus : 0,
      spellAttackBonus: castingAbility ? (abilityMods[castingAbility] ?? 0) + profBonus : 0,
    };

    // ============ КЛАССОВЫЕ СПОСОБНОСТИ ============
    // Берём из БД, чтобы подхватывались и добавленные вручную; иначе — из кода
    const libAbilities = await db.abilityLibrary.findMany();
    const matchedFromDb = libAbilities.filter((a) => {
      if (a.minLevel > level) return false;
      if (!a.className) return false;
      return a.className.trim().toLowerCase() === className.trim().toLowerCase();
    });

    const source = matchedFromDb.length
      ? matchedFromDb.map((a) => ({
          libraryId: a.id,
          name: a.name,
          parameters: safeParse<any>(a.parameters, undefined),
        }))
      : abilitiesForClass(className, level).map((a) => ({
          libraryId: undefined,
          name: a.name,
          parameters: a.parameters,
        }));

    const abilities: CombatAbility[] = source.map((a, idx) => {
      const params = a.parameters;
      // Скрытая атака масштабируется по уровню плута
      if (params && a.name.startsWith("Скрытая атака") && params.damage?.[0]) {
        params.damage[0].dice = sneakAttackDice(level);
      }
      const usesFormula = params?.usesFormula;
      const usesMax =
        usesFormula === "profBonus" ? profBonus : usesFormula === "level" ? level : params?.uses ?? 0;

      return {
        id: `abl_${idx}_${Date.now()}`,
        libraryId: a.libraryId,
        name: a.name,
        usesMax,
        usesUsed: 0,
        refresh: params?.refresh ?? "none",
        parameters: params,
      };
    });

    // ============ СБОРКА ============
    const color = TYPE_COLORS[type] || "#6b7280";
    const posX = x ?? (type === "enemy" ? combat.gridWidth - 2 : 1);
    const posY = y ?? Math.floor(combat.gridHeight / 2);

    const hotbar = [
      ...attacks.map((a) => ({ id: a.id, type: "attack" as const, name: a.name })),
      ...knownSpells.map((s) => ({
        id: `spell_${s.id}`,
        type: "spell" as const,
        name: s.name,
        libraryId: s.id,
      })),
      ...abilities.map((a) => ({ id: a.id, type: "ability" as const, name: a.name })),
    ];

    const combatant = await db.combatant.create({
      data: {
        combatId,
        name,
        type,
        color,
        x: posX,
        y: posY,
        hpMax,
        hpCurrent,
        hpTemp: cj.hpTemp || 0,
        ac,
        speed,
        initiative: 0,
        initiativeTiebreak: Math.floor(Math.random() * 1_000_000),
        dexMod,
        className,
        level,
        size: cj.size || "medium",
        conditions: "[]",
        isHidden: type === "enemy",
        hasActed: false,
        movementUsed: 0,
        actionUsed: false,
        bonusActionUsed: false,
        reactionUsed: false,
        attacksPerAction: attacksPerAction(className, level),
        attacksMadeThisAction: 0,
        extraActions: 0,
        hotbar: JSON.stringify(hotbar),
        attacks: JSON.stringify(attacks),
        spells: JSON.stringify(spells),
        abilities: JSON.stringify(abilities),
        concentration: null,
        saves: JSON.stringify(saves),
        abilityMods: JSON.stringify(abilityMods),
        profBonus,
        isAIControlled: type !== "player",
      },
    });

    return Response.json({
      success: true,
      combatant,
      parsed: {
        name,
        level,
        className,
        race,
        hpMax,
        ac,
        speed,
        dexMod,
        attacks: attacks.length,
        attacksPerAction: attacksPerAction(className, level),
        abilities: abilities.map((a) => a.name),
        spells: knownSpells.map((s) => s.name),
        unmatchedSpells: knownSpellNames.filter(
          (n) => !byLowerName.has(n.trim().toLowerCase())
        ),
        features: cj.featuresTraits || "",
      },
    });
  } catch (error) {
    console.error("[combat/import-character] error:", error);
    return Response.json(
      {
        error: "Не удалось импортировать персонажа",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
