// Движок батчинга совместного хода отряда D&D 5e (Phase 4)

export interface PlayerTurnInput {
  userId: string;
  characterName: string;
  className?: string;
  level?: number;
  actionText: string;
  submittedAt: number;
}

export interface CharacterTurnStatus {
  name: string;
  hpCurrent?: number;
  hpMax?: number;
  hpTemp?: number;
  condition?: string;
  ac?: number;
}

export interface BundleTurnOptions {
  roundNumber?: number;
  gmWhisperDirective?: string;
  afkCharacters?: Array<{ name: string; className?: string }>;
  partyStatus?: Array<CharacterTurnStatus>;
}

export interface TurnReadinessResult {
  readyCount: number;
  totalCount: number;
  isAllReady: boolean;
  readyUserIds: string[];
  pendingUserIds: string[];
}

/**
 * Объединяет индивидуальные действия всех игроков отряда в один структурированный промпт для AI DM.
 * Это предотвращает перебивание игроков и снижает затраты токенов в 3-4 раза.
 */
export function bundleTurnInputs(
  inputs: Record<string, PlayerTurnInput>,
  options?: BundleTurnOptions
): string {
  const round = options?.roundNumber ?? 1;
  const lines: string[] = [
    `[Совместный ход отряда — Раунд ${round}]:`,
  ];

  const sortedInputs = Object.values(inputs).sort(
    (a, b) => a.submittedAt - b.submittedAt
  );

  for (const input of sortedInputs) {
    const classLevelStr = [
      input.className,
      input.level ? `${input.level} ур.` : undefined,
    ]
      .filter(Boolean)
      .join(" ");

    const prefix = classLevelStr
      ? `${input.characterName} (${classLevelStr})`
      : input.characterName;

    lines.push(`- ${prefix}: "${input.actionText.trim()}"`);
  }

  // Если есть персонажи, чьи игроки не успели сделать ход (AFK при принудительной отправке)
  if (options?.afkCharacters && options.afkCharacters.length > 0) {
    for (const afk of options.afkCharacters) {
      const cls = afk.className ? ` (${afk.className})` : "";
      lines.push(
        `- ${afk.name}${cls} [В ожидании/защитная стойка]: держит позицию и прикрывает тыл отряда.`
      );
    }
  }

  // Динамический срез состояния отряда (HP, временные статусы, AC) для изоляции от префикса кэша
  if (options?.partyStatus && options.partyStatus.length > 0) {
    const formatted = options.partyStatus.map((p) => {
      const parts: string[] = [];
      if (p.hpCurrent !== undefined && p.hpMax !== undefined) {
        parts.push(`HP ${p.hpCurrent}/${p.hpMax}${p.hpTemp ? `+${p.hpTemp}` : ""}`);
      } else if (p.hpCurrent !== undefined) {
        parts.push(`HP ${p.hpCurrent}`);
      }
      if (p.condition) parts.push(p.condition);
      if (p.ac !== undefined) parts.push(`AC ${p.ac}`);
      return parts.length > 0 ? `${p.name} (${parts.join(", ")})` : p.name;
    });
    lines.push(`[Состояние участников]: ${formatted.join(", ")}`);
  }

  // Скрытая директива Человека-ДМа
  if (options?.gmWhisperDirective && options.gmWhisperDirective.trim()) {
    lines.push(
      "",
      `[Скрытая директива ведущего (Человек-ДМ, учитывай в повествовании, но не цитируй игрокам)]:`,
      options.gmWhisperDirective.trim()
    );
  }

  return lines.join("\n");
}

/**
 * Рассчитывает статус готовности совместного хода участников комнаты.
 */
export function calculateTurnReadiness(
  participants: Array<{ userId: string; characterSnapshot?: Record<string, unknown> | null }>,
  playerInputs: Record<string, PlayerTurnInput>
): TurnReadinessResult {
  const activeParticipants = participants.filter((p) => Boolean(p.characterSnapshot));
  const totalCount = activeParticipants.length;

  const readyUserIds: string[] = [];
  const pendingUserIds: string[] = [];

  for (const p of activeParticipants) {
    if (playerInputs[p.userId] && playerInputs[p.userId].actionText?.trim()) {
      readyUserIds.push(p.userId);
    } else {
      pendingUserIds.push(p.userId);
    }
  }

  const readyCount = readyUserIds.length;
  const isAllReady = totalCount > 0 && readyCount === totalCount;

  return {
    readyCount,
    totalCount,
    isAllReady,
    readyUserIds,
    pendingUserIds,
  };
}
