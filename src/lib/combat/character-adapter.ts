// src/lib/combat/character-adapter.ts
// Адаптер извлечения атак, заклинаний и способностей из карточки персонажа для боевого режима.
// Гарантирует: на тактическую карту встают ТОЛЬКО атаки из листа персонажа (без навязанных рапир/секир).

import { resolveSheetAttacks } from "@/lib/dnd/sheet-attacks";
import type {
  ActionParameters,
  Attack,
  CombatAbility,
  Combatant,
  CreatureSize,
  HotbarItem,
  SpellData,
  DamageRoll,
  ActionCost,
  AttackKind,
} from "./types";
import {
  abilitiesForClass,
  getSpellDefinition,
  sneakAttackDice,
  SPELL_LIBRARY,
  ATTACK_LIBRARY,
} from "./library-data";
import { proficiencyBonus } from "@/lib/dnd/dice";
import { resolveAbilityUses } from "./ability-uses";
import { srdCombatAbilities } from "./class-features";
import { resolveRaceForCharacter, type ResolvedRaceLoadout } from "./races/race-defs";

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
    // Фиксированный урон без кости («1 дробящий» у безоружного удара): раньше превращался в 1d6
    const flatMatch = !diceMatch ? trimmed.match(/^(\d+)(?!\s*[кkd]\s*\d)/i) : null;
    const dice = diceMatch ? `${diceMatch[1] || 1}d${diceMatch[2]}` : flatMatch ? "1d1" : "1d6";
    const modMatch = trimmed.match(/([+-]\s*\d+)/);
    const mod = flatMatch
      ? Math.max(0, parseInt(flatMatch[1], 10) - 1)
      : modMatch
      ? parseInt(modMatch[1].replace(/\s/g, ""), 10)
      : 0;

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

