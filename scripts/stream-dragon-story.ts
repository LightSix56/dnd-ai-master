import { createClient } from "../src/lib/ai/client";
import { streamText } from "ai";
import { resolveStoryModel } from "../src/lib/ai/models";
import { storyArcSchema, type StoryArc } from "../src/lib/ai/story-arc";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

const ARC_INSTRUCTIONS = `Ты — сценарист кампаний D&D 5e. Ты отвечаешь ТОЛЬКО валидным JSON.
КРИТИЧНО: все КЛЮЧИ JSON строго на английском, ровно как в шаблоне запроса — не переводи их.
Все ЗНАЧЕНИЯ пиши на русском языке, живо и содержательно.
Никакого текста до или после JSON. Никаких пояснений.`;

async function main() {
  console.log("=== STEP 1: STREAMING GENERATION OF DRAGON STORY ARC ===");
  const client = createClient();
  const model = resolveStoryModel();
  console.log("Model:", model);

  const prompt = `Сгенерируй сюжетную завязку кампании D&D 5e и вводный Акт 1.

Кампания: "Ярость Пепельного Клыка"
Сеттинг: Вулканические пики Игнис и серные пещеры
Тон: heroic
Сложность боёв: hard
Стиль мастера: balanced
Строгость правил: strict
Диапазон уровней: с 3 по 5 включительно
Описание мира от игрока: Горный хребет Игнис охвачен подземными толчками. Сектанты Культа Дракона пробудили в лавовых расселинах молодого вирмлинга красного дракона по прозвищу Пепельный Клык и готовят ритуал подчинения вулканического пламени.
Пожелания игрока к мастеру: Сделай упор на атмосферу жара, серы, тактические угрозы лавы и фанатизм культа.

Верни строго JSON по шаблону (все ключи строго на английском):
{
  "title": "Ярость Пепельного Клыка",
  "premise": "завязка истории, 2-4 предложения",
  "mainThreat": "главная угроза кампании (BBEG) и замысел злодея",
  "levelFrom": 3,
  "levelTo": 5,
  "villains": [
    {"name": "Пепельный Клык", "role": "Молодой красный дракон (вирмлинг)", "motivation": "стремление подчинить вулкан и сжечь перевалы", "secret": "питается магматическим кристаллом в глубине кратера", "appearsInAct": 1},
    {"name": "Игнарис Искатель Пламени", "role": "Лидер Культа Дракона", "motivation": "служение дракону ради обретения силы пламени", "secret": "готов принести сектантов в жертву ради ярости вирмлинга", "appearsInAct": 1}
  ],
  "acts": [
    {
      "name": "Пробуждение в сере",
      "levelFrom": 3,
      "levelTo": 4,
      "goal": "Найти логово культистов и остановить пробуждение дракона",
      "summary": "краткое содержание первого акта, 3-5 предложений",
      "scenes": [
        {"name": "Сцена 1: Пепельный дозор", "location": "Разрушенный дозорный пост у подножия Пика Игнис", "description": "Обугленные останки сторожевой башни, запах едкой серы, дымящиеся трещины в земле.", "encounter": "Исследование следов когтей, осмотр выживших и обнаружение серного тракта"},
        {"name": "Сцена 2: Базальтовое ущелье", "location": "Серная расщелина и узкая тропа в жерло", "description": "Жаркий серный воздух обжигает легкие, свист ядовитого пара из расщелин.", "encounter": "Преодоление серных гейзеров и стычка со скаутами культа"},
        {"name": "Сцена 3: Жерло Пепельного Клыка", "location": "Лавовая пещера с кипящей магмой и базальтовым мостом", "description": "Огромный подземный грот, расколотый рекой кипящей лавы. На возвышении восседает чешуйчатый вирмлинг в окружении культистов.", "encounter": "Тактическая битва с Пепельным Клыком и элитными стражами Культа"}
      ],
      "twist": "Культисты не просто поклоняются дракону, они использовали древний артефакт, чтобы подчинить его ярость себе.",
      "branches": [
        {"ifPlayer": "сначала уничтожает культистов", "then": "дракон впадает в неконтролируемое буйство и атакует без тактики"},
        {"ifPlayer": "разрушает магматический фокус на алтаре", "then": "дракон теряет бонус к огненному урону и может отступить"}
      ],
      "rewards": "Чешуя вирмлинга, кинжал из обсидиана культистов, 400 зм в расплавленных самоцветах, карта тайных рудников"
    }
  ],
  "finale": "Если герои побеждают, перевал Игнис спасен от сожжения, но пробуждение вирмлинга привлекает внимание древней драконицы-матери."
}
`;

  console.log("Sending streaming request to model...");
  const start = Date.now();
  const streamResult = streamText({
    model: client.chat(model),
    system: ARC_INSTRUCTIONS,
    prompt,
    temperature: 0.7,
  });

  let fullOutput = "";
  for await (const chunk of streamResult.textStream) {
    fullOutput += chunk;
    process.stdout.write(chunk);
  }

  console.log(`\n\n[Generation finished in ${((Date.now() - start) / 1000).toFixed(1)}s]`);
  const jsonStr = extractJson(fullOutput);
  const parsed = JSON.parse(jsonStr);
  const validated = storyArcSchema.parse({
    ...parsed,
    generatedAt: new Date().toISOString(),
    model,
  });

  const outPath = path.resolve(__dirname, "../scratch/dragon-story-arc.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(validated, null, 2), "utf8");

  console.log("\n Story Arc Successfully Validated & Saved to:", outPath);
}

main().catch((err) => {
  console.error("Story streaming generation failed:", err);
  process.exit(1);
});
