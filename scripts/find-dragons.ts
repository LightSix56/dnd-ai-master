import * as fs from "node:fs";
import * as path from "node:path";
import type { MonsterManifestEntry } from "../src/lib/combat/monsters/types";

const MANIFEST_PATH = path.resolve(__dirname, "../src/data/compendium/monsters/monsters-manifest.json");
const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
const manifest: MonsterManifestEntry[] = JSON.parse(raw);

console.log("Total monsters in compendium:", manifest.length);

const dragons = manifest.filter(
  (m) => m.type === "dragon" || m.name.toLowerCase().includes("дракон")
);

console.log("Total dragons found:", dragons.length);
dragons
  .filter((d) => {
    const cr = typeof d.challengeRating === "number" ? d.challengeRating : parseFloat(String(d.challengeRating));
    return cr <= 5;
  })
  .forEach((d) => console.log(` - ${d.name} | CR: ${d.challengeRating} | HP: ${d.hpAverage} | AC: ${d.ac} | Slug: ${d.slug}`));
