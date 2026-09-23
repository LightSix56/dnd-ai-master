import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/client";

export async function POST(request: Request) {
  try {
    let email = "";
    try {
      const body = await request.json();
      email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    } catch {
      return NextResponse.json({ error: "Некорректное тело запроса (JSON)" }, { status: 400 });
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Укажите корректный email адрес" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (error || !data?.properties?.hashed_token) {
      console.error("[API /api/auth/instant-login] Supabase error:", error);
      return NextResponse.json(
        { error: error?.message || "Не удалось сгенерировать токен авторизации" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token_hash: data.properties.hashed_token,
      email,
    });
  } catch (err) {
    console.error("[API /api/auth/instant-login] Unexpected error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
