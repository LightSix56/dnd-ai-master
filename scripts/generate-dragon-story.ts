import { generateStoryArc } from "../src/lib/ai/story-arc";
import { resolveStoryModel } from "../src/lib/ai/models";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  console.log("=== STEP 1: GENERATING DRAGON STORY ARC ===");
  const model = resolveStoryModel();
  console.log("Using model:", model);

  const arc = await generateStoryArc({
    params: {
      name: "Ярость Пепельного Клыка",
      setting: "Вулканические пики Игнис и серные пещеры",
      tone: "heroic",
      difficulty: "hard",
      dmStyle: "balanced",
      ruleStrictness: "strict",
      levelFrom: 3,
      levelTo: 5,
      worldDescription:
        "Горный хребет Игнис охвачен подземными толчками. Сектанты Культа Дракона пробудили в лавовых расселинах молодого вирмлинга красного дракона по прозвищу Пепельный Клык и готовят ритуал подчинения вулканического пламени.",
      customDmNotes:
        "Сделай упор на атмосферу жара, серы, тактические угрозы лавы и фанатизм культа.",
      language: "ru",
    },
    model,
    onProgress: (p) => {
      console.log(`[Progress] ${p.stage}: ${p.stageLabel} (${p.actsDone}/${p.actsTotal})`);
    },
  });

  const outPath = path.resolve(__dirname, "../scratch/dragon-story-arc.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(arc, null, 2), "utf8");

  console.log("\n Story Arc Generated Successfully!");
  console.log("Title:", arc.title);
  console.log("Premise:", arc.premise);
  console.log("Main Threat:", arc.mainThreat);
  console.log("Villains count:", arc.villains.length);
  arc.villains.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.name} (${v.role}) - Мотив: ${v.motivation} | Тайна: ${v.secret}`);
  });
  console.log("\nActs count:", arc.acts.length);
  arc.acts.forEach((act, i) => {
    console.log(`\n--- АКТ ${i + 1}: ${act.name} (ур. ${act.levelFrom}-${act.levelTo}) ---`);
    console.log("Цель:", act.goal);
    console.log("Сводка:", act.summary);
    console.log("Сцены:");
    act.scenes.forEach((sc, sIdx) => {
      console.log(`  [Сцена ${sIdx + 1}] ${sc.name} (${sc.location})`);
      console.log(`    Описание: ${sc.description}`);
      console.log(`    Энкаунтер: ${sc.encounter}`);
    });
    console.log("Поворот:", act.twist);
    console.log("Развилки:", act.branches.map((b) => `Если ${b.ifPlayer} -> ${b.then}`).join(" | "));
    console.log("Награды:", act.rewards);
  });
  console.log("\nFinale:", arc.finale);
}

main().catch((err) => {
  console.error("Story generation failed:", err);
  process.exit(1);
});
