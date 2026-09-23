import { describe, it, expect } from "vitest";
import { formatCharacterCardForPicker } from "../CharacterPickerModal";

describe("CharacterPickerModal helpers (Phase 2)", () => {
  it("formats compliant character for selection", () => {
    const raw = {
      id: "char-1",
      name: "Кроуг",
      data: {
        level: 1,
        class: "Варвар",
        race: "Полуорк",
        subclass: "Берсерк",
        hpMax: 14,
        armorClass: 13,
      },
      portrait_url: "https://example.com/kroug.png",
    };

    const card = formatCharacterCardForPicker(raw, 1);

    expect(card.id).toBe("char-1");
    expect(card.name).toBe("Кроуг");
    expect(card.level).toBe(1);
    expect(card.className).toBe("Варвар");
    expect(card.race).toBe("Полуорк");
    expect(card.isSelectable).toBe(true);
    expect(card.reason).toBeUndefined();
    expect(card.portraitUrl).toBe("https://example.com/kroug.png");
  });

  it("marks non-compliant level character as unselectable with explanation", () => {
    const raw = {
      id: "char-2",
      name: "Лира",
      data: {
        level: 3,
        class: "Жрица",
        race: "Человек",
      },
    };

    const card = formatCharacterCardForPicker(raw, 1);

    expect(card.name).toBe("Лира");
    expect(card.level).toBe(3);
    expect(card.isSelectable).toBe(false);
    expect(card.reason).toContain("3 уровень");
    expect(card.reason).toContain("требуется ровно 1 уровень");
  });
});
