"use client";

// Подставляет токен сессии во все запросы к собственному API.
//
// Сервер проверяет, чья кампания, по заголовку Authorization. Раньше токен добавлялся
// вручную лишь в части запросов (список кампаний, комнаты), а чат, бой, персонажи и память
// уходили без него — сервер не мог отличить владельца от постороннего.
// Патч ставится один раз при загрузке модуля, до первых запросов страницы.

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    __authFetchInstalled?: boolean;
  }
}

function isOwnApi(input: RequestInfo | URL): boolean {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

async function currentToken(): Promise<string | null> {
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function install() {
  if (typeof window === "undefined" || window.__authFetchInstalled) return;
  window.__authFetchInstalled = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isOwnApi(input)) return original(input, init);

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );
    if (!headers.has("Authorization")) {
      const token = await currentToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    return original(input, { ...init, headers });
  };
}

install();

export function AuthFetchBridge() {
  return null;
}
