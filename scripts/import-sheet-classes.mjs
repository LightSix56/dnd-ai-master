#!/usr/bin/env node
// Сборка src/lib/combat/data/class-subclasses.json из данных сайта листа персонажа.
//
// Вход — src/data/compendium/classes.ts листа (dnd5e-character-sheet): классы и подклассы с умениями
// по уровням. Берутся только официальные классы; «Альтернативный варвар» (laserllama) — хоумбрю, он
// пропускается. На эти названия подклассов и умений ссылаются правила в src/lib/combat/classes/*.ts.
//
// Запуск: node scripts/import-sheet-classes.mjs <путь к classes.ts листа> [выход.json]
import fs from "node:fs";
import path from "node:path";

const [input, output = "src/lib/combat/data/class-subclasses.json"] = process.argv.slice(2);
if (!input) {
  console.error("Укажите путь к src/data/compendium/classes.ts сайта листа");
  process.exit(1);
}

const HOMEBREW_CLASSES = new Set(["alt-barbarian"]);

const source = fs.readFileSync(input, "utf8");
const start = source.indexOf("export const DND_COMPENDIUM_CLASSES");
const body = source.slice(source.indexOf("= [", start) + 2);
// Массив в файле листа — чистые данные (JSON с кавычками), поэтому разбирается как выражение
const classes = new Function(`return (${body.slice(0, body.indexOf("\n];") + 2)});`)();

const subclasses = [];
for (const cls of classes) {
  if (HOMEBREW_CLASSES.has(cls.id)) continue;
  for (const sc of cls.subclasses) {
    subclasses.push({
      classId: cls.id,
      className: cls.name,
      id: sc.id,
      name: sc.name,
      nameEn: sc.nameEn,
      source: sc.source ?? "",
      features: sc.features.map((f) => ({ level: f.level, name: f.name, description: f.description })),
    });
  }
}

const out = {
  _note: "Собрано scripts/import-sheet-classes.mjs из данных сайта листа. Вручную не править.",
  subclasses,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(out, null, 1) + "\n");
console.log(`${subclasses.length} подклассов, ${subclasses.reduce((n, s) => n + s.features.length, 0)} умений → ${output}`);
