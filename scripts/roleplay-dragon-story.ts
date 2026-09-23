import { createClient } from "../src/lib/ai/client";
import { streamText } from "ai";
import { resolveDmModel } from "../src/lib/ai/models";
import { buildSystemPrompt, type CampaignContext } from "../src/lib/ai/system-prompt";
import type { StoryArc } from "../src/lib/ai/story-arc";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function streamTurn(
  client: ReturnType<typeof createClient>,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  promptLabel: string
): Promise<string> {
  console.log(`\n\n======================================================================`);
  console.log(`[МАСТЕР (${promptLabel})]:`);
  console.log(`======================================================================`);

  const result = streamText({
    model: client.chat(model),
    system: systemPrompt,
    messages,
    temperature: 0.8,
  });

  let full = "";
  for await (const chunk of result.textStream) {
    full += chunk;
    process.stdout.write(chunk);
  }
  console.log("\n");
  return full;
}

async function main() {
  console.log("=== STEP 2: INTERACTIVE AI MASTER ROLEPLAY ===");
  const arcPath = path.resolve(__dirname, "../scratch/dragon-story-arc.json");
  if (!fs.existsSync(arcPath)) {
    throw new Error(`Файл арки не найден: ${arcPath}`);
  }

  const arc: StoryArc = JSON.parse(fs.readFileSync(arcPath, "utf8"));
  console.log(`Загружена сюжетная арка: "${arc.title}"`);

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
    worldDescription:
      "Подземные толчки сотрясают хребет Игнис. Культисты пробудили вирмлинга красного дракона.",
    storyArc: arc,
    currentAct: 0,
  };

  const systemPrompt = buildSystemPrompt(campaignContext);
  const client = createClient();
  const model = resolveDmModel();

  const conversation: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Ход 1: Вводная сцена мастера
  const introPrompt =
    "Начни игру как Мастер Подземелий! Опиши Сцену 1: герои Торден, Лира и Альдрин подошли к подножию Пика Игнис. Впереди обугленные руины дозорного поста, воздух пахнет серой и гарью. Создай атмосферу и спроси, что делают герои.";
  conversation.push({ role: "user", content: introPrompt });
  const reply1 = await streamTurn(client, model, systemPrompt, conversation, "Сцена 1: Пепельный дозор");
  conversation.push({ role: "assistant", content: reply1 });

  // Ход 2: Действия героев — расследование
  console.log(`\n\n----------------------------------------------------------------------`);
  console.log(`[ДЕЙСТВИЕ ГЕРОЕВ 1]: Расследование на дозорном посту`);
  console.log(`----------------------------------------------------------------------`);
  const playerAction1 =
    "Торден внимательно осматривает землю и останки башни (Внимательность +1, Выживание +1) в поисках следов нападавших.\n" +
    "Лира читает молитву свету (Религия +3) и осматривает тела стражников, проверяя, не было ли ритуального осквернения.\n" +
    "Альдрин касается обугленного камня и анализирует оплавленный гранит (Магия +5, Природа +3), чтобы определить возраст и силу пламени.";
  console.log(playerAction1);
  conversation.push({ role: "user", content: playerAction1 });
  const reply2 = await streamTurn(client, model, systemPrompt, conversation, "Улики и серный тракт");
  conversation.push({ role: "assistant", content: reply2 });

  // Ход 3: Действия героев — переход к лавовому ущелью и логову
  console.log(`\n\n----------------------------------------------------------------------`);
  console.log(`[ДЕЙСТВИЕ ГЕРОЕВ 2]: Вход в базальтовое ущелье и лавовую каверну`);
  console.log(`----------------------------------------------------------------------`);
  const playerAction2 =
    "Герои следуют по серному тракту в Базальтовое ущелье. Торден идёт первым, держа щит перед собой на случай серных гейзеров и засад. Лира зажигает Свет на навершии молота, чтобы видеть сквозь дым. Альдрин наготове с морозным лучом.\n" +
    "Мы пробираемся сквозь серные пары и заглядываем в гигантскую каверну Жерла Пепельного Клыка, где протекает река кипящей магмы и слышно драконье дыхание.";
  console.log(playerAction2);
  conversation.push({ role: "user", content: playerAction2 });
  const reply3 = await streamTurn(client, model, systemPrompt, conversation, "Сцена 3: Вход в Жерло и начало битвы");
  conversation.push({ role: "assistant", content: reply3 });

  // Сохраняем протокол
  const transcriptPath = path.resolve(__dirname, "../scratch/dragon-narrative-transcript.md");
  let mdOutput = `# Нарративный протокол: Ярость Пепельного Клыка\n\n`;
  mdOutput += `**Сюжетная арка:** ${arc.title}\n\n`;
  mdOutput += `**Премис:** ${arc.premise}\n\n`;
  conversation.forEach((turn, idx) => {
    if (turn.role === "user") {
      mdOutput += `### 👤 Запрос/Действие игроков (Шаг ${Math.ceil((idx + 1) / 2)})\n${turn.content}\n\n`;
    } else {
      mdOutput += `### 🐉 Мастер Подземелий (D&D 5e Master)\n${turn.content}\n\n`;
    }
  });

  fs.writeFileSync(transcriptPath, mdOutput, "utf8");
  console.log(`\n✅ Нарративный протокол успешно сохранён: ${transcriptPath}`);
}

main().catch((err) => {
  console.error("Roleplay script error:", err);
  process.exit(1);
});
