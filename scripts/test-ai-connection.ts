import { createClient } from "../src/lib/ai/client";
import { generateText } from "ai";
import { resolveStoryModel, resolveDmModel } from "../src/lib/ai/models";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  console.log("Checking AI credentials...");
  console.log("AI_BASE_URL:", process.env.AI_BASE_URL);
  console.log("AI_MODEL:", resolveDmModel());
  console.log("AI_STORY_MODEL:", resolveStoryModel());
  
  const client = createClient();
  const res = await generateText({
    model: client.chat(resolveDmModel()),
    prompt: "Ответь одним коротким предложением: привет, путник!",
    maxTokens: 50,
  });

  console.log("AI Response:", res.text);
}

main().catch((err) => {
  console.error("AI check error:", err);
  process.exit(1);
});
