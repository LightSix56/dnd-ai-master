import { describe, it, expect } from "vitest";
import { generateEncounter } from "../encounter-generator";

describe("generateEncounter: карта собирается генератором", () => {
  it("бой получает процедурную пещеру, бойцы стоят не в скале, герои — в зоне партии", async () => {
    const encounter = await generateEncounter({
      party: [
        { id: "p1", name: "Пятно", level: 1 },
        { id: "p2", name: "Клык", level: 1 },
      ],
      difficulty: "medium",
      biome: "forest_ambush",
      mapPresetId: "",
      mapSeed: 5,
    });

    const map = encounter.mapPreset;
    expect(map.backgroundUrl).toMatch(/^procgen:forest\?seed=\d+&v=1$/);

    const wall = new Set<string>();
    for (const el of map.elements.filter((e) => e.type === "wall")) {
      for (let dy = 0; dy < el.height; dy++) for (let dx = 0; dx < el.width; dx++) wall.add(`${el.x + dx},${el.y + dy}`);
    }
    const partyZone = new Set(map.spawnZones.find((z) => z.name === "party")!.cells.map((c) => `${c.x},${c.y}`));

    for (const c of encounter.combatants ?? []) {
      expect(wall.has(`${c.x},${c.y}`), c.name).toBe(false);
      if (c.type === "player") expect(partyZone.has(`${c.x},${c.y}`), c.name).toBe(true);
    }
  }, 30000);
});
