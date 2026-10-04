// Атаки героя с сайта листа персонажа — в том виде, в каком их показывает сам сайт.
//
// Сайт листа НЕ показывает сохранённое поле `attacks` как есть. Список атак он каждый раз
// считает заново: оружие в основной и второй руке, парная атака, метательное оружие из
// снаряжения, безоружный удар — и только потом добавляет пользовательские атаки из `attacks`,
// которых ещё нет в списке (см. getActiveCharacterAttacks в equipment-types.ts сайта листа).
//
// Раньше мы брали только `attacks`. Там лежат устаревшие записи: у героя 1 уровня — два
// оружия с бонусом +14 вместо пяти атак с +5. Этот модуль повторяет расчёт сайта листа.

import { findWeaponByName, getWeaponDamageDiceForGrip, type DndWeapon } from "./sheet-weapons";
import { proficiencyBonus } from "./dice";

export interface SheetAttack {
  name: string;
  attackBonus: string;
  damageAndType: string;
  /** Стоимость действия для боевого режима */
  actionCost?: "action" | "bonus" | "action+bonus";
  /** Откуда атака: рука, парная, метательная, безоружная, пользовательская */
  source: "mainHand" | "offHand" | "dual" | "thrown" | "unarmed" | "custom";
}

type Sheet = Record<string, any>;

const ABILITY_ALIASES: Record<"str" | "dex", string[]> = {
  str: ["СИЛ", "str", "STR"],
  dex: ["ЛОВ", "dex", "DEX"],
};

function num(v: unknown): number {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? (n as number) : 0;
}

function abilityScore(sheet: Sheet, key: "str" | "dex"): number {
  const read = (container: unknown): number | undefined => {
    if (!container || typeof container !== "object") return undefined;
    for (const alias of ABILITY_ALIASES[key]) {
      const v = (container as Sheet)[alias];
      if (v !== undefined && v !== null && v !== "") return num(v);
    }
    return undefined;
  };
  const base = read(sheet.abilityScores) ?? read(sheet) ?? 10;
  return base + (read(sheet.abilityBonuses) ?? 0) + (read(sheet.asiBonuses) ?? 0);
}

function mod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function damageString(dice: string, bonus: number, type: string): string {
  if (bonus > 0) return `${dice}+${bonus} ${type}`;
  if (bonus < 0) return `${dice}${bonus} ${type}`;
  return `${dice} ${type}`;
}

interface WeaponStats {
  atkBonus: string;
  fullDamage: string;
  offDamage: string;
}

function weaponStats(
  sheet: Sheet,
  weapon: DndWeapon | undefined,
  itemAtk = 0,
  itemDmg = 0,
  twoHandGrip = false
): WeaponStats {
  const strMod = mod(abilityScore(sheet, "str"));
  const dexMod = mod(abilityScore(sheet, "dex"));

  let usedMod = strMod;
  if (weapon) {
    const ranged = weapon.category.includes("дальнобойное");
    if (ranged && !weapon.finesse) usedMod = dexMod;
    else if (weapon.finesse) usedMod = Math.max(strMod, dexMod);
  }

  const prof = proficiencyBonus(Math.max(1, num(sheet.level) || 1));
  const dice = getWeaponDamageDiceForGrip(weapon, twoHandGrip);
  const type = weapon?.damageType || "дробящий";

  return {
    atkBonus: fmt(prof + usedMod + itemAtk),
    fullDamage: damageString(dice, usedMod + itemDmg, type),
    // Вторая рука: положительный модификатор к урону не добавляется (без боевого стиля)
    offDamage: damageString(dice, (usedMod < 0 ? usedMod : 0) + itemDmg, type),
  };
}

function itemBonuses(item: Sheet | undefined | null): { atk: number; dmg: number } {
  if (!item) return { atk: 0, dmg: 0 };
  let atk = typeof item.bonusAttack === "number" ? item.bonusAttack : 0;
  let dmg = typeof item.bonusDamage === "number" ? item.bonusDamage : 0;
  for (const eff of Array.isArray(item.effects) ? item.effects : []) {
    if (!eff) continue;
    const value = Number(eff.value) || 0;
    if (eff.type === "attackDamage") {
      atk += value;
      dmg += value;
    } else if (eff.type === "attack" || eff.type === "weaponAttack") {
      atk += value;
    } else if (eff.type === "damage" || eff.type === "weaponDamage") {
      dmg += value;
    }
  }
  return { atk, dmg };
}

