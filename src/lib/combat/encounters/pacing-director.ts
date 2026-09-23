import type { CombatState } from "../engine";

export type PacingThreatLevel = "safe" | "balanced" | "intense" | "tpk_risk";
export type DMAssistAction =
  | "none"
  | "reinforcements"
  | "environmental_hazard"
  | "narrative_mercy"
  | "morale_break";

export interface PacingEvaluation {
  threatLevel: PacingThreatLevel;
  partyHpPercent: number; // 0 to 100
  aliveHeroesCount: number;
  unconsciousHeroesCount: number;
  enemyCount: number;
  suggestedAction: DMAssistAction;
  narrativePrompt: string; // Russian flavor text for the DM / AI DM
}

/**
 * Оценивает темп и уровень угрозы текущего боя на основе состояния отряда и врагов.
 * Предоставляет Мастеру Подземелий (или AI DM) рекомендации по динамическому масштабированию.
 */
export function evaluateCombatPacing(state: CombatState): PacingEvaluation {
  // 1. Идентификация героев и врагов
  let heroes = state.combatants.filter(
    (c) => c.type === "player" || c.type === "companion"
  );
  if (heroes.length === 0) {
    heroes = state.combatants.filter((c) => c.type !== "enemy");
  }

  const allEnemies = state.combatants.filter((c) => c.type === "enemy");
  const aliveEnemies = allEnemies.filter((c) => c.hpCurrent > 0);
  const enemyCount = aliveEnemies.length;

  const totalHeroes = heroes.length;
  const aliveHeroesCount = heroes.filter((h) => h.hpCurrent > 0).length;
  const unconsciousHeroesCount = heroes.filter((h) => h.hpCurrent <= 0).length;

  const sumHpMax = heroes.reduce((sum, h) => sum + Math.max(0, h.hpMax), 0);
  const sumHpCurrent = heroes.reduce((sum, h) => sum + Math.max(0, h.hpCurrent), 0);
  const partyHpPercent =
    sumHpMax > 0
      ? Math.min(100, Math.max(0, Math.round((sumHpCurrent / sumHpMax) * 100)))
      : 0;

  // Анализ боссов и темпа потерь врага
  const enemyBosses = allEnemies.filter((c) => c.tacticalRole === "boss");
  const hasBoss = enemyBosses.length > 0;
  const isBossDead = hasBoss && enemyBosses.every((b) => b.hpCurrent <= 0);

  const deadEnemiesCount = allEnemies.filter((c) => c.hpCurrent <= 0).length;
  const sumEnemyMaxHp = allEnemies.reduce((s, e) => s + Math.max(0, e.hpMax), 0);
  const sumEnemyCurHp = allEnemies.reduce((s, e) => s + Math.max(0, e.hpCurrent), 0);
  const enemyHpPercent = sumEnemyMaxHp > 0 ? (sumEnemyCurHp / sumEnemyMaxHp) * 100 : 0;

  const enemiesLosingFast =
    allEnemies.length === 0 ||
    enemyCount === 0 ||
    isBossDead ||
    (allEnemies.length > 0 && deadEnemiesCount / allEnemies.length >= 0.5) ||
    (sumEnemyMaxHp > 0 && enemyHpPercent <= 40);

  let threatLevel: PacingThreatLevel = "balanced";
  let suggestedAction: DMAssistAction = "none";
  let narrativePrompt = "Бой протекает с переменным успехом. Обе стороны держат строй.";

  // Логика уровней угрозы:
  // 1. TPK Risk: если partyHpPercent <= 25 или >= 50% героев без сознания
  const isTpkRisk =
    totalHeroes > 0 &&
    (partyHpPercent <= 25 || unconsciousHeroesCount / totalHeroes >= 0.5);

  if (isTpkRisk) {
    threatLevel = "tpk_risk";
    suggestedAction = "narrative_mercy";
    narrativePrompt =
      "Отряд на грани гибели! Герои тяжело изранены или без сознания. Возможно сюжетное вмешательство, неожиданная помощь союзников или шанс на тактическое бегство.";
  }
  // 2. Intense: если partyHpPercent <= 50 или хотя бы 1 герой без сознания
  else if (
    totalHeroes > 0 &&
    (partyHpPercent <= 50 || unconsciousHeroesCount >= 1)
  ) {
    threatLevel = "intense";
    suggestedAction = "none";
    narrativePrompt =
      "Напряжённый бой! Отряд несёт ощутимый урон или потерял бойца без сознания. Враг оказывает ожесточённое сопротивление.";
  }
  // 3. Safe: если partyHpPercent > 80, все герои живы и враги быстро проигрывают
  else if (
    totalHeroes > 0 &&
    partyHpPercent > 80 &&
    aliveHeroesCount === totalHeroes &&
    enemiesLosingFast
  ) {
    threatLevel = "safe";
    if (state.round <= 2 && isBossDead) {
      suggestedAction = "reinforcements";
      narrativePrompt =
        "Лидер врагов повержен слишком быстро! Ситуация под полным контролем героев. Рекомендуется вызвать подкрепление противника для сохранения динамики схватки.";
    } else if (isBossDead) {
      suggestedAction = "morale_break";
      narrativePrompt =
        "Босс повержен, остатки противников деморализованы. Возможно бегство выживших врагов или капитуляция.";
    } else {
      suggestedAction = "none";
      narrativePrompt =
        "Герои уверенно доминируют на поле боя. Вражеский строй сломлен, угроза отряду минимальна.";
    }
  }
  // 4. Balanced: по умолчанию
  else {
    threatLevel = "balanced";
    suggestedAction = "none";
    narrativePrompt =
      "Сражение разворачивается сбалансированно. Герои и противники активно обмениваются ударами.";
  }

  return {
    threatLevel,
    partyHpPercent,
    aliveHeroesCount,
    unconsciousHeroesCount,
    enemyCount,
    suggestedAction,
    narrativePrompt,
  };
}

/**
 * Определяет, требуется ли включить сюжетную помощь/облегчение столкновения (Relief Trigger).
 * Срабатывает, если отряд находится под угрозой гибели (TPK risk) и бой длится не менее 2 раундов.
 */
export function shouldTriggerEncounterRelief(state: CombatState): boolean {
  const evalResult = evaluateCombatPacing(state);
  return evalResult.threatLevel === "tpk_risk" && state.round >= 2;
}
