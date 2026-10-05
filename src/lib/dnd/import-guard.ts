// Что делать при импорте персонажа, если в кампании уже есть герой с таким именем.
//
// Героя, у которого есть лист в базе листов, импорт не трогает: его лист принадлежит игроку
// и меняется только на сайте листа. Иначе любой участник кампании мог бы, импортировав
// персонажа с тем же именем, переписать чужого героя.

export type ImportTarget = "create" | "update-unlinked" | "refuse-linked";

export function importTargetDecision(
  existing: { sheetCharacterId?: string | null } | null | undefined
): ImportTarget {
  if (!existing) return "create";
  return existing.sheetCharacterId ? "refuse-linked" : "update-unlinked";
}

export const IMPORT_LINKED_MESSAGE =
  "Герой с таким именем уже есть в кампании и привязан к листу игрока. Изменить его можно на сайте листа персонажа.";
