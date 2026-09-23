import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { MonsterDefinition, MonsterManifestEntry } from "../types";

const COMPENDIUM_DIR = path.resolve(process.cwd(), "src/data/compendium/monsters");
const MANIFEST_PATH = path.join(COMPENDIUM_DIR, "monsters-manifest.json");

describe("Compendium Manifest & Data Integrity", () => {
  it("should have a valid monsters-manifest.json", () => {
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);

    const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
    const manifest: MonsterManifestEntry[] = JSON.parse(raw);

    expect(Array.isArray(manifest)).toBe(true);
    expect(manifest.length).toBeGreaterThanOrEqual(10);

    // Verify first 10 entries have required structure
    for (const entry of manifest.slice(0, 10)) {
      expect(entry.id).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.type).toBeTruthy();
      expect(typeof entry.challengeRating).toBe("number");
      expect(typeof entry.hpAverage).toBe("number");
      expect(typeof entry.ac).toBe("number");
      expect(entry.filePath).toBeTruthy();

      // Check file exists on disk
      const filePath = path.join(COMPENDIUM_DIR, entry.filePath);
      expect(fs.existsSync(filePath)).toBe(true);

      const monsterRaw = fs.readFileSync(filePath, "utf8");
      const monster: MonsterDefinition = JSON.parse(monsterRaw);

      expect(monster.id).toBe(entry.id);
      expect(monster.name).toBe(entry.name);
      expect(monster.type).toBe(entry.type);
      expect(monster.challengeRating).toBe(entry.challengeRating);
      expect(monster.abilities).toBeDefined();
      expect(monster.abilities.str).toBeGreaterThanOrEqual(1);
      expect(monster.hitPoints.average).toBeGreaterThanOrEqual(1);
      expect(monster.armorClass.value).toBeGreaterThanOrEqual(1);
    }
  });
});
