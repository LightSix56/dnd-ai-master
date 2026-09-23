import { NextResponse } from "next/server";
import { getAuthUserFromRequest, getSupabaseAdminClient } from "@/lib/supabase/client";

export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: authError || "Необходима авторизация" }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: rawCharacters, error: dbError } = await supabase
      .from("characters")
      .select("id, name, data, portrait_url, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (dbError) {
      console.error("[API /api/account/characters] DB Error:", dbError);
      return NextResponse.json(
        { error: "Не удалось загрузить персонажей из базы данных" },
        { status: 500 }
      );
    }

    const characters = (rawCharacters || []).map((c: any) => {
      const parsedData = typeof c.data === "string" ? JSON.parse(c.data) : c.data || {};
      const race = parsedData.race || "Не указана";
      const className = parsedData.className || parsedData.class || "Авантюрист";
      const level = Number(parsedData.level) || 1;
      const ac = Number(parsedData.armorClass || parsedData.ac) || 10;
      const hpMax = Number(parsedData.hpMax || parsedData.hp?.max) || 10;
      const hpCurrent = Number(parsedData.hpCurrent ?? parsedData.hp?.current ?? hpMax);

      return {
        id: c.id,
        name: c.name || parsedData.name || "Безымянный герой",
        race,
        className,
        level,
        ac,
        hp: `${hpCurrent}/${hpMax}`,
        hpMax,
        hpCurrent,
        portrait_url: c.portrait_url,
        rawSheet: parsedData,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      };
    });

    return NextResponse.json({ characters }, { status: 200 });
  } catch (err) {
    console.error("[API /api/account/characters] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
