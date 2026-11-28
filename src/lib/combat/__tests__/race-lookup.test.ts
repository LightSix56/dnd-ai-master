import { describe, expect, it } from "vitest";
import "../classes/combat-index";
import { RACES_2014, findRaceData } from "../races/race-defs";

// Поиск расы и подрасы по запросу: id, названию, английскому имени и алиасам.
// Проверяет, что каждая раса и подраса находится по любому своему названию.

describe("findRaceData: поиск расы и подрасы", () => {
  it("находит каждую расу по id", () => {
    for (const race of RACES_2014) {
      const found = findRaceData(race.id);
      expect(found?.race.id, race.id).toBe(race.id);
    }
  });

  it("находит каждую расу по русскому и английскому названию (вариант может быть любым)", () => {
    for (const race of RACES_2014) {
      expect(findRaceData(race.name)?.race.name, race.name).toBe(race.name);
      const en = findRaceData(race.nameEn)?.race;
      const names = [en?.nameEn, ...(en?.aliases ?? [])].map((n) => String(n).toLowerCase());
      expect(names, race.nameEn).toContain(race.nameEn.toLowerCase());
    }
  });

  it("находит каждую подрасу по id, названию и английскому имени", () => {
    for (const race of RACES_2014) {
      for (const sub of race.subraces) {
        // Название, общее с другой подрасой той же расы («Орк» у Eberron и Wildemount), не различает их
        const unique = (key: "name" | "nameEn") => race.subraces.filter((s) => s[key] === sub[key]).length === 1;
        const queries = [sub.id, ...(unique("name") ? [sub.name] : []), ...(unique("nameEn") ? [sub.nameEn] : [])];
        for (const q of queries) {
          const found = findRaceData(race.id, q);
          expect(found?.race.id, `${race.id} / ${q}`).toBe(race.id);
          expect(found?.subrace?.id, `${race.id} / ${q}`).toBe(sub.id);
        }
      }
    }
  });

  it("подраса находится и по запросу «подраса + раса»", () => {
    const all = RACES_2014.flatMap((race) =>
      race.subraces
        .filter((sub) => race.subraces.filter((s) => s.name === sub.name).length === 1)
        .map((sub) => ({ race, sub }))
    );
    expect(all.length).toBeGreaterThan(0);
    // Запрос «<название подрасы> <название расы>» остаётся в той же подрасе
    for (const { race, sub } of all) {
      const found = findRaceData(race.id, `${sub.name} ${race.name}`);
      expect(found?.subrace?.id, `${race.id} / ${sub.name} ${race.name}`).toBe(sub.id);
    }
  });

  it("раса из MPMM выбирается только при явном указании, иначе берётся Legacy", () => {
    const mpmm = RACES_2014.filter((r) => r.editionVariant === "mpmm");
    expect(mpmm.length).toBe(30);
    for (const race of mpmm) {
      const base = race.id.replace(/-mpmm$/, "");
      const legacy = RACES_2014.find((r) => r.id === base && r.editionVariant === "legacy");
      if (!legacy) continue;
      expect(findRaceData(legacy.name)?.race.editionVariant, legacy.name).toBe("legacy");
      expect(findRaceData(`${legacy.name} (MPMM)`)?.race.editionVariant, legacy.name).toBe("mpmm");
    }
  });

  it("пустой и неизвестный запрос ничего не находит", () => {
    expect(findRaceData("")).toBeNull();
    expect(findRaceData(null)).toBeNull();
    expect(findRaceData("несуществующая раса xyz")).toBeNull();
  });
});
