import { createClient } from "../src/lib/ai/client";
import { generateText } from "ai";
import { resolveStoryModel } from "../src/lib/ai/models";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const client = createClient();
  const model = resolveStoryModel();
  console.log("Testing polza.ai ping with model:", model);
  const start = Date.now();
  const res = await generateText({
    model: client.chat(model),
    prompt: "Верни JSON { \"ping\": \"pong\" }",
    maxTokens: 50,
  });
  console.log(`Response in ${Date.now() - start}ms:`, res.text);
}

main().catch(console.error);