/** Извлекает сырые атаки персонажа: из живого листа героя либо из текстовых заметок и инвентаря */
function collectRawAttacks(char: Record<string, any>): any[] {
  const attacks: any[] = [];

  // 1. Живой лист героя (его накладывает @/lib/db при чтении из базы).
  // Атаки считаем так же, как сайт листа: по оружию в руках и снаряжению.
  if (char.sheet && typeof char.sheet === "object") {
    const list = resolveSheetAttacks(char.sheet);
    if (list.length > 0) return list;
  }

  // 2. Персонаж без листа: текстовый блок "Атаки:" в заметках
  if (char.notes && typeof char.notes === "string") {
    {
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
  // Живой лист героя; у персонажей без листа — null
  const sheetObj: any = char.sheet && typeof char.sheet === "object" ? char.sheet : null;

  const lowerClass = String(char.class || char.className || "").trim().toLowerCase();
  // Подклассы-заклинатели «на треть»: Мистический рыцарь (воин) и Мистический ловкач (плут) колдуют на Интеллекте
  const subclassText = String(char.subclass || "").toLowerCase();
  const isThirdCaster =
    (/воин|fighter/.test(lowerClass) && /мистическ\S* рыцар|eldritch knight/.test(subclassText)) ||
    (/плут|rogue/.test(lowerClass) && /мистическ\S* ловкач|arcane trickster/.test(subclassText));
  const isInt = /волшеб|маг|wizard|изобретатель|artificer/i.test(lowerClass) || isThirdCaster;
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
    if (isThirdCaster) {
      // Ячейки подкласса-заклинателя «на треть» (3 ур. — 2 ячейки 1 круга, 7 ур. — 2 круга, 13 ур. — 3 круга…)
      if (lvl >= 3) slots[1] = { max: lvl >= 7 ? 4 : lvl >= 4 ? 3 : 2, used: 0 };
      if (lvl >= 7) slots[2] = { max: lvl >= 10 ? 3 : 2, used: 0 };
      if (lvl >= 13) slots[3] = { max: lvl >= 16 ? 3 : 2, used: 0 };
      if (lvl >= 19) slots[4] = { max: 1, used: 0 };
    } else if (/паладин|paladin|следопыт|ranger/i.test(lowerClass)) {
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
 * и зарядами по правилам (Скрытая атака плута, Всплеск действий, Ярость и т.д.).
 * К способностям с ручной реализацией добавляются остальные умения SRD класса и архетипа
 * (class-features.ts); выбранные варианты (боевой стиль, воззвания) берутся из листа char.sheet.
 */
export function extractAbilitiesFromCharacter(
  char: Record<string, any>,
  level: number,
  profBonus: number,
  abilityMods: Record<string, number>
): CombatAbility[] {
  const rawClass = String(char.class || char.className || "");
  const className = normalizeClassName(rawClass);
  const baseAbilities = abilitiesForClass(className, level, char.subclass);

  const handMade = baseAbilities.map((a, idx) => {
    const params = a.parameters ? { ...a.parameters } : undefined;

    // Скрытая атака масштабируется по уровню плута (1к6, 2к6, 3к6...)
    if (params && a.name.includes("Скрытая атака")) {
      const dice = sneakAttackDice(level);
      params.damage = [{ dice, mod: 0, type: "piercing" }];
      params.description = `+${dice} урона при атаке оружием с фехтовальным свойством или дальнего боя при преимуществе.`;
    }

    const { usesMax, refresh } = resolveAbilityUses(params, { level, profBonus, abilityMods });

    return {
      id: `abl_p_${char.id || "char"}_${idx}_${Date.now()}`,
      name: a.name,
      usesMax,
      usesUsed: 0,
      refresh,
      parameters: params,
    };
  });

  const srd = srdCombatAbilities(
    { className: rawClass, subclass: char.subclass, level, profBonus, abilityMods, sheet: char.sheet ?? char },
    `abl_p_${char.id || "char"}`
  );
  return [...handMade, ...srd];
}

// ============ РАСЫ В БОЮ ============

function dedupeStringsCaseInsensitive(base: string[] = [], extra: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...base, ...extra]) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function normalizeCreatureSize(raw: string): CreatureSize | null {
  if (raw === "tiny" || raw === "крошечный") return "tiny";
  if (raw === "small" || raw === "маленький") return "small";
  if (raw === "medium" || raw === "средний") return "medium";
  if (raw === "large" || raw === "большой") return "large";
  if (raw === "huge" || raw === "огромный") return "huge";
  if (raw === "gargantuan" || raw === "громадный") return "gargantuan";
  return null;
}

function resolveSpeedWithRace(
  char: Record<string, any>,
  currentSpeed: number | undefined,
  raceWalk: number
): number {
  const sheetSpeed = char.sheet?.speed;
  if (typeof sheetSpeed === "number" && sheetSpeed > 0) {
    return currentSpeed && currentSpeed > 0 ? currentSpeed : sheetSpeed;
  }
  if (!currentSpeed || currentSpeed === 30) {
    return raceWalk;
  }
  return currentSpeed;
}

function resolveSizeWithRace(
  char: Record<string, any>,
  currentSize: CreatureSize | undefined,
  raceSize: CreatureSize
): CreatureSize {
  const explicitRaw = String(char.size ?? char.sheet?.size ?? "").trim().toLowerCase();
  const explicitSize = normalizeCreatureSize(explicitRaw);
  if (explicitSize && !(explicitSize === "medium" && raceSize === "small")) {
    return explicitSize;
  }
  if (!explicitRaw && currentSize && !(currentSize === "medium" && raceSize === "small")) {
    return currentSize;
  }
  return raceSize;
}

function extractExtraSpeeds(speeds: ResolvedRaceLoadout["speeds"]): Combatant["speeds"] | undefined {
  const extra: NonNullable<Combatant["speeds"]> = {};
  if (speeds.fly && speeds.fly > 0) extra.fly = speeds.fly;
  if (speeds.swim && speeds.swim > 0) extra.swim = speeds.swim;
  if (speeds.climb && speeds.climb > 0) extra.climb = speeds.climb;
  if (speeds.burrow && speeds.burrow > 0) extra.burrow = speeds.burrow;
  return Object.keys(extra).length > 0 ? extra : undefined;
}

/** Определяет боевой набор расы и подрасы для персонажа/листа. */
export function resolveRaceForCombatant(
  char: Record<string, any>,
  abilityMods: Record<string, number>,
  profBonus: number,
  idPrefix?: string
): ResolvedRaceLoadout | null {
  const race = char.race ?? char.sheet?.race;
  const subrace = char.subrace ?? char.sheet?.subrace;
  const level = Math.max(1, Number(char.level || char.sheet?.level || 1));
  const sheet = char.sheet && typeof char.sheet === "object" ? char.sheet : char;
  const racialVariants = Array.isArray(char.racialVariants) ? char.racialVariants : undefined;

  return resolveRaceForCharacter(
    { race, subrace, level, profBonus, abilityMods, sheet, racialVariants },
    idPrefix
  );
}

/** Преобразует врождённое расовое заклинание в CombatAbility без расхода ячеек класса. */
export function innateSpellToCombatAbility(
  spell: ResolvedRaceLoadout["innateSpells"][number],
  raceId: string,
  abilityMods: Record<string, number>,
  profBonus: number,
  idPrefix: string
): CombatAbility {
  const defCandidate = getSpellDefinition(spell.spellId) ?? getSpellDefinition(spell.name);
  const def = defCandidate && (spell.level === 0 ? defCandidate.level === 0 : true) ? defCandidate : undefined;
  const srdKey = `race/${raceId}/innate/${spell.spellId}`;
  const spellSlotLevel = spell.level > 0 ? spell.level : null;
  const castMod = abilityMods[spell.castingAbility] ?? 0;

  const parameters: ActionParameters = def
    ? {
        ...structuredClone(def.parameters),
        type: "ability",
        srdKey,
        spellSlotLevel,
        saveDC: 8 + profBonus + castMod,
        attackBonus: profBonus + castMod,
        offTurn: def.parameters.actionCost === "reaction" ? true : def.parameters.offTurn,
      }
    : {
        name: spell.name,
        type: "ability",
        actionCost: "action",
        range: { type: "self" },
        targeting: "self",
        manual: true,
        srdKey,
        spellSlotLevel,
        description: `Врождённое заклинание (${spell.name})`,
      };

  return {
    id: `${idPrefix}_race_spell_${spell.spellId}`,
    name: def?.name ?? spell.name,
    usesMax: spell.usesMax,
    usesUsed: 0,
    refresh: spell.refresh,
    parameters,
  };
}

export interface MergeRaceInput {
  loadout: ResolvedRaceLoadout | null;
  char: Record<string, any>;
  abilityMods: Record<string, number>;
  profBonus: number;
  idPrefix: string;
  attacks: Attack[];
  abilities: CombatAbility[];
  speed?: number;
  size?: CreatureSize;
  damageResistances?: string[];
  conditionImmunities?: string[];
}

export interface MergedRaceCombatantData {
  attacks: Attack[];
  abilities: CombatAbility[];
  speed: number;
  size: CreatureSize;
  racialMeta: Partial<
    Pick<
      Combatant,
      | "race"
      | "subrace"
      | "raceId"
      | "subraceId"
      | "darkvision"
      | "speeds"
      | "racialVariants"
      | "damageResistances"
      | "conditionImmunities"
    >
  >;
}

/** Сливает расовые умения, врождённые заклинания, природное оружие, сопротивления, скорость и размер. */
export function mergeRaceIntoCombatantData(input: MergeRaceInput): MergedRaceCombatantData {
  const { loadout, char, abilityMods, profBonus, idPrefix } = input;
  if (!loadout) {
    const explicitSize = normalizeCreatureSize(String(char.size ?? char.sheet?.size ?? "").trim().toLowerCase());
    return {
      attacks: input.attacks,
      abilities: input.abilities,
      speed: input.speed ?? 30,
      size: input.size ?? explicitSize ?? "medium",
      racialMeta: {
        ...(input.damageResistances?.length ? { damageResistances: input.damageResistances } : {}),
        ...(input.conditionImmunities?.length ? { conditionImmunities: input.conditionImmunities } : {}),
      },
    };
  }

  const innateAbilities = loadout.innateSpells.map((s) =>
    innateSpellToCombatAbility(s, loadout.raceId, abilityMods, profBonus, idPrefix)
  );
  const seenAbilities = new Set<string>();
  const abilities: CombatAbility[] = [];
  for (const ab of [...input.abilities, ...loadout.abilities, ...innateAbilities]) {
    const key = ab.parameters?.srdKey
      ? `srd:${ab.parameters.srdKey}`
      : `name:${ab.name.trim().toLowerCase()}`;
    if (seenAbilities.has(key)) continue;
    seenAbilities.add(key);
    abilities.push(ab);
  }

  const seenAttacks = new Set(input.attacks.map((a) => a.name.trim().toLowerCase()));
  const attacks: Attack[] = [...input.attacks];
  for (const nw of loadout.naturalAttacks) {
    const key = nw.name.trim().toLowerCase();
    if (seenAttacks.has(key)) continue;
    seenAttacks.add(key);
    attacks.push(nw);
  }

  const damageResistances = dedupeStringsCaseInsensitive(input.damageResistances, loadout.resistances);
  const conditionImmunities = dedupeStringsCaseInsensitive(
    input.conditionImmunities,
    loadout.conditionImmunities
  );
  const speeds = extractExtraSpeeds(loadout.speeds);

  return {
    attacks,
    abilities,
    speed: resolveSpeedWithRace(char, input.speed, loadout.speeds.walk),
    size: resolveSizeWithRace(char, input.size, loadout.size),
    racialMeta: {
      race: loadout.raceName,
      ...(loadout.subraceName ? { subrace: loadout.subraceName } : {}),
      raceId: loadout.raceId,
      ...(loadout.subraceId ? { subraceId: loadout.subraceId } : {}),
      darkvision: loadout.darkvision,
      ...(speeds ? { speeds } : {}),
      ...(loadout.racialVariants.length > 0 ? { racialVariants: loadout.racialVariants } : {}),
      ...(damageResistances.length > 0 ? { damageResistances } : {}),
      ...(conditionImmunities.length > 0 ? { conditionImmunities } : {}),
    },
  };
}
