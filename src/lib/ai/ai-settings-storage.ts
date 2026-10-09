// Чтение сохранённых в браузере настроек ИИ (ключ, base URL, модели по ролям).
// Ключи localStorage совпадают с теми, что пишет DnDApp и HomeHubView.

import { DEFAULT_CHEAP_MODEL, DEFAULT_DM_MODEL } from "./models";

export const STORY_MODEL_FALLBACK = "deepseek/deepseek-v4.1-flash";

export interface StoredAiSettings {
  apiKey: string;
  baseURL: string;
  authMode: "bearer" | "x-api-key" | "raw";
  model: string;
  cheapModel: string;
  storyModel: string;
}

// Поля запроса для генерации сюжета: модель — именно модель сюжета
export function storedAiRequestFields() {
  const s = readStoredAiSettings();
  return { model: s.storyModel, apiKey: s.apiKey, authMode: s.authMode, baseURL: s.baseURL };
}

export function readStoredAiSettings(): StoredAiSettings {
  const read = (key: string, fallback: string) => {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  };
  return {
    apiKey: read("ai_api_key", ""),
    baseURL: read("ai_base_url", "https://polza.ai/api/v1"),
    authMode: read("ai_auth_mode", "bearer") as StoredAiSettings["authMode"],
    model: read("ai_model", DEFAULT_DM_MODEL),
    cheapModel: read("ai_cheap_model", DEFAULT_CHEAP_MODEL),
    storyModel: read("ai_story_model", STORY_MODEL_FALLBACK),
  };
}
