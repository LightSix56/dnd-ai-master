import { describe, it, expect } from "vitest";
import { generateEncounter } from "../encounters/encounter-generator";
import { applyFormation } from "../generator";
import { FORMATIONS } from "../formation";
import { SIZE_CELLS } from "../types";
import type { EncounterDifficulty, SquadArchetype } from "../encounters/types";

// Три героя 1 уровня, только генератор и карта: на любом сочетании никто не стоит на стене, воде, лаве
// и друг на друге (в том числе крупные существа, занимающие несколько клеток)
const party = ["Воин", "Плут", "Жрец"].map((name, i) => ({ id: `h${i}`, name, level: 1 }));
const BLOCKING = ["wall", "window", "obstacle", "lava", "water"];

const cases: Array<{ difficulty: EncounterDifficulty; archetype?: SquadArchetype; biome: string }> = [
  { difficulty: "medium", archetype: "boss_minions", biome: "cave" },
  { difficulty: "hard", archetype: "tactical_squad", biome: "swamp" },
  { difficulty: "deadly", archetype: "solo_boss", biome: "tavern" },
  { difficulty: "overwhelming", archetype: "horde", biome: "urban" },
  { difficulty: "overwhelming", archetype: "tactical_squad", biome: "dungeon" },
];

describe("генератор боя: партия 1 уровня", () => {
  for (const c of cases) {
    for (const formation of FORMATIONS) {
      it(`${c.difficulty} ${c.archetype} ${c.biome} / ${formation}`, async () => {
        const enc = await generateEncounter({ party, difficulty: c.difficulty, biome: c.biome, archetype: c.archetype, mapSeed: 4242, mapPresetId: "" });
        applyFormation(enc, formation, enc.mapPreset.gridWidth, enc.mapPreset.gridHeight);

        const blocked = new Set<string>();
        for (const el of enc.mapPreset.elements) {
          if (!BLOCKING.includes(el.type)) continue;
          for (let dx = 0; dx < (el.width || 1); dx++) for (let dy = 0; dy < (el.height || 1); dy++) blocked.add(`${el.x + dx},${el.y + dy}`);
        }
        const fighters = [
          ...(enc.combatants ?? []).filter((x) => x.type !== "enemy"),
          ...enc.enemies.map((e) => e.combatant!),
        ];
        const seen = new Map<string, string>();
        for (const f of fighters) {
          const n = SIZE_CELLS[f.size] ?? 1;
          for (let dx = 0; dx < n; dx++) {
            for (let dy = 0; dy < n; dy++) {
              const x = f.x + dx;
              const y = f.y + dy;
              const k = `${x},${y}`;
              expect(x >= 0 && y >= 0 && x < enc.mapPreset.gridWidth && y < enc.mapPreset.gridHeight, `${f.name} в границах`).toBe(true);
              expect(blocked.has(k), `${f.name} не на препятствии (${k})`).toBe(false);
              expect(seen.get(k), `${f.name} и ${seen.get(k)} в одной клетке (${k})`).toBeUndefined();
              seen.set(k, f.name);
            }
          }
        }
      }, 60000);
    }
  }
});
