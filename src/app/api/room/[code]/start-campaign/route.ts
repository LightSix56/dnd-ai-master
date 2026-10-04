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

    const validDifficulties = ["easy", "normal", "hard", "brutal"];
    // «Смертоносная» в окне настройки приходит как deadly — это тот же уровень, что brutal
    const requestedDifficulty = body.difficulty === "deadly" ? "brutal" : body.difficulty;
    const difficulty = validDifficulties.includes(requestedDifficulty) ? requestedDifficulty : "normal";

    const validSituations = ["strangers", "established_party", "captives_or_survivors", "patron_contract"];
    const startingSituation = validSituations.includes(body.startingSituation)
      ? body.startingSituation
      : "strangers";

    const input: StartRoomCampaignInput = {
      title: body.title.trim(),
      setting: body.setting.trim(),
      tone: body.tone?.trim() || "Сбалансированный",
      difficulty,
      startingSituation,
      levelTo: typeof body.levelTo === "number" ? body.levelTo : undefined,
      customDmNotes: body.customDmNotes?.trim() || null,
      dmStyle: body.dmStyle?.trim() || undefined,
      ruleStrictness: body.ruleStrictness?.trim() || undefined,
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
