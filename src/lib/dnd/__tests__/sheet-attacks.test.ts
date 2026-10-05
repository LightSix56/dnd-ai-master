// Атаки героя должны совпадать с тем, что показывает сайт листа персонажа:
// он считает их по оружию в руках и снаряжению, а не берёт сохранённое поле attacks.
import { describe, it, expect } from "vitest";
import { resolveSheetAttacks } from "../sheet-attacks";
import { mapSheetToCharacter } from "../import-character";
import { parseCharacterProficiencies } from "../d20-helper";
import { extractAttacksFromCharacter, parseDamageString } from "@/lib/combat/character-adapter";

// Реальный лист плута 1 уровня: в поле attacks — две устаревшие записи с +14
const rogue = {
  name: "Пятно",
  className: "Плут",
  race: "Чейнджлинг",
  level: 1,
  abilityScores: { СИЛ: 10, ЛОВ: 15, ТЕЛ: 11, ИНТ: 10, МДР: 12, ХАР: 14 },
  abilityBonuses: { СИЛ: 0, ЛОВ: 2, ТЕЛ: 0, ИНТ: 0, МДР: 1, ХАР: 0 },
  attacks: [
    { name: "Короткий меч", ability: "ЛОВ", attackBonus: "+14", damageAndType: "1d6+12 колющий" },
    { name: "Кинжал", ability: "ЛОВ", attackBonus: "+14", damageAndType: "1d4+12 колющий" },
  ],
  equippedSlots: {
    armor: { id: "start-armor", name: "Кожаный доспех", slot: "armor" },
    mainHand: { id: "start-main", name: "Короткий меч", slot: "mainHand", twoHanded: false },
    offHand: { id: "off-wep", name: "Короткий меч", slot: "offHand", weight: 2 },
  },
  customItems: [],
  equipment:
    "[Класс]: короткий меч, короткий меч, набор исследователя подземелий, Кожаная броня, два кинжала, воровские инструменты",
  skillProficiencies: { Скрытность: true },
  skillExpertise: { Скрытность: true },
};

describe("resolveSheetAttacks", () => {
  it("даёт те же пять атак, что и сайт листа, с верными бонусами", () => {
    const attacks = resolveSheetAttacks(rogue);
    expect(attacks.map((a) => a.name)).toEqual([
      "Короткий меч",
      "Короткий меч (вторая рука)",
      "Короткий меч и Короткий меч (парная атака)",
      "Кинжал",
      "Безоружный удар",
    ]);
    expect(attacks.map((a) => a.attackBonus)).toEqual(["+5", "+5", "+5", "+5", "+2"]);
    expect(attacks[0].damageAndType).toBe("1d6+3 колющий");
    // вторая рука — без модификатора к урону
    expect(attacks[1].damageAndType).toBe("1d6 колющий");
    expect(attacks[1].actionCost).toBe("bonus");
    expect(attacks[2].damageAndType).toBe("1d6+3 колющий и 1d6 колющий");
    expect(attacks[3].damageAndType).toBe("1d4+3 колющий");
    expect(attacks[4].damageAndType).toBe("1 дробящий");
    // устаревшие +14 из поля attacks не попадают в список
    expect(attacks.some((a) => a.attackBonus.includes("14"))).toBe(false);
  });

  it("пользовательские атаки, которых нет среди оружия, сохраняются", () => {
    const attacks = resolveSheetAttacks({
      ...rogue,
      attacks: [...rogue.attacks, { name: "Удар клыка", attackBonus: "+6", damageAndType: "1к6+4 кол" }],
    });
    expect(attacks).toHaveLength(6);
    expect(attacks[5]).toMatchObject({ name: "Удар клыка", attackBonus: "+6", source: "custom" });
  });

  it("лист без данных об экипировке отдаёт сохранённые атаки как есть", () => {
    const attacks = resolveSheetAttacks({
      name: "Кроуг",
      level: 3,
      attacks: [{ name: "Секира", attackBonus: "+5", damageAndType: "1d12+3 рубящий" }, { name: "" }],
    });
    expect(attacks).toHaveLength(1);
    expect(attacks[0].name).toBe("Секира");
  });

  it("одно оружие и щит: атака основной рукой и безоружный удар", () => {
    const attacks = resolveSheetAttacks({
      level: 5,
      abilityScores: { СИЛ: 16, ЛОВ: 10 },
      equippedSlots: {
        mainHand: { name: "Длинный меч" },
        offHand: { name: "Щит", isShield: true },
      },
      equipment: "",
      attacks: [],
    });
    expect(attacks.map((a) => a.name)).toEqual(["Длинный меч", "Безоружный удар"]);
    expect(attacks[0].attackBonus).toBe("+6");
    expect(attacks[0].damageAndType).toBe("1d8+3 рубящий");
  });
});

describe("атаки доходят до окна бросков и до боя", () => {
  const card = { id: "abc", name: "Пятно", level: 1, className: "Плут", data: rogue };

  it("окно бросков d20 — живой лист героя", () => {
    const parsed = parseCharacterProficiencies({ sheet: rogue }, "Плут");
    expect(parsed.attacks).toHaveLength(5);
    expect(parsed.attacks.map((a) => a.bonus)).toEqual([5, 5, 5, 5, 2]);
  });

  it("окно бросков d20 — текстовые заметки после импорта в кампанию", () => {
    const mapped = mapSheetToCharacter(card as any);
    const parsed = parseCharacterProficiencies(mapped.notes, "Плут");
    expect(parsed.attacks).toHaveLength(5);
    expect(parsed.attacks.map((a) => a.bonus)).toEqual([5, 5, 5, 5, 2]);
    expect(parsed.attacks[2].name).toContain("парная атака");
  });

  it("бой — бонусы, урон и стоимость действия", () => {
    const attacks = extractAttacksFromCharacter(
      { id: "c1", class: "Плут", sheet: rogue },
      3,
      0,
      2
    );
    expect(attacks).toHaveLength(5);
    expect(attacks.map((a) => a.attackBonus)).toEqual([5, 5, 5, 5, 2]);
    expect(attacks[0].damage).toEqual([{ dice: "1d6", mod: 3, type: "piercing" }]);
    expect(attacks[1].actionCost).toBe("bonus");
    expect(attacks[2].actionCost).toBe("action+bonus");
    expect(attacks[2].damage).toEqual([
      { dice: "1d6", mod: 3, type: "piercing" },
      { dice: "1d6", mod: 0, type: "piercing" },
    ]);
    // безоружный удар: ровно 1 урона, а не 1d6
    expect(attacks[4].damage).toEqual([{ dice: "1d1", mod: 0, type: "bludgeoning" }]);
  });

  it("фиксированный урон разбирается без подстановки кости", () => {
    expect(parseDamageString("3 дробящий")).toEqual([{ dice: "1d1", mod: 2, type: "bludgeoning" }]);
    expect(parseDamageString("1к6+4 кол")).toEqual([{ dice: "1d6", mod: 4, type: "piercing" }]);
  });

  it("лист в заметках игрой не читается: атаки берутся только из живого листа", () => {
    expect(parseCharacterProficiencies(JSON.stringify(card), "Плут").attacks).toHaveLength(0);
    expect(parseCharacterProficiencies({ notes: JSON.stringify(card) }, "Плут").attacks).toHaveLength(0);
    expect(parseCharacterProficiencies({ sheet: rogue, notes: "[Статус: насторожен]" }, "Плут").attacks).toHaveLength(5);
  });
});
