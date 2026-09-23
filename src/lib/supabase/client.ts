// Клиенты Supabase для battle+ai
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://npcayouvvwjaqxqgxqxc.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wY2F5b3V2dndqYXF4cWd4cXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDAyMDEsImV4cCI6MjA5NTMxNjIwMX0.t9KyKMwAEPlrhZn0z8lgQ9oSKjdWiFc14h1bdeiXmzw";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let browserClientInstance: SupabaseClient | null = null;

/**
 * Возвращает singleton клиент для браузера (React компоненты, Realtime)
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  if (!browserClientInstance) {
    browserClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
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
  return createClient(supabaseUrl, supabaseAnonKey, {
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseServiceKey || supabaseAnonKey;
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
