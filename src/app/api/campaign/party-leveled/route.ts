// «Игрок и его персонаж прокачались» — то же, что «Партия прокачалась» в комнате, для соло-игры.
// Кампания задаётся параметром ?campaignId=; доступ — владелец кампании (и участники её комнаты).
import { NextResponse } from "next/server";
import { denyCampaignAccess } from "@/lib/auth/campaign-access";
import { db } from "@/lib/db";
import {
  PartyLeveledError,
  acknowledgePartyLevels,
  isCombatActive,
  loadLevelChanges,
} from "@/lib/room/party-leveled";
import { SheetUnavailableError } from "@/lib/dnd/sheet-store";

async function resolveCampaign(request: Request) {
  const campaignId = new URL(request.url).searchParams.get("campaignId")?.trim();
  if (!campaignId) {
    return { fail: NextResponse.json({ error: "campaignId is required" }, { status: 400 }) };
  }
  const denied = await denyCampaignAccess(request, campaignId);
  if (denied) return { fail: denied };
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!campaign) return { fail: NextResponse.json({ error: "Кампания не найдена" }, { status: 404 }) };
  return { campaignId };
}

function failure(err: unknown, label: string) {
  if (err instanceof PartyLeveledError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof SheetUnavailableError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error(`[API campaign/party-leveled ${label}]`, err);
  return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
}

/** Кто из героев вырос в уровне с момента, когда мастеру сообщали в последний раз */
export async function GET(request: Request) {
  try {
    const resolved = await resolveCampaign(request);
    if (resolved.fail) return resolved.fail;
    const [changes, combatActive] = await Promise.all([
      loadLevelChanges(resolved.campaignId),
      isCombatActive(resolved.campaignId),
    ]);
    return NextResponse.json({ changes, combatActive });
  } catch (err) {
    return failure(err, "GET");
  }
}

/** Сообщение мастеру в историю кампании */
export async function POST(request: Request) {
  try {
    const resolved = await resolveCampaign(request);
    if (resolved.fail) return resolved.fail;
    const result = await acknowledgePartyLevels(resolved.campaignId, "solo");
    return NextResponse.json(result);
  } catch (err) {
    return failure(err, "POST");
  }
}