function accessoryBonuses(sheet: Sheet): { atk: number; dmg: number } {
  let atk = 0;
  let dmg = 0;
  for (const [slot, item] of Object.entries((sheet.equippedSlots || {}) as Record<string, Sheet>)) {
    if (!item || slot === "mainHand" || slot === "offHand") continue;
    const b = itemBonuses(item);
    atk += b.atk;
    dmg += b.dmg;
  }
  return { atk, dmg };
}

function sheetText(sheet: Sheet): string {
  const parts = [typeof sheet.featuresTraits === "string" ? sheet.featuresTraits : ""];
  for (const t of Array.isArray(sheet.traitsList) ? sheet.traitsList : []) {
    parts.push(String(t?.name || ""), String(t?.description || ""), String(t?.summary || ""));
  }
  return parts.join("\n").toLowerCase();
}

function hasTwoWeaponFightingStyle(sheet: Sheet): boolean {
  const text = sheetText(sheet);
  if (["сражение двумя оружиями", "two-weapon fighting", "парным оружием"].some((q) => text.includes(q))) {
    return true;
  }
  return (Array.isArray(sheet.levelHistory) ? sheet.levelHistory : []).some((h: Sheet) => {
    const style = String(h?.selectedFightingStyle || "").toLowerCase();
    return style.includes("two_weapon") || style.includes("двумя");
  });
}

const THROWN_WEAPONS: Array<{ name: string; test: (s: string) => boolean }> = [
  { name: "Метательное копьё", test: (s) => /метательн.*копь|копь.*метательн/i.test(s) },
  { name: "Лёгкий молот", test: (s) => /л[её]гк.*молот|молот.*л[её]гк/i.test(s) },
  { name: "Ручной топор", test: (s) => /ручн.*топор|топор.*ручн/i.test(s) },
  { name: "Кинжал", test: (s) => /кинжал/i.test(s) },
  { name: "Дротик", test: (s) => /дротик/i.test(s) },
  { name: "Копьё", test: (s) => /(^|[^\wа-яё])копь[её]/i.test(s) },
  { name: "Трезубец", test: (s) => /трезубец/i.test(s) },
  { name: "Сеть", test: (s) => /(^|[^\wа-яё])сеть([^\wа-яё]|$)/i.test(s) },
];

/** Есть ли в листе данные, по которым сайт листа считает атаки (экипировка или снаряжение) */
export function sheetHasEquipmentData(sheet: unknown): boolean {
  if (!sheet || typeof sheet !== "object") return false;
  const s = sheet as Sheet;
  const slots = s.equippedSlots && typeof s.equippedSlots === "object" ? s.equippedSlots : null;
  return Boolean(slots && (slots.mainHand || slots.offHand)) || "equippedSlots" in s;
}

/**
 * Атаки героя так, как их показывает сайт листа.
 * Для листа без экипировки (лист из другого источника) возвращает сохранённые атаки как есть.
 */
