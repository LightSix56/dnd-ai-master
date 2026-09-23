// DuckDuckGo поиск для AI DM — поиск правил D&D 5e в интернете

const DDG_HTML_URL = "https://html.duckduckgo.com/html/";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Поиск через DuckDuckGo HTML-версию (без API key)
 * Возвращает топ результатов с заголовком, ссылкой и сниппетом
 */
export async function searchDuckDuckGo(
  query: string,
  maxResults: number = 5
): Promise<SearchResult[]> {
  const url = `${DDG_HTML_URL}?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
      // 10 секунд максимум
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      throw new Error(`DDG returned ${res.status}`);
    }
    const html = await res.text();
    return parseDDGResults(html).slice(0, maxResults);
  } catch (error) {
    console.error("[DDG] Search error:", error);
    return [];
  }
}

/**
 * Парсит HTML-ответ DuckDuckGo и достаёт результаты
 */
function parseDDGResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // DuckDuckGo HTML: <a class="result__a" href="...">title</a>
  // + <a class="result__snippet" href="...">snippet</a>
  const linkRegex =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRegex =
    /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

  const links: { url: string; title: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawUrl = match[1];
    const title = stripTags(match[2]).trim();
    // DDG заворачивает ссылки в /l/?uddg=...
    const url = decodeDDGUrl(rawUrl);
    if (url && title) {
      links.push({ url, title });
    }
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripTags(match[1]).trim());
  }

  for (let i = 0; i < links.length; i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || "",
    });
  }

  return results;
}

function decodeDDGUrl(raw: string): string {
  // Формат: //duckduckgo.com/l/?uddg=https%3A%2F%2F...
  try {
    const match = raw.match(/uddg=([^&]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    if (raw.startsWith("//")) {
      return "https:" + raw;
    }
    if (raw.startsWith("http")) {
      return raw;
    }
    return "";
  } catch {
    return "";
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Быстрое извлечение текста со страницы по URL — для уточнения правил
 * Берёт первые ~3000 символов, вырезает HTML-теги
 */
export async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    // Удаляем скрипты и стили
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.slice(0, 3000);
  } catch {
    return "";
  }
}
