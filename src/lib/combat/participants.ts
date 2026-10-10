// Кто из героев и спутников выходит на карту боя.
//
// Мастер сам решает, кто втянут в схватку: остальные по сюжету далеко, и «телепортировать»
// их на карту нельзя. Без указания участников в бой идут все (как раньше).

export interface PartyPick {
  id: string;
  name: string;
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

/**
 * Выбирает участников боя из отряда по id и/или именам, которые назвал мастер.
 * Имя сравнивается без регистра; допускается неполное («Добрун» и «Добрун Каменный»).
 * Если ничего не указано или ни одно имя не опознано, в бой идёт весь отряд —
 * лучше лишний герой на карте, чем бой без героев. `unmatched` — имена, которые не нашлись.
 */
export function selectParticipants<T extends PartyPick>(
  party: T[],
  wanted: { names?: string[]; ids?: string[] }
): { fighters: T[]; benched: T[]; unmatched: string[]; filtered: boolean } {
  const names = (wanted.names ?? []).map((n) => String(n ?? "").trim()).filter(Boolean);
  const ids = new Set((wanted.ids ?? []).filter(Boolean));
  if (names.length === 0 && ids.size === 0) {
    return { fighters: party, benched: [], unmatched: [], filtered: false };
  }

  const picked = new Set<string>();
  for (const member of party) {
    if (ids.has(member.id)) picked.add(member.id);
  }
  const unmatched: string[] = [];
  for (const name of names) {
    const key = norm(name);
    const exact = party.filter((m) => norm(m.name) === key);
    const loose = exact.length
      ? exact
      : party.filter((m) => {
          const candidate = norm(m.name);
          return candidate.includes(key) || key.includes(candidate);
        });
    if (loose.length === 0) unmatched.push(name);
    for (const m of loose) picked.add(m.id);
  }

  if (picked.size === 0) {
    return { fighters: party, benched: [], unmatched, filtered: false };
  }
  return {
    fighters: party.filter((m) => picked.has(m.id)),
    benched: party.filter((m) => !picked.has(m.id)),
    unmatched,
    filtered: true,
  };
}