export function resolveSheetAttacks(sheetLike: unknown): SheetAttack[] {
  if (!sheetLike || typeof sheetLike !== "object") return [];
  const sheet = sheetLike as Sheet;

  const stored: SheetAttack[] = (Array.isArray(sheet.attacks) ? sheet.attacks : [])
    .filter((a: Sheet) => typeof a?.name === "string" && a.name.trim())
    .map((a: Sheet) => ({
      name: String(a.name).trim(),
      attackBonus: String(a.attackBonus ?? "").trim() || "+0",
      damageAndType: String(a.damageAndType ?? "").trim() || "—",
      source: "custom" as const,
    }));

  if (!sheetHasEquipmentData(sheet)) return stored;

  const attacks: SheetAttack[] = [];
  const equipped = (sheet.equippedSlots || {}) as Record<string, Sheet | undefined>;
  const acc = accessoryBonuses(sheet);
  const main = equipped.mainHand;
  const off = equipped.offHand;
  const twoHanded = Boolean(main?.twoHanded || main?.twoHandGrip);
  const dualWield = Boolean(main && off && !off.isShield && !twoHanded);

  if (dualWield && main && off) {
    const mainBonus = itemBonuses(main);
    const offBonus = itemBonuses(off);
    const mainStats = weaponStats(sheet, findWeaponByName(main.name), mainBonus.atk + acc.atk, mainBonus.dmg + acc.dmg, twoHanded);
    const offStats = weaponStats(sheet, findWeaponByName(off.name), offBonus.atk + acc.atk, offBonus.dmg + acc.dmg, false);
    const offDamage = hasTwoWeaponFightingStyle(sheet) ? offStats.fullDamage : offStats.offDamage;

    attacks.push({
      name: String(main.name),
      attackBonus: mainStats.atkBonus,
      damageAndType: mainStats.fullDamage,
      actionCost: "action",
      source: "mainHand",
    });
    attacks.push({
      name: `${off.name} (вторая рука)`,
      attackBonus: offStats.atkBonus,
      damageAndType: offDamage,
      actionCost: "bonus",
      source: "offHand",
    });
    attacks.push({
      name: `${main.name} и ${off.name} (парная атака)`,
      attackBonus: mainStats.atkBonus,
      // «и» — разделитель, который понимает разбор урона в боевом режиме
      damageAndType: `${mainStats.fullDamage} и ${offDamage}`,
      actionCost: "action+bonus",
      source: "dual",
    });
  } else {
    if (main) {
      const b = itemBonuses(main);
      const stats = weaponStats(sheet, findWeaponByName(main.name), b.atk + acc.atk, b.dmg + acc.dmg, twoHanded);
      attacks.push({
        name: String(main.name),
        attackBonus: stats.atkBonus,
        damageAndType: stats.fullDamage,
        actionCost: "action",
        source: "mainHand",
      });
    }
    if (off && !off.isShield && !main) {
      const b = itemBonuses(off);
      const stats = weaponStats(sheet, findWeaponByName(off.name), b.atk + acc.atk, b.dmg + acc.dmg, false);
      attacks.push({
        name: String(off.name),
        attackBonus: stats.atkBonus,
        damageAndType: stats.fullDamage,
        actionCost: "action",
        source: "offHand",
      });
    }
  }

  // Метательное оружие из снаряжения, пояса и кошеля
  const inventory = [
    typeof sheet.equipment === "string" ? sheet.equipment : "",
    equipped.belt?.name || "",
    equipped.pouch?.name || "",
  ].join(" \n ");
  const inHand = [main?.name, off?.name].filter(Boolean).map((n) => String(n).toLowerCase().trim());
  for (const tw of THROWN_WEAPONS) {
    if (!tw.test(inventory) || inHand.some((n) => tw.test(n))) continue;
    const weapon = findWeaponByName(tw.name);
    if (!weapon) continue;
    const stats = weaponStats(sheet, weapon);
    attacks.push({
      name: weapon.name,
      attackBonus: stats.atkBonus,
      damageAndType: stats.fullDamage,
      actionCost: "action",
      source: "thrown",
    });
  }

  // Безоружный удар доступен всегда
  const strMod = mod(abilityScore(sheet, "str"));
  const prof = proficiencyBonus(Math.max(1, num(sheet.level) || 1));
  attacks.push({
    name: "Безоружный удар",
    attackBonus: fmt(prof + strMod),
    damageAndType: `${Math.max(1, 1 + strMod)} дробящий`,
    actionCost: "action",
    source: "unarmed",
  });

  // Пользовательские атаки, которых ещё нет в списке
  const base = (n: string) => n.toLowerCase().replace(/\s*\(.*\)\s*$/, "").trim();
  for (const custom of stored) {
    const key = custom.name.toLowerCase().trim();
    const present = attacks.some((a) => a.name.toLowerCase().trim() === key || base(a.name) === key);
    if (!present) attacks.push(custom);
  }

  return attacks;
}
