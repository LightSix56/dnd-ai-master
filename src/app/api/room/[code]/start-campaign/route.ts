import { NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { startRoomCampaign, type StartRoomCampaignInput } from "@/lib/room/room-service";

// Генерация сюжета под отряд идёт в этом же запросе
export const maxDuration = 300;

export async function POST(
  request: Request,
  props: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await props.params;
    if (!code) {
      return NextResponse.json({ error: "Код комнаты обязателен" }, { status: 400 });
    }

    const { user, error: authError } = await getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: authError || "Требуется авторизация" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Название кампании обязательно" }, { status: 400 });
    }

    if (!body.setting || typeof body.setting !== "string" || !body.setting.trim()) {
      return NextResponse.json({ error: "Сеттинг / жанр обязателен" }, { status: 400 });
    }

    // Остальные параметры нормализует сервис (startRoomCampaign), здесь только передаём их дальше
    const input: StartRoomCampaignInput = {
      title: body.title.trim(),
      setting: body.setting.trim(),
      tone: body.tone,
      difficulty: body.difficulty,
      startingSituation: body.startingSituation,
      levelTo: body.levelTo,
      customDmNotes: body.customDmNotes,
      dmStyle: body.dmStyle,
      partyTies: body.partyTies,
      ruleStrictness: body.ruleStrictness,
    };

    const result = await startRoomCampaign(code, user.id, input, {
      model: body.model,
      apiKey: body.apiKey,
      authMode: body.authMode,
      baseURL: body.baseURL,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[start-campaign route error]:", err);
    return NextResponse.json(
      { error: err?.message || "Не удалось запустить кампанию" },
      { status: 500 }
    );
  }
}
