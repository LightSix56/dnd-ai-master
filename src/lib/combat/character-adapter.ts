// src/lib/combat/character-adapter.ts
// Адаптер извлечения атак, заклинаний и способностей из карточки персонажа для боевого режима.
// Гарантирует: на тактическую карту встают ТОЛЬКО атаки из листа персонажа (без навязанных рапир/секир).

import type {
  Attack,
  CombatAbility,
  HotbarItem,
  SpellData,
  DamageRoll,
  ActionCost,
  AttackKind,
} from "./types";
import {
  abilitiesForClass,
  sneakAttackDice,
  SPELL_LIBRARY,
  ATTACK_LIBRARY,
} from "./library-data";
import { proficiencyBonus } from "@/lib/dnd/dice";

const DAMAGE_TYPE_RU: Record<string, string> = {
  кол: "piercing",
  руб: "slashing",
  дроб: "bludgeoning",
  огон: "fire",
  огн: "fire",
  плам: "fire",
  холод: "cold",
  молни: "lightning",
  электр: "lightning",
  гром: "thunder",
  звук: "thunder",
  яд: "poison",
  кислот: "acid",
  психическ: "psychic",
  псих: "psychic",
  некротическ: "necrotic",
  некрот: "necrotic",
  излучен: "radiant",
  свет: "radiant",
  силово: "force",
  piercing: "piercing",
  slashing: "slashing",
  bludgeoning: "bludgeoning",
  fire: "fire",
  cold: "cold",
  lightning: "lightning",
  thunder: "thunder",
  poison: "poison",
  acid: "acid",
  psychic: "psychic",
  necrotic: "necrotic",
  radiant: "radiant",
  force: "force",
};

export function normalizeClassName(rawClass: string): string {
  const lower = (rawClass || "").toLowerCase();
  if (/варвар|barbarian/i.test(lower)) return "Варвар";
  if (/воин|fighter/i.test(lower)) return "Воин";
  if (/плут|вор|rogue/i.test(lower)) return "Плут";
  if (/паладин|paladin/i.test(lower)) return "Паладин";
  if (/следопыт|рейнджер|ranger/i.test(lower)) return "Следопыт";
  if (/жрец|клирик|cleric/i.test(lower)) return "Жрец";
  if (/друид|druid/i.test(lower)) return "Друид";
  if (/монах|monk/i.test(lower)) return "Монах";
  if (/бард|bard/i.test(lower)) return "Бард";
  if (/волшебник|волшеб|маг|wizard/i.test(lower)) return "Волшебник";
  if (/колдун|варлок|warlock/i.test(lower)) return "Колдун";
  if (/чародей|сорк|sorcerer/i.test(lower)) return "Чародей";
  if (/изобретатель|artificer/i.test(lower)) return "Изобретатель";
  return rawClass;
}

