// Клиенты Supabase для battle+ai
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function requirePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseAnonKey;
  if (!url || !anonKey) {
    throw new Error("Supabase public configuration (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) is missing.");
  }
  return { url, anonKey };
}

let browserClientInstance: SupabaseClient | null = null;

/**
 * Возвращает singleton клиент для браузера (React компоненты, Realtime)
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  const { url, anonKey } = requirePublicEnv();
  if (typeof window === "undefined") {
    return createClient(url, anonKey);
  }
  if (!browserClientInstance) {
    browserClientInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return browserClientInstance;
}

/**
 * Создаёт серверный клиент для API Route с пробросом Authorization токена пользователя
 */
export function getSupabaseServerClient(authHeader?: string | null): SupabaseClient {
  const { url, anonKey } = requirePublicEnv();
  return createClient(url, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Возвращает сервисный админ-клиент для серверных операций (Service Role)
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Извлекает авторизованного пользователя из запроса
 */
export async function getAuthUserFromRequest(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return { user: null, error: "Отсутствует заголовок авторизации" };
  }
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
  const supabase = getSupabaseServerClient(authHeader);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: error?.message || "Недействительный токен сессии" };
  }

  return { user, error: null };
}
