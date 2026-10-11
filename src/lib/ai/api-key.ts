// Ключ ИИ берётся только из настроек пользователя. Серверного запасного ключа (AI_API_KEY) нет:
// иначе игра идёт за счёт владельца сайта, даже если пользователь ничего не вводил.

export const MISSING_API_KEY_MESSAGE =
  "API ключ не указан. Откройте настройки и введите свой ключ.";

/** Ключ из запроса без пробелов; пусто, если пользователь его не вводил */
export function resolveApiKey(userApiKey?: string | null): string {
  return typeof userApiKey === "string" ? userApiKey.trim() : "";
}
