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

// Claude кэширует промпт только по явной метке cache_control (DeepSeek и OpenAI — сами, по
// совпадающему префиксу). Без меток у Claude не было ни одного попадания в кэш: каждый ход
// заново оплачивался весь системный промпт (~18 тыс. токенов).
// Метки ставим в формате OpenAI-совместимых агрегаторов (как у OpenRouter) — на текстовый блок:
//  1. на системный промпт — он не меняется между ходами (вместе с ним кэшируются и инструменты);
//  2. на предпоследнее сообщение — история до него тоже стабильна, а изменчивый срез сцены
//     дописывается только в последнее сообщение (см. caching/ephemeral-tail).
// У Claude не больше 4 меток на запрос — используем две.
const CACHE_CONTROL = { type: "ephemeral" } as const;

export function isClaudeModel(model: unknown): boolean {
  return typeof model === "string" && /(^anthropic\/|claude)/i.test(model);
}

function withCacheControl(message: Record<string, unknown>): Record<string, unknown> {
  const content = message.content;
  if (typeof content === "string") {
    if (!content) return message;
    return { ...message, content: [{ type: "text", text: content, cache_control: CACHE_CONTROL }] };
  }
  if (Array.isArray(content) && content.length > 0) {
    // Метку можно поставить только на текстовый блок — ищем последний
    for (let i = content.length - 1; i >= 0; i--) {
      const part = content[i] as Record<string, unknown>;
      if (part?.type === "text" && typeof part.text === "string" && part.text) {
        const next = [...content];
        next[i] = { ...part, cache_control: CACHE_CONTROL };
        return { ...message, content: next };
      }
    }
  }
  return message;
}

/** Добавляет метки кэша в тело запроса chat/completions для моделей Claude; остальное не трогает */
export function addPromptCacheMarkers(body: string): string {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body);
  } catch {
    return body;
  }
  if (!isClaudeModel(data?.model) || !Array.isArray(data.messages)) return body;
  const messages = [...(data.messages as Record<string, unknown>[])];

  let lastSystem = -1;
  messages.forEach((m, i) => {
    if (m?.role === "system") lastSystem = i;
  });
  if (lastSystem >= 0) messages[lastSystem] = withCacheControl(messages[lastSystem]);

  const penultimate = messages.length - 2;
  if (penultimate > lastSystem) messages[penultimate] = withCacheControl(messages[penultimate]);

  return JSON.stringify({ ...data, messages });
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

    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body =
      typeof init?.body === "string" && url.includes("/chat/completions")
        ? addPromptCacheMarkers(init.body)
        : init?.body;

    const res = await fetch(input, { ...init, headers, body });

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
