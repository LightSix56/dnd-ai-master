import { createClient } from "../src/lib/ai/client";
import { buildSystemPrompt } from "../src/lib/ai/system-prompt";
import { streamText } from "ai";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const client = createClient();
  const modelName = process.env.AI_MODEL || "deepseek/deepseek-v4.1-flash";

  console.log(`[Querying AI DM Model: ${modelName}]`);

  const currentPrompt = buildSystemPrompt({
    name: "Ярость Пепельного Клыка",
    setting: "Забытые Королевства (Фаэрун), горы Пылающего Пика",
    tone: "heroic",
    difficulty: "normal",
    dmStyle: "balanced",
    ruleStrictness: "strict",
    restFrequency: "standard",
    startingLevel: 3,
    levelFrom: 3,
    levelTo: 5,
    worldDescription: "Каменистые ущелья у подножия дремлющего вулкана, заброшенная застава Культа Дракона.",
    customDmNotes: "Культ пытается пробудить древний алтарь пламени с помощью молодого красного дракона.",
    playerCharacter: "Эльфийка-следопыт Лира (ур. 3), с верным псом-компаньоном",
  });

  const queryMessage = `
Привет! Ты выступаешь в роли AI Dungeon Master для D&D 5e на базе модели DeepSeek в веб-приложении интерактивного листа персонажа.

Вот текущий системный промпт, который управляет твоим поведением (выдержка с ключевыми блоками):
\`\`\`markdown
${currentPrompt}
\`\`\`

В ходе тестовых игровых сессий и прохождения кампании («Ярость Пепельного Клыка») игроки и аналитики зафиксировали 4 конкретных пробела/дефекта в твоем повествовании:

1. **Преждевременное продвижение нарратива (Action Skipping / Игнорирование ожидания броска)**:
   Когда ты требуешь проверку или спасбросок (например, «Сделай проверку Восприятия»), но игрок в одном сообщении совмещает действие и заявку на следующий шаг («Осматриваю алтарь, взвожу арбалет и шепчу союзнику...»), ты часто сам решаешь исход проверки в пользу игрока или описываешь успех ДО того, как получен кубик d20, фактически аннулируя проверку.
2. **Утечка технического синтаксиса инструментов (DSML / XML tool leaking)**:
   При переходе в бой или вызове инструментов ты иногда выводишь в художественный текст сырые теги вида \`<｜｜DSML｜｜ invoke name="start_combat">...\`, что ломает четвертую стену и погружение.
3. **Дисбаланс темпа, эскалации и дозирования тайн (Pacing & Info-dumping)**:
   Ты иногда либо мгновенно форсируешь драку («Неожиданно на вас прыгают 3 культиста, бросаем инициативу!»), не давая игроку подготовиться/договориться/спрятаться, либо при первой же удачной проверке вываливаешь все тайны акта сразу (info-dumping), убивая интригу.
4. **Рассинхронизация состояний NPC и инвентаря**:
   Ты забываешь зарегистрировать появившихся NPC через инструмент \`record\` (поле \`characters\`), либо в тексте забываешь ранения, статус спутников или потраченные стрелы/зелья.

**ТВОЯ ЗАДАЧА КАК НЕЙРОНКИ-МАСТЕРА**:
Ответь откровенно и профессионально:
1. Что ты думаешь об этих замечаниях? В чем корень каждого из этих 4 сбоев в твоем поведении?
2. Какие конкретные улучшения текущего системного промпта ты предлагаешь? Напиши точные формулировки и новые правила, которые помогут тебе не совершать эти ошибки.
3. Что из этого, по твоему честному мнению, РЕАЛЬНО можно надежно решить промптом, а что ОБЯЗАН брать на себя программный код веб-приложения (клиент/серверный движок)?
`;

  const result = streamText({
    model: client.chat(modelName),
    prompt: queryMessage,
  });

  let fullOutput = "";
  for await (const chunk of result.textStream) {
    fullOutput += chunk;
    process.stdout.write(chunk);
  }

  // Save the raw output for reference and analysis
  const outputPath = path.resolve(__dirname, "../scratch/dm-prompt-feedback.md");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, fullOutput, "utf-8");
  console.log(`\n\n[Feedback successfully saved to ${outputPath}]`);
}

main().catch(console.error);
