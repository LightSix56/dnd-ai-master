import { test } from "vitest";
import assert from "node:assert/strict";
import {
  abilityModifier,
  parseCharacterProficiencies,
  getSkillBonus,
  getSaveBonus,
  formatD20RollResult,
  DND_SKILLS,
} from "./d20-helper";
import type { Character } from "@/lib/store";

test("abilityModifier calculates standard 5e modifiers", () => {
  assert.equal(abilityModifier(10), 0);
  assert.equal(abilityModifier(11), 0);
  assert.equal(abilityModifier(12), 1);
  assert.equal(abilityModifier(18), 4);
  assert.equal(abilityModifier(8), -1);
  assert.equal(abilityModifier(1), -5);
});

test("parseCharacterProficiencies parses saving throws, skills and attacks", () => {
  const sampleNotes =
    "Игрок: Даниил\n" +
    "Спасброски: СИЛ, ЛОВ, ТЕЛ\n" +
    "Навыки: Анализ, Атлетика, Внимательность (компетенция)\n" +
    "Атаки: Секира +5 1d12+3 рубящий; Копьё +5 1d6+3 колющий";

  const parsed = parseCharacterProficiencies(sampleNotes, "Варвар");

  assert.equal(parsed.savingThrows.has("СИЛ"), true);
  assert.equal(parsed.savingThrows.has("ЛОВ"), true);
  assert.equal(parsed.savingThrows.has("ТЕЛ"), true);
  assert.equal(parsed.savingThrows.has("ИНТ"), false);

  assert.equal(parsed.skills.get("Анализ"), "proficient");
  assert.equal(parsed.skills.get("Атлетика"), "proficient");
  assert.equal(parsed.skills.get("Внимательность"), "expertise");
  assert.equal(parsed.skills.has("Акробатика"), false);

  assert.equal(parsed.attacks.length, 2);
  assert.equal(parsed.attacks[0].name, "Секира");
  assert.equal(parsed.attacks[0].bonus, 5);
  assert.equal(parsed.attacks[1].name, "Копьё");
  assert.equal(parsed.attacks[1].bonus, 5);
});

test("getSkillBonus correctly applies base modifier and profBonus/expertise", () => {
  const mockChar = {
    str: 16, // mod +3
    dex: 14, // mod +2
    con: 15, // mod +2
    int: 10, // mod 0
    wis: 12, // mod +1
    cha: 8,  // mod -1
    profBonus: 2,
    notes: "Навыки: Атлетика, Внимательность (компетенция)",
    class: "Варвар",
  } as unknown as Character;

  const parsed = parseCharacterProficiencies(mockChar.notes, mockChar.class);

  const athletics = DND_SKILLS.find((s) => s.name === "Атлетика")!;
  const perception = DND_SKILLS.find((s) => s.name === "Внимательность")!;
  const acrobatics = DND_SKILLS.find((s) => s.name === "Акробатика")!;

  // Атлетика: str mod (+3) + prof (+2) = 5
  assert.equal(getSkillBonus(mockChar, athletics, parsed), 5);
  // Внимательность: wis mod (+1) + expertise (+4) = 5
  assert.equal(getSkillBonus(mockChar, perception, parsed), 5);
  // Акробатика: dex mod (+2) + no prof (0) = 2
  assert.equal(getSkillBonus(mockChar, acrobatics, parsed), 2);
});

test("getSaveBonus applies proficiency correctly", () => {
  const mockChar = {
    str: 16, // mod +3
    dex: 14, // mod +2
    profBonus: 2,
    notes: "Спасброски: СИЛ",
    class: "Варвар",
  } as unknown as Character;

  const parsed = parseCharacterProficiencies(mockChar.notes, mockChar.class);

  // СИЛ спасбросок: +3 + 2 = 5
  assert.equal(getSaveBonus(mockChar, "str", parsed), 5);
  // ЛОВ спасбросок: +2 + 0 = 2
  assert.equal(getSaveBonus(mockChar, "dex", parsed), 2);
});

test("formatD20RollResult matches user requested format (16+4)", () => {
  assert.equal(
    formatD20RollResult("Ловкость (Акробатика)", 16, 4),
    "Ловкость (Акробатика): (16+4)"
  );
  assert.equal(
    formatD20RollResult("Спасбросок Ловкости", 12, -1),
    "Спасбросок Ловкости: (12-1)"
  );
  assert.equal(
    formatD20RollResult("Спасбросок Силы", 20, 5),
    "Спасбросок Силы: (20+5) — Натуральная 20! 🌟"
  );
  assert.equal(
    formatD20RollResult("Атака: Секира", 1, 5),
    "Атака: Секира: (1+5) — Натуральная 1! 💀"
  );
});
