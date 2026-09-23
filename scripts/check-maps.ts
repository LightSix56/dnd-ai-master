import { MAP_PRESETS } from "../src/lib/combat/maps/presets";

console.log("Available map presets:");
Object.values(MAP_PRESETS).forEach((p) => {
  console.log(` - ID: ${p.id} | Name: ${p.name} | Biome: ${p.biome} | Dimensions: ${p.gridWidth}x${p.gridHeight}`);
});