/** "1к6+4 кол" или "1к6+3 и 1к6 кол" → [{dice:"1d6", mod:4, type:"piercing"}] */
export function parseDamageString(damageStr: string): DamageRoll[] {
  if (!damageStr || typeof damageStr !== "string") {
    return [{ dice: "1d4", mod: 0, type: "bludgeoning" }];
  }

  const parts = damageStr.split(/\s+и\s+/i);
  let lastType = "slashing";

  const parsed = parts.map((part) => {
    const trimmed = part.trim();
    const diceMatch = trimmed.match(/(\d*)\s*[кkd]\s*(\d+)/i);
    const dice = diceMatch ? `${diceMatch[1] || 1}d${diceMatch[2]}` : "1d6";
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

  return parsed.map((p) => ({ ...p, type: p.type || lastType }));
}

export function parseBonus(bonusStr: string | number | undefined | null): number {
  if (typeof bonusStr === "number") return bonusStr;
  if (!bonusStr) return 0;
  const cleaned = String(bonusStr).trim().replace(/\s/g, "");
  return parseInt(cleaned, 10) || 0;
}

export interface WeaponProfile {
  kind: AttackKind;
  normal: number;
  long?: number;
  finesse?: boolean;
  thrown?: boolean;
}

/** Определяет тип и дальность оружия по названию */
export function detectWeapon(rawName: string, className = ""): WeaponProfile {
  const n = rawName.toLowerCase();
  const isRogue = /плут|вор|rogue/i.test(className);

  const has = (...words: string[]) => words.some((w) => n.includes(w));

  // Дальнобойное оружие
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
  if (has("терновый кнут", "thorn whip")) return { kind: "spell", normal: 30 };
  if (has("заклинан", "спелл", "луч", "снаряд", "spell", "bolt", "blast")) return { kind: "spell", normal: 60 };

  // Ближний бой с фехтовальным свойством
  if (has("кинжал", "dagger")) return { kind: "melee", normal: 5, finesse: true, thrown: true };
  if (has("рапира", "rapier")) return { kind: "melee", normal: 5, finesse: true };
  if (has("короткий меч", "короткие мечи", "скимитар", "shortsword", "scimitar", "двойн", "парн", "dual", "клин")) {
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

/** Двойной удар тратит и Действие, и бонусное; вторая рука — бонусное действие */
export function detectActionCost(rawName: string): ActionCost {
  const n = rawName.toLowerCase();
  if (
    n.includes("двойн") ||
    n.includes("две атаки") ||
    n.includes("парн") ||
    n.includes("залп") ||
    n.includes("титаническ") ||
    n.includes("двумя") ||
    n.includes("двумя сразу") ||
    n.includes("обеими")
  ) {
    return "action+bonus";
  }
  if (
    n.includes("вторая рука") ||
    n.includes("второй рук") ||
    n.includes("второй клинок") ||
    n.includes("2 рука") ||
    n.includes("2-я рука") ||
    n.includes("вторым") ||
    n.includes("бонусн") ||
    n.includes("offhand") ||
    n.includes("щитом")
  ) {
    return "bonus";
  }
  if (n.includes("реакц") || n.includes("провоцир")) {
    return "reaction";
  }
  return "action";
}

/** Извлекает сырые атаки из любых полей персонажа (JSON snapshot, notes, inventory) */
function collectRawAttacks(char: Record<string, any>): any[] {
  const attacks: any[] = [];

  // 1. Попытка прочесть JSON из notes (сохраняется при входе в сетевую комнату и импорте)
  if (char.notes && typeof char.notes === "string") {
    try {
      const parsedNotes = JSON.parse(char.notes);
      const list =
        parsedNotes.attacks ||
        parsedNotes.data?.attacks ||
        parsedNotes.characterSnapshot?.attacks ||
        parsedNotes.character?.attacks;
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    } catch {
      // notes — это обычный текст, ищем блок "Атаки:"
      const match = char.notes.match(/Атаки:\s*([^\n\r]+)/i);
      if (match && match[1]) {
        const parts = match[1].split(";");
        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          // Пример: "Короткий меч (1 рука) +5 1к6+3 кол"
          const atkMatch = trimmed.match(/^(.+?)\s+([+-]\d+)\s+(.+)$/);
          if (atkMatch) {
            attacks.push({
              name: atkMatch[1].trim(),
              attackBonus: atkMatch[2].trim(),
              damageAndType: atkMatch[3].trim(),
            });
          } else {
            attacks.push({ name: trimmed, attackBonus: "+0", damageAndType: "1к6" });
          }
        }
        if (attacks.length > 0) return attacks;
      }
    }
  }

  // 2. Попытка прочесть из inventory
  if (char.inventory) {
    try {
      const inv = typeof char.inventory === "string" ? JSON.parse(char.inventory) : char.inventory;
      if (Array.isArray(inv)) {
        const directAttacks = inv.filter(
          (item) => item && typeof item === "object" && (item.attackBonus !== undefined || item.damageAndType !== undefined)
        );
        if (directAttacks.length > 0) return directAttacks;
      } else if (inv && typeof inv === "object" && Array.isArray(inv.attacks)) {
        return inv.attacks;
      }
    } catch {
      // ignore
    }
  }

  // 3. Прямое свойство attacks
  if (Array.isArray(char.attacks) && char.attacks.length > 0) {
    return char.attacks;
  }

  return attacks;
}

/**
 * Извлекает атаки персонажа из его карточки.
 * Если на карточке записаны атаки (например, короткие мечи плута),
 * возвращаются СТРОГО ОНИ без генерации классовых дефолтов.
 */
export function extractAttacksFromCharacter(
  char: Record<string, any>,
  dexMod: number,
  strMod: number,
  profBonus: number
): Attack[] {
  const rawAttacks = collectRawAttacks(char);
  if (!rawAttacks || rawAttacks.length === 0) {
    return [];
  }

  const charClass = String(char.class || char.className || "");

  return rawAttacks.map((atk, idx) => {
    const rawName = String(atk.name || `Атака ${idx + 1}`).trim();
    const weapon = detectWeapon(rawName, charClass);
    const damage = parseDamageString(atk.damageAndType || atk.damage || (atk.damageDice ? `${atk.damageDice} ${atk.damageType || "кол"}` : "1к6"));

    let bonus = parseBonus(atk.attackBonus);
    if (bonus === 0 && !String(atk.attackBonus).includes("0")) {
      const isFinesseOrRanged = weapon.finesse || weapon.kind === "ranged";
      const mod = isFinesseOrRanged ? Math.max(dexMod, strMod) : strMod;
      bonus = mod + profBonus;
    }

    return {
      id: `atk_p_${char.id || "char"}_${idx}_${Date.now()}`,
      name: rawName,
      attackBonus: bonus,
      damage,
      kind: weapon.kind,
      range: { normal: weapon.normal, long: weapon.long },
      actionCost: atk.actionCost || detectActionCost(rawName),
      finesse: weapon.finesse,
      thrown: weapon.thrown,
      description: atk.description,
    };
  });
}

/**
 * Извлекает заклинания персонажа из карточки, подтягивает описания из библиотеки
 * и формирует SpellData и элементы для хотбара.
 */
export function extractSpellsFromCharacter(
  char: Record<string, any>,
  intMod: number,
  wisMod: number,
  chaMod: number,
  profBonus: number
): { spells: SpellData; spellHotbar: HotbarItem[] } {
  let sheetObj: any = null;
  if (char.notes && typeof char.notes === "string") {
    try {
      sheetObj = JSON.parse(char.notes);
    } catch {
      sheetObj = null;
    }
  }

  const lowerClass = String(char.class || char.className || "").trim().toLowerCase();
  const isInt = /волшеб|маг|wizard|изобретатель|artificer/i.test(lowerClass);
  const isWis = /жрец|cleric|друид|druid|следопыт|ranger/i.test(lowerClass);
  const isCha = /чародей|sorcerer|колдун|warlock|бард|bard|паладин|paladin/i.test(lowerClass);
  const isCaster = isInt || isWis || isCha;

  const castAbility = isInt ? "INT" : isWis ? "WIS" : isCha ? "CHA" : "";
  const castMod = isInt ? intMod : isWis ? wisMod : isCha ? chaMod : 0;

  // 1. Извлекаем слоты
  const slots: Record<number, { max: number; used: number }> = {};
  let parsedSpellsObj: any = null;
  if (typeof char.spells === "string") {
    try {
      parsedSpellsObj = JSON.parse(char.spells);
    } catch {
      parsedSpellsObj = null;
    }
  } else if (typeof char.spells === "object" && char.spells !== null) {
    parsedSpellsObj = char.spells;
  }

  const rawSlots =
    sheetObj?.spellSlots ||
    char.spellSlots ||
    parsedSpellsObj?.slots;

  if (rawSlots && typeof rawSlots === "object") {
    for (const [lvlStr, val] of Object.entries(rawSlots)) {
      const lvl = parseInt(lvlStr, 10);
      if (lvl >= 1 && lvl <= 9) {
        const max =
          typeof val === "number"
            ? val
            : typeof (val as any)?.totalSlots === "number"
            ? (val as any).totalSlots
            : typeof (val as any)?.max === "number"
            ? (val as any).max
            : 0;
        const used =
          typeof (val as any)?.expendedSlots === "number"
            ? (val as any).expendedSlots
            : typeof (val as any)?.used === "number"
            ? (val as any).used
            : 0;
        if (max > 0) {
          slots[lvl] = { max, used };
        }
      }
    }
  }

  // Парсинг слотов из текстовых заметок (например "Ячейки заклинаний: 1 ур.: 4, 2 ур.: 2")
  if (Object.keys(slots).length === 0 && char.notes && typeof char.notes === "string") {
    const slotMatches = char.notes.matchAll(/(\d+)\s*ур\.:\s*(\d+)/gi);
    for (const m of slotMatches) {
      const lvl = parseInt(m[1], 10);
      const count = parseInt(m[2], 10);
      if (lvl >= 1 && lvl <= 9 && count > 0) {
        slots[lvl] = { max: count, used: 0 };
      }
    }
  }

  // Fallback слотов по классу и уровню
  if (Object.keys(slots).length === 0 && isCaster) {
    const lvl = Math.max(1, char.level || 1);
    if (/паладин|paladin|следопыт|ranger/i.test(lowerClass)) {
      if (lvl >= 2) slots[1] = { max: 2, used: 0 };
      if (lvl >= 3) slots[1] = { max: 3, used: 0 };
      if (lvl >= 5) { slots[1] = { max: 4, used: 0 }; slots[2] = { max: 2, used: 0 }; }
    } else if (/колдун|warlock/i.test(lowerClass)) {
      const pactSlots = lvl >= 11 ? 3 : lvl >= 2 ? 2 : 1;
      const pactLevel = Math.min(5, Math.ceil(lvl / 2));
      slots[pactLevel] = { max: pactSlots, used: 0 };
    } else {
      if (lvl === 1) slots[1] = { max: 2, used: 0 };
      else if (lvl === 2) slots[1] = { max: 3, used: 0 };
      else if (lvl >= 3) {
        slots[1] = { max: 4, used: 0 };
        slots[2] = { max: lvl >= 4 ? 3 : 2, used: 0 };
        if (lvl >= 5) slots[3] = { max: 2, used: 0 };
      }
    }
  }

  // 2. Собираем имена известных заклинаний и заговоров
  const spellNames: string[] = [];

  const addNames = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (typeof item === "string" && item.trim()) {
        spellNames.push(item.trim());
      } else if (item && typeof item === "object" && (item as any).name) {
        spellNames.push(String((item as any).name).trim());
      }
    }
  };

  addNames(sheetObj?.cantrips);
  addNames(char.cantrips);

  const spellsByLvl = sheetObj?.spellsByLevel || char.spellsByLevel;
  if (spellsByLvl && typeof spellsByLvl === "object") {
    for (const lvlList of Object.values(spellsByLvl)) {
      addNames(lvlList);
    }
  }

  // Если char.spells — массив строк
  if (Array.isArray(char.spells)) {
    addNames(char.spells);
  } else if (typeof char.spells === "string") {
    try {
      const parsed = JSON.parse(char.spells);
      if (Array.isArray(parsed)) addNames(parsed);
      else if (Array.isArray(parsed?.known)) addNames(parsed.known);
    } catch {
      // plain text
      const matches = char.spells.matchAll(/([А-Яа-яA-Za-z\s-]+)\s*\([^)]*\)/g);
      for (const m of matches) {
        spellNames.push(m[1].trim());
      }
    }
  }

  // 3. Сопоставляем заклинания с SPELL_LIBRARY
  const byLowerName = new Map<string, (typeof SPELL_LIBRARY)[0]>();
  for (const s of SPELL_LIBRARY) {
    byLowerName.set(s.name.toLowerCase(), s);
  }

  const knownSpells: Array<{ id: string; name: string }> = [];
  const spellHotbar: HotbarItem[] = [];

  for (const rawName of spellNames) {
    const clean = rawName.replace(/\([^\)]*\)/g, "").trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();

    let found = byLowerName.get(lower);
    if (!found) {
      // Поиск по вхождению
      for (const [name, def] of byLowerName.entries()) {
        if (name.includes(lower) || lower.includes(name)) {
          found = def;
          break;
        }
      }
    }

    const spellId = found ? found.name.toLowerCase().replace(/\s+/g, "_") : clean.toLowerCase().replace(/\s+/g, "_");
    const displayName = found ? found.name : clean;

    if (!knownSpells.some((k) => k.id === spellId)) {
      knownSpells.push({ id: spellId, name: displayName });
      spellHotbar.push({
        id: `spell_${spellId}`,
        type: "spell",
        name: displayName,
        libraryId: spellId,
      });
    }
  }

  const spellData: SpellData = {
    slots,
    known: knownSpells.map((s) => s.id),
    prepared: knownSpells.map((s) => s.id),
    spellcastingAbility: castAbility || (isCaster ? "WIS" : ""),
    spellSaveDC: castAbility ? 8 + profBonus + castMod : 0,
    spellAttackBonus: castAbility ? profBonus + castMod : 0,
  };

  return { spells: spellData, spellHotbar };
}

