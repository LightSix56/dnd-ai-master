#!/usr/bin/env node
// Синхронизация src/lib/combat/data/races-2014.json из общего каталога dnd-shared.
// Запуск: node scripts/sync-dnd-shared-races.mjs [путь к races.json]

import fs from "node:fs";
import path from "node:path";

const defaultSource = fs.existsSync("C:/antig/dnd-shared/data/races.json")
  ? "C:/antig/dnd-shared/data/races.json"
  : path.resolve(process.cwd(), "../dnd-shared/data/races.json");

const input = process.argv[2] || process.env.DND_SHARED_RACES || defaultSource;
const output = process.argv[3] || "src/lib/combat/data/races-2014.json";

if (!fs.existsSync(input)) {
  console.error(`Не найден файл рас dnd-shared: ${input}`);
  process.exit(1);
}

const raw = fs.readFileSync(input, "utf8");
const parsed = JSON.parse(raw);
if (!Array.isArray(parsed)) {
  console.error(`Ожидался массив рас в ${input}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(parsed, null, 1) + "\n", "utf8");
const subraces = parsed.reduce((n, r) => n + (r.subraces?.length ?? 0), 0);
console.log(`Synced ${parsed.length} races (${subraces} subraces) -> ${output}`);
