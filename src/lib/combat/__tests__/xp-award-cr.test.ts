import { describe, it, expect } from "vitest";
import { enemyXP } from "../xp-award";

describe("enemyXP: опыт за врага по его CR", () => {
  it("берёт точный CR из данных монстра, а не округлённый уровень", () => {
    // Головорез: CR 1/2, в бою хранится как level 1
    expect(enemyXP({ level: 1, monsterData: JSON.stringify({ challengeRating: 0.5 }) })).toBe(100);
    expect(enemyXP({ level: 1, monsterData: JSON.stringify({ challengeRating: 0.125 }) })).toBe(25);
    expect(enemyXP({ level: 1, monsterData: JSON.stringify({ challengeRating: 0.25 }) })).toBe(50);
    expect(enemyXP({ level: 1, monsterData: JSON.stringify({ challengeRating: 0 }) })).toBe(10);
    expect(enemyXP({ level: 5, monsterData: JSON.stringify({ challengeRating: 5 }) })).toBe(1800);
  });

  it("без CR в данных монстра считает по уровню, как раньше", () => {
    expect(enemyXP({ level: 2, monsterData: "{}" })).toBe(450);
    expect(enemyXP({ level: 1, monsterData: null })).toBe(200);
  });
});
