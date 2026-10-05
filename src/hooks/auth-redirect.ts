// Куда вернуть игрока после входа через Google.
//
// Цель запоминается перед уходом на страницу входа и используется один раз — сразу после
// возвращения. Раньше запись, совпавшую с текущей страницей, не удаляли, и при следующем
// открытии кампании сайт внезапно уводил на главную.

export const REDIRECT_KEY = "auth_redirect_next";
/** Сколько ждать возвращения со страницы входа */
const MAX_AGE_MS = 5 * 60_000;

function isSafePath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

export function rememberRedirectTarget(storage: Storage, path: string, now = Date.now()): void {
  storage.setItem(REDIRECT_KEY, JSON.stringify({ path, at: now }));
}

/** Путь, куда перейти после входа, или null. Запись удаляется в любом случае */
export function consumeRedirectTarget(storage: Storage, currentPath: string, now = Date.now()): string | null {
  const raw = storage.getItem(REDIRECT_KEY);
  if (raw === null) return null;
  storage.removeItem(REDIRECT_KEY);
  let entry: { path?: unknown; at?: unknown };
  try {
    entry = JSON.parse(raw);
  } catch {
    return null; // запись старого формата — устаревшая
  }
  if (!isSafePath(entry?.path) || typeof entry.at !== "number" || now - entry.at > MAX_AGE_MS) return null;
  return entry.path === currentPath ? null : entry.path;
}
