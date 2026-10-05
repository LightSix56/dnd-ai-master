// Перенос персонажа с сайта листа: атаки, владения и компетенции не должны теряться,
// в какой бы обёртке лист ни пришёл.
import { describe, it, expect } from "vitest";
import {
  hasSheetData,
  mapSheetToCharacter,
  notesWithoutSheetJson,
  summarizeSheetMechanics,
  unwrapSheet,
} from "../import-character";
import { parseCharacterProficiencies } from "../d20-helper";
import { dossierFromSheet, stripVolatileNotes } from "@/lib/ai/caching/frozen-prefix";

const sheet = {
  name: "Пятно",
  className: "Плут",
  race: "Чейнджлинг",
  level: 1,
  abilityScores: { СИЛ: 8, ЛОВ: 16, ТЕЛ: 12, ИНТ: 13, МДР: 10, ХАР: 15 },
  abilityBonuses: { СИЛ: 0, ЛОВ: 1, ТЕЛ: 0, ИНТ: 0, МДР: 0, ХАР: 2 },
  savingThrowProficiencies: { СИЛ: false, ЛОВ: true, ТЕЛ: false, ИНТ: true, МДР: false, ХАР: false },
  skillProficiencies: {
    Акробатика: true,
    Обман: true,
    Скрытность: true,
    "Ловкость рук": true,
    Убеждение: true,
    Внимательность: true,
    Запугивание: false,
  },
  skillExpertise: { Скрытность: true, Обман: true },
  attacks: [
    { name: "Рапира", attackBonus: "+5", damageAndType: "1d8+3 колющий" },
    { name: "Короткий лук", attackBonus: "+5", damageAndType: "1d6+3 колющий" },
    { name: "Кинжал", attackBonus: "+5", damageAndType: "1d4+3 колющий" },
    { name: "Кинжал (метание)", attackBonus: "+5", damageAndType: "1d4+3 колющий" },
    { name: "Безоружный удар", attackBonus: "+1", damageAndType: "1 дробящий" },
    { name: "", attackBonus: "", damageAndType: "" },
  ],
  hpMax: 9,
  armorClass: 14,
  speed: 30,
};

// так лист выглядит, когда персонажа аккаунта выбирают в сетевой комнате
const accountCard = { id: "abc", name: "Пятно", level: 1, className: "Плут", race: "Чейнджлинг", data: sheet };

describe("unwrapSheet", () => {
  it("достаёт лист из любой обёртки", () => {
    expect(unwrapSheet(sheet)).toBe(sheet);
    expect(unwrapSheet(accountCard)).toBe(sheet);
    expect(unwrapSheet({ rawSheet: sheet })).toBe(sheet);
    expect(unwrapSheet({ characterSnapshot: { data: sheet } })).toBe(sheet);
  });

  it("отличает лист от урезанной карточки героя кампании", () => {
    expect(hasSheetData(accountCard)).toBe(true);
    expect(hasSheetData({ id: "x", name: "Пятно", level: 1, className: "Плут", str: 8, dex: 17 })).toBe(false);
  });
});

describe("mapSheetToCharacter", () => {
  it("переносит атаки, навыки и компетенции из обёрнутого листа", () => {
    const mapped = mapSheetToCharacter(accountCard as any);
    expect(mapped.dex).toBe(17);
    expect(mapped.cha).toBe(17);
    expect(mapped.class).toBe("Плут");
    expect(mapped.notes).toContain("Рапира +5 1d8+3 колющий");
    expect(mapped.notes).toContain("Безоружный удар");
    expect(mapped.notes).toContain("Скрытность (компетенция)");
    expect(mapped.notes).toContain("Спасброски: ЛОВ, ИНТ");

    const parsed = parseCharacterProficiencies(mapped.notes, mapped.class);
    expect(parsed.attacks).toHaveLength(5);
    expect(parsed.skills.size).toBe(6);
    expect(parsed.skills.get("Обман")).toBe("expertise");
  });
});

describe("живой лист героя из базы", () => {
  const notes = JSON.stringify(accountCard);
  const liveSheet = unwrapSheet<Record<string, any>>(accountCard);

  it("parseCharacterProficiencies находит атаки, владения и компетенции", () => {
    const parsed = parseCharacterProficiencies({ sheet: liveSheet }, "Плут");
    expect(parsed.attacks.map((a) => a.name)).toEqual([
      "Рапира",
      "Короткий лук",
      "Кинжал",
      "Кинжал (метание)",
      "Безоружный удар",
    ]);
    expect(parsed.attacks[0]).toMatchObject({ bonus: 5, notation: "+5", damageAndType: "1d8+3 колющий" });
    expect(parsed.skills.size).toBe(6);
    expect([...parsed.skills.values()].filter((v) => v === "expertise")).toHaveLength(2);
    expect(parsed.skills.has("Запугивание")).toBe(false);
    expect([...parsed.savingThrows].sort()).toEqual(["ИНТ", "ЛОВ"]);
  });

  it("текстовые заметки разбираются как раньше", () => {
    const parsed = parseCharacterProficiencies(
      "Спасброски: СИЛ, ТЕЛ\nНавыки: Атлетика, Запугивание (компетенция)\nАтаки: Секира +5 1d12+3 рубящий",
      "Варвар"
    );
    expect(parsed.attacks).toHaveLength(1);
    expect(parsed.skills.get("Запугивание")).toBe("expertise");
  });

  it("мастер получает навыки и атаки героя, а не пустое досье", () => {
    const dossier = dossierFromSheet(liveSheet) || "";
    expect(dossier).toContain("Навыки:");
    expect(dossier).toContain("Скрытность (компетенция)");
    expect(dossier).toContain("Рапира +5");
    expect(dossier).not.toContain("{");
    // а JSON, оставшийся в заметках старых кампаний, в промпт не попадает совсем
    expect(stripVolatileNotes(notes)).toBeNull();
  });

  it("сводка для карточки героя читаема", () => {
    const lines = summarizeSheetMechanics(liveSheet);
    expect(lines).toHaveLength(3);
    expect(lines[2].startsWith("Атаки: Рапира")).toBe(true);
  });
});

describe("notesWithoutSheetJson", () => {
  it("убирает лист, когда-то сохранённый в заметках, и оставляет статус и записи летописца", () => {
    const json = JSON.stringify(accountCard);
    expect(notesWithoutSheetJson(json)).toBeNull();
    expect(notesWithoutSheetJson(`[Статус: ранен]\n• боится огня\n${json}`)).toBe("[Статус: ранен]\n• боится огня");
  });

  it("обычный текст не трогает, даже с фигурной скобкой", () => {
    expect(notesWithoutSheetJson("Спасброски: СИЛ")).toBe("Спасброски: СИЛ");
    expect(notesWithoutSheetJson("Носит амулет {древний}")).toBe("Носит амулет {древний}");
    expect(notesWithoutSheetJson(null)).toBeNull();
    expect(notesWithoutSheetJson("")).toBeNull();
  });
});
