// «Партия прокачалась».
//
// Досье героев мастер получает из их листов на каждом ходу, так что новые умения он видит сам.
// Эта кнопка нужна, чтобы явно сказать ему, что герои выросли в уровне: в историю кампании
// добавляется короткое сообщение, а запомненные уровни обновляются.

import { db } from "@/lib/db";

export const PARTY_LEVELED_TEXT = "Партия прокачала уровень, посмотри их листы заново.";

export interface LevelChange {
  characterId: string;
  name: string;
  className: string;
  fromLevel: number;
  toLevel: number;
}

/** Отказ с текстом для игрока (маршрут отдаёт его как 409) */
export class PartyLeveledError extends Error {}

type HeroLike = {
  id: string;
  name: string;
  type?: string | null;
  class?: string | null;
  level?: number | null;
  sheetCharacterId?: string | null;
  sheetLevelSeen?: number | null;
  sheet?: Record<string, any> | null;
  sheetMissing?: boolean;
};

/** Есть ли у героя прочитанный лист (уровень в строке — из листа, см. @/lib/db) */
function hasLiveSheet(hero: HeroLike): boolean {
  return hero.type === "player" && Boolean(hero.sheetCharacterId) && Boolean(hero.sheet) && !hero.sheetMissing;
}

/** Герои, чей уровень в листе выше того, о котором мастеру уже сообщали */
export function findLevelChanges(heroes: HeroLike[]): LevelChange[] {
  const changes: LevelChange[] = [];
  for (const hero of heroes) {
    if (!hasLiveSheet(hero)) continue;
    const toLevel = Math.trunc(Number(hero.level)) || 1;
    const seen = hero.sheetLevelSeen;
    if (typeof seen !== "number" || toLevel <= seen) continue;
    changes.push({
      characterId: hero.id,
      name: hero.name,
      className: hero.class || "",
      fromLevel: seen,
      toLevel,
    });
  }
  return changes;
}

export function buildPartyLeveledNote(changes: LevelChange[]): string {
  const lines = changes.map(
    (c) => `${c.name} — ${c.toLevel} ур.${c.className ? ` (${c.className})` : ""}, был ${c.fromLevel}`
  );
  return [PARTY_LEVELED_TEXT, ...lines].join("\n");
}

export async function isCombatActive(campaignId: string): Promise<boolean> {
  const combat = await db.combat.findFirst({ where: { campaignId, status: "active" } });
  return Boolean(combat);
}

export async function loadLevelChanges(campaignId: string): Promise<LevelChange[]> {
  const heroes = await db.character.findMany({ where: { campaignId, type: "player" } });
  return findLevelChanges(heroes as HeroLike[]);
}

/**
 * Сообщает мастеру о новых уровнях: пишет сообщение в историю кампании и запоминает уровни.
 * Во время боя и без изменений — отказ.
 */
export async function acknowledgePartyLevels(
  campaignId: string
): Promise<{ changes: LevelChange[]; note: string }> {
  if (await isCombatActive(campaignId)) {
    throw new PartyLeveledError("Сначала завершите бой.");
  }

  const heroes = (await db.character.findMany({ where: { campaignId, type: "player" } })) as HeroLike[];
  const changes = findLevelChanges(heroes);

  // Героя видим впервые — просто запоминаем его уровень, сообщать не о чем
  for (const hero of heroes) {
    if (hasLiveSheet(hero) && typeof hero.sheetLevelSeen !== "number") {
      await db.character.update({
        where: { id: hero.id },
        data: { sheetLevelSeen: Math.trunc(Number(hero.level)) || 1 },
      });
    }
  }

  if (changes.length === 0) {
    throw new PartyLeveledError("Никто из партии ещё не повысил уровень.");
  }

  const note = buildPartyLeveledNote(changes);
  // Роль "user": такие сообщения мастер читает в истории (служебную роль история пропускает)
  await db.chatMessage.create({
    data: { campaignId, role: "user", content: `[Система] ${note}` },
  });
  for (const change of changes) {
    await db.character.update({ where: { id: change.characterId }, data: { sheetLevelSeen: change.toLevel } });
  }
  return { changes, note };
}
