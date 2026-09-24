import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { randomBytes } from "crypto";

export async function POST(request?: Request) {
  try {
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
