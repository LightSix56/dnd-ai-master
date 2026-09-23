import { describe, it, expect } from "vitest";
import { validateCharacterForRoom, filterUserCharactersForRoom } from "../validation";

describe("Character Level Validation Engine (Phase 1)", () => {
  it("approves a character when level exactly matches room startingLevel", () => {
    const char = { name: "Кроуг", level: 1 };
    const result = validateCharacterForRoom(char, 1);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects a higher level character with descriptive Russian message", () => {
    const char = { name: "Кроуг", level: 5 };
    const result = validateCharacterForRoom(char, 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Кроуг");
    expect(result.error).toContain("5 уровень");
    expect(result.error).toContain("требуется ровно 1 уровень");
  });

  it("rejects a lower level character with descriptive Russian message", () => {
    const char = { name: "Лира", level: 2 };
    const result = validateCharacterForRoom(char, 3);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Лира");
    expect(result.error).toContain("2 уровень");
    expect(result.error).toContain("требуется ровно 3 уровень");
  });

  it("rejects invalid, null, negative, or non-integer levels", () => {
    expect(validateCharacterForRoom({ name: "Тест", level: 0 }, 1).valid).toBe(false);
    expect(validateCharacterForRoom({ name: "Тест", level: -1 }, 1).valid).toBe(false);
    expect(validateCharacterForRoom({ name: "Тест", level: NaN }, 1).valid).toBe(false);
    expect(validateCharacterForRoom({ name: "Тест", level: 1.5 }, 1).valid).toBe(false);
    expect(validateCharacterForRoom({ name: "Тест", level: null as any }, 1).valid).toBe(false);
    expect(validateCharacterForRoom({ name: "Тест", level: undefined as any }, 1).valid).toBe(false);
  });

  it("extracts level from data object if top-level level is missing", () => {
    const rawChar = {
      name: "Эланд",
      data: { level: 3 },
    };
    const result = validateCharacterForRoom(rawChar, 3);
    expect(result.valid).toBe(true);
  });

  it("filters a list of user characters into compliant and non-compliant groups", () => {
    const characters = [
      { id: "1", name: "Кроуг", level: 1, class: "Варвар" },
      { id: "2", name: "Лира", level: 3, class: "Жрица" },
      { id: "3", name: "Эланд", level: 1, class: "Следопыт" },
      { id: "4", name: "Морден", level: 10, class: "Волшебник" },
    ];

    const evaluated = filterUserCharactersForRoom(characters, 1);

    expect(evaluated.compliant).toHaveLength(2);
    expect(evaluated.compliant.map((c) => c.name)).toEqual(["Кроуг", "Эланд"]);

    expect(evaluated.nonCompliant).toHaveLength(2);
    expect(evaluated.nonCompliant[0].name).toBe("Лира");
    expect(evaluated.nonCompliant[0].reason).toContain("3 уровень");
    expect(evaluated.nonCompliant[1].name).toBe("Морден");
    expect(evaluated.nonCompliant[1].reason).toContain("10 уровень");
  });
});
