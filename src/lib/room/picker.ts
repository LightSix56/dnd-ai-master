import type { SheetRow } from "@/lib/dnd/sheet-store";

/**
 * Какие листы показать игроку при выборе героя для комнаты.
 * Оригиналы — всегда. Версии кампаний — только версии кампании ЭТОЙ комнаты;
 * оригинал, у которого такая версия уже есть, скрывается (играть будут версией).
 */
export function sheetsForRoomPicker(rows: SheetRow[], campaignId: string | null): SheetRow[] {
  const versions = rows.filter((r) => r.campaignId && r.campaignId === campaignId);
  const replaced = new Set(versions.map((v) => v.sourceCharacterId).filter(Boolean));
  const originals = rows.filter((r) => !r.campaignId && !replaced.has(r.id));
  return [...versions, ...originals];
}
