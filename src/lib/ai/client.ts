// Общий клиент к OpenAI-совместимому провайдеру (claudehub.fun).
// Здесь же лежит починка ответа провайдера — она нужна и чату, и генератору арки.

import { createOpenAI } from "@ai-sdk/openai";

export type AuthMode = "bearer" | "x-api-key" | "raw";

// На длинных ответах провайдер отвечает с другого бэкенда, который не отдаёт
// choices[].index. В @ai-sdk/openai это поле объявлено обязательным
// (openaiChatResponseSchema), поэтому SDK падает с AI_APICallError при HTTP 200.
// Дописываем индекс сами — иначе любой длинный ответ считается ошибкой.
function normalizeResponse(body: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  const data = parsed as { choices?: Array<{ index?: number }> };
  if (!Array.isArray(data.choices)) return body;
  let changed = false;
  data.choices.forEach((choice, i) => {
    if (typeof choice?.index !== "number") {
      choice.index = i;
      changed = true;
    }
  });
  return changed ? JSON.stringify(data) : body;
}

export function createClient(
  userApiKey?: string,
  authMode?: AuthMode,
  userBaseURL?: string
) {
  // Триммим ключ — частая причина "Неверный формат API ключа"
  const cleanKey = (userApiKey || process.env.AI_API_KEY || "").trim();
  const baseURL = (userBaseURL || process.env.AI_BASE_URL || "https://polza.ai/api/v1")
    .trim()
    .replace(/\/+$/, "");
  const mode = authMode || "bearer";

  const customFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    // Удаляем стандартный Authorization от OpenAI SDK
    headers.delete("Authorization");
    if (mode === "bearer") {
      headers.set("Authorization", `Bearer ${cleanKey}`);
    } else if (mode === "x-api-key") {
      headers.set("x-api-key", cleanKey);
    } else if (mode === "raw") {
      headers.set("Authorization", cleanKey);
    }

    const res = await fetch(input, { ...init, headers });

    // Стрим и ошибки отдаём как есть: чанки читаются построчно, а не целиком
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || contentType.includes("text/event-stream")) return res;

    const text = await res.text();
    const normalized = normalizeResponse(text);
    if (normalized === text) return new Response(text, res);
    return new Response(normalized, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };

  return createOpenAI({ baseURL, apiKey: cleanKey, fetch: customFetch });
}
