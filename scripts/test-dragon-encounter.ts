import { generateEncounter } from "../src/lib/combat/encounters/encounter-generator";

async function main() {
  const enc = await generateEncounter({
    party: [
      { id: "hero_fighter", level: 3, name: "Торден" },
      { id: "hero_cleric", level: 3, name: "Лира" },
      { id: "hero_wizard", level: 3, name: "Альдрин" },
    ],
    difficulty: "hard",
    mapPresetId: "lava_cave",
    biome: "lava",
    storyFaction: {
      bossMonsterId: "6790-red-guard-drake", // Красный сторожевой дрейк (CR 2, 52 HP, дыхание огнем)
      creatureTypes: ["dragon", "humanoid"],
      tags: ["dragon", "cultist"],
    },
    archetype: "boss_minions",
  });

  console.log("Encounter generated successfully!");
  console.log("Map:", enc.mapPreset.name, `(${enc.mapPreset.gridWidth}x${enc.mapPreset.gridHeight})`);
  console.log("Target XP:", enc.targetXP, "| Adjusted XP:", enc.adjustedXP, "| Actual XP:", enc.actualXP);
  console.log("Enemies count:", enc.enemies.length);
  enc.enemies.forEach((e, idx) => {
    const c = e.combatant!;
    console.log(` [${idx + 1}] ${c.name} (${e.role}) - CR ${e.monster.challengeRating}, HP: ${c.hpMax}, AC: ${c.ac}, Pos: [${c.x}, ${c.y}]`);
    console.log(`     Attacks: ${c.attacks.map(a => `${a.name} (+${a.attackBonus}, ${a.damage.map(d=>d.dice+'+'+d.mod).join('/')})`).join(", ")}`);
    if (c.monsterTraits && c.monsterTraits.length > 0) {
      console.log(`     Traits: ${c.monsterTraits.map(t => t.name).join(", ")}`);
    }
  });
}

main().catch(err => console.error(err));
