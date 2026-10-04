import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { randomBytes } from "crypto";

// Каждый вызов создаёт пользователя в Supabase, поэтому частоту ограничиваем.
// Счётчик живёт в памяти экземпляра функции: это защита от случайного зацикливания клиента
// и простого спама, а не полноценный rate limit (экземпляров может быть несколько).
const GUEST_WINDOW_MS = 60_000;
const GUEST_MAX_PER_WINDOW = 5;
const guestHits = new Map<string, number[]>();

function guestRateLimited(request?: Request): boolean {
  const ip =
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request?.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const recent = (guestHits.get(ip) ?? []).filter((t) => now - t < GUEST_WINDOW_MS);
  if (recent.length >= GUEST_MAX_PER_WINDOW) {
    guestHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  guestHits.set(ip, recent);
  if (guestHits.size > 5000) guestHits.clear();
  return false;
}

export async function POST(request?: Request) {
  try {
    if (guestRateLimited(request)) {
      return NextResponse.json(
        { error: "Слишком много гостевых входов подряд. Подождите минуту и попробуйте снова." },
        { status: 429 }
      );
    }

    let customName = "";
    if (request) {
      try {
        const body = await request.json().catch(() => ({}));
        customName = typeof body?.name === "string" ? body.name.trim() : "";
      } catch {
        // тело запроса не обязательно
      }
    }

    const uniqueId = `${Date.now()}_${randomBytes(4).toString("hex")}`;
    const guestEmail = `guest_${uniqueId}@guest.dnd-master.local`;
    const displayName = customName || `Гость_${uniqueId.slice(-4)}`;

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: guestEmail,
      options: {
        data: {
          is_guest: true,
          display_name: displayName,
          name: displayName,
        },
      },
    });

    if (error || !data?.properties?.hashed_token) {
      console.error("[API /api/auth/guest-login] Supabase error:", error);
      return NextResponse.json(
        { error: error?.message || "Не удалось сгенерировать токен гостевого входа" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token_hash: data.properties.hashed_token,
      email: guestEmail,
      displayName,
      isGuest: true,
    });
  } catch (err) {
    console.error("[API /api/auth/guest-login] Unexpected error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
