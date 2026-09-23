import { createClient } from "../src/lib/ai/client";
import { streamText } from "ai";
import { resolveDmModel } from "../src/lib/ai/models";
import { buildSystemPrompt, type CampaignContext } from "../src/lib/ai/system-prompt";
import type { StoryArc } from "../src/lib/ai/story-arc";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const arcPath = path.resolve(__dirname, "../scratch/dragon-story-arc.json");
  const arc: StoryArc = JSON.parse(fs.readFileSync(arcPath, "utf8"));

  const campaignContext: CampaignContext = {
    name: arc.title,
    setting: "Вулканические отроги Пика Игнис и серные пещеры",
    tone: "heroic",
    difficulty: "hard",
    dmStyle: "balanced",
    ruleStrictness: "strict",
    startingLevel: 3,
    levelFrom: 3,
    levelTo: 5,
    playerCharacter:
      "Отряд из трёх героев 3-го уровня:\n" +
      "1. Торден Каменный Щит — воин-дворф в латах со щитом и длинным мечом.\n" +
      "2. Лира Солнечный Свет — жрица Домена Света с боевым молотом и солнечным символом.\n" +
      "3. Альдрин Звездочёт — волшебник Школы Воплощения с посохом и гримуаром.",
    worldDescription: "Культисты пробудили вирмлинга красного дракона.",
    storyArc: arc,
    currentAct: 0,
  };

  const systemPrompt = buildSystemPrompt(campaignContext);
  const client = createClient();
  const model = resolveDmModel();

  const transcriptPath = path.resolve(__dirname, "../scratch/dragon-narrative-transcript.md");
  let existingMd = fs.readFileSync(transcriptPath, "utf8");

  // Действие игроков: спасбросок Тордена и прорыв в главную каверну к боссу
  const userAction =
    "Ловкость Тордена: (14+1) = 15 — успех! Торден вовремя прикрывается башенным щитом от струи раскаленного пара.\n" +
    "Альдрин запускает 'Морозный луч' в культиста-разведчика (16 на попадание, 6 урона холодом), охлаждая породу под ногами, а Лира ослепляет оставшихся вспышкой света.\n" +
    "Сектанты с воплями отступают через узкий проход в главное Жерло Пепельного Клыка.\n" +
    "Герои врываются следом и видят: гигантская лавовая каверна (22x18 клеток), посреди река бурлящей магмы, через неё один узкий базальтовый мост. " +
    "На той стороне на вулканическом троне возвышается сам Пепельный Клык (Вирмлинг красного дракона), а двое элитных Драконьих Когтей встречают нас обнаженными ятаганами!\n" +
    "Опиши начало этого кульминационного боя и скомандуй бросить инициативу!";

  console.log("\n--- Запрос мастеру: Вход в бой с драконом ---");
  const result = streamText({
    model: client.chat(model),
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content:
          "Мы в Базальтовом ущелье у входа в Жерло вулкана. Культисты заманивают нас в гейзер, Торден идет первым.",
      },
      {
        role: "assistant",
        content:
          "Пол под ногами вздрагивает, гейзер у тропы готов сорваться. Сделай спасбросок Ловкости!",
      },
      {
        role: "user",
        content: userAction,
      },
    ],
    temperature: 0.8,
  });

  let masterText = "";
  console.log("\n[МАСТЕР (Объявление боя и инициативы)]:\n");
  for await (const chunk of result.textStream) {
    masterText += chunk;
    process.stdout.write(chunk);
  }
  console.log("\n");

  existingMd += `### 👤 Действие игроков (Прорыв в лавовую каверну)\n${userAction}\n\n`;
  existingMd += `### 🐉 Мастер Подземелий (Объявление битвы с Пепельным Клыком)\n${masterText}\n\n`;
  fs.writeFileSync(transcriptPath, existingMd, "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