/**
 * Извлекает классовые способности персонажа с корректным масштабированием
 * (Скрытая атака плута, Всплеск действий, Ярость и т.д.).
 */
export function extractAbilitiesFromCharacter(
  char: Record<string, any>,
  level: number,
  profBonus: number,
  abilityMods: Record<string, number>
): CombatAbility[] {
  const rawClass = String(char.class || char.className || "");
  const className = normalizeClassName(rawClass);
  const baseAbilities = abilitiesForClass(className, level);

  return baseAbilities.map((a, idx) => {
    const params = a.parameters ? { ...a.parameters } : undefined;

    // Скрытая атака масштабируется по уровню плута (1к6, 2к6, 3к6...)
    if (params && a.name.includes("Скрытая атака")) {
      const dice = sneakAttackDice(level);
      params.damage = [{ dice, mod: 0, type: "piercing" }];
      params.description = `+${dice} урона при атаке оружием с фехтовальным свойством или дальнего боя при преимуществе.`;
    }

    const usesFormula = (params as any)?.usesFormula;
    let usesMax =
      usesFormula === "profBonus"
        ? profBonus
        : usesFormula === "level"
        ? level
        : (params as any)?.uses ?? 0;

    // Специальные формулы использований
    if (a.name.includes("Вдохновение") && abilityMods.CHA) {
      usesMax = Math.max(1, abilityMods.CHA);
    }

    return {
      id: `abl_p_${char.id || "char"}_${idx}_${Date.now()}`,
      name: a.name,
      usesMax,
      usesUsed: 0,
      refresh: (params as any)?.refresh ?? "none",
      parameters: params,
    };
  });
}
