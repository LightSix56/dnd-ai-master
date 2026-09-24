import { describe, it, expect } from "vitest";
import { formatCharacterCardForPicker, formatCampaignCharacterForPicker } from "../CharacterPickerModal";

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

  describe("formatCampaignCharacterForPicker", () => {
    it("formats unassigned campaign character as selectable", () => {
      const char = {
        id: "camp-char-1",
        name: "Торин",
        race: "Дварф",
        className: "Воин",
        level: 1,
        hpCurrent: 12,
        hpMax: 12,
        ac: 16,
        assignedTo: null,
      };

      const card = formatCampaignCharacterForPicker(char, 1, "my-user-id");
      expect(card.id).toBe("camp-char-1");
      expect(card.name).toBe("Торин");
      expect(card.isSelectable).toBe(true);
      expect(card.isAssigned).toBe(false);
      expect(card.isOwnedByMe).toBe(false);
    });

    it("marks character assigned to another user as unselectable", () => {
      const char = {
        id: "camp-char-2",
        name: "Эльронд",
        race: "Эльф",
        className: "Маг",
        level: 1,
        assignedTo: { userId: "other-user-id", characterName: "Эльронд" },
      };

      const card = formatCampaignCharacterForPicker(char, 1, "my-user-id");
      expect(card.isSelectable).toBe(false);
      expect(card.isAssigned).toBe(true);
      expect(card.isOwnedByMe).toBe(false);
      expect(card.reason).toContain("занят");
    });

    it("marks character assigned to current user as selectable and owned", () => {
      const char = {
        id: "camp-char-1",
        name: "Торин",
        race: "Дварф",
        className: "Воин",
        level: 1,
        assignedTo: { userId: "my-user-id", characterName: "Торин" },
      };

      const card = formatCampaignCharacterForPicker(char, 1, "my-user-id");
      expect(card.isSelectable).toBe(true);
      expect(card.isAssigned).toBe(true);
      expect(card.isOwnedByMe).toBe(true);
    });
  });
});
