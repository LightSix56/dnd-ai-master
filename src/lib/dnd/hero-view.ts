// Герои кампании с их живыми листами. Сама логика наложения — в hero-overlay.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { withSheets } from "./hero-overlay";

export { overlaySheet, withSheets, type HeroView } from "./hero-overlay";

/** Персонажи кампании с наложенными листами */
export async function loadCampaignHeroes(
  campaignId: string,
  where: Record<string, unknown> = {},
  client?: SupabaseClient
) {
  const rows = await db.character.findMany({
    where: { campaignId, ...where },
    orderBy: { name: "asc" },
  });
  return withSheets(rows, client);
}
