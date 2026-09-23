import { createClient } from "../src/lib/ai/client";
import { generateText, streamText } from "ai";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const client = createClient();
  const models = [
    "deepseek/deepseek-v4.1-flash",
    "deepseek/deepseek-v4-flash",
    "google/gemini-2.5-flash-lite"
  ];

  for (const m of models) {
    console.log(`\nTesting stream with model: ${m}...`);
    const start = Date.now();
    try {
      const result = streamText({
        model: client.chat(m),
        prompt: "Напиши 3 предложения о логове красного дракона в вулкане.",
      });

      let fullText = "";
      for await (const chunk of result.textStream) {
        fullText += chunk;
        process.stdout.write(chunk);
      }
      console.log(`\n[Done in ${Date.now() - start}ms, length: ${fullText.length}]`);
      break; // found working model
    } catch (e: any) {
      console.error(`Model ${m} failed:`, e.message);
    }
  }
}

main().catch(console.error);
