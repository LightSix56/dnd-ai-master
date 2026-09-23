import { NextResponse } from "next/server";
import { getAuthUserFromRequest, getSupabaseAdminClient } from "@/lib/supabase/client";
import { filterUserCharactersForRoom } from "@/lib/room/validation";

export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: authError || "Необходима авторизация" }, { status: 401 });
    }

    const url = new URL(request.url);
    const startingLevelParam = url.searchParams.get("startingLevel");
    const startingLevel = startingLevelParam ? parseInt(startingLevelParam, 10) : 1;
    const validatedStartingLevel =
      Number.isFinite(startingLevel) && startingLevel >= 1 && startingLevel <= 20 ? startingLevel : 1;

    // Запрашиваем персонажей пользователя из базы данных Supabase
    const supabase = getSupabaseAdminClient();
    const { data: characters, error: dbError } = await supabase
      .from("characters")
      .select("id, name, data, portrait_url, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (dbError) {
      console.error("[API /api/room/user-characters] DB Error:", dbError);
      return NextResponse.json(
        { error: "Не удалось загрузить персонажей из базы данных" },
        { status: 500 }
      );
    }

    const evaluated = filterUserCharactersForRoom(characters || [], validatedStartingLevel);

    return NextResponse.json(
      {
        startingLevel: validatedStartingLevel,
        compliant: evaluated.compliant,
        nonCompliant: evaluated.nonCompliant,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[API /api/room/user-characters] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
