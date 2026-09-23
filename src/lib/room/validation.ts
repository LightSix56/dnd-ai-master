// Движок валидации уровня персонажей для комнат D&D 5e (Phase 1)

export interface CharacterCandidate {
  id?: string;
  name?: string;
  level?: number;
  data?: {
    level?: number;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface LevelValidationResult {
  valid: boolean;
  error?: string;
}

export interface EvaluatedCharacter {
  id?: string;
  name: string;
  level: number;
  data?: unknown;
  isCompliant: boolean;
  reason?: string;
  [key: string]: unknown;
}

export interface EvaluatedCharacterList<T = EvaluatedCharacter> {
  compliant: T[];
  nonCompliant: (T & { reason: string })[];
}

/**
 * Извлекает валидный целочисленный уровень персонажа из плоской структуры или поля data
 */
export function extractCharacterLevel(character: CharacterCandidate): number | null {
  const direct = character.level;
  if (typeof direct === "number" && Number.isFinite(direct) && Number.isInteger(direct) && direct >= 1) {
    return direct;
  }

  const nested = character.data?.level;
  if (typeof nested === "number" && Number.isFinite(nested) && Number.isInteger(nested) && nested >= 1) {
    return nested;
  }

  return null;
}

/**
 * Валидирует соответствие уровня персонажа стартовому уровню кампании
 */
export function validateCharacterForRoom(
  character: CharacterCandidate,
  startingLevel: number
): LevelValidationResult {
  const charName = (character.name || "Персонаж").trim();
  const charLevel = extractCharacterLevel(character);

  if (!Number.isFinite(startingLevel) || !Number.isInteger(startingLevel) || startingLevel < 1) {
    return {
      valid: false,
      error: `Некорректный стартовый уровень кампании (${startingLevel}).`,
    };
  }

  if (charLevel === null) {
    return {
      valid: false,
      error: `Персонаж "${charName}" имеет некорректный или неопределённый уровень.`,
    };
  }

  if (charLevel !== startingLevel) {
    return {
      valid: false,
      error: `Персонаж "${charName}" имеет ${charLevel} уровень. Для этой кампании требуется ровно ${startingLevel} уровень.`,
    };
  }

  return { valid: true };
}

/**
 * Фильтрует список персонажей игрока на подходящих и неподходящих под стартовый уровень кампании
 */
export function filterUserCharactersForRoom<T extends CharacterCandidate>(
  characters: T[],
  startingLevel: number
): EvaluatedCharacterList<T> {
  const compliant: T[] = [];
  const nonCompliant: (T & { reason: string })[] = [];

  for (const char of characters) {
    const res = validateCharacterForRoom(char, startingLevel);
    if (res.valid) {
      compliant.push(char);
    } else {
      nonCompliant.push({
        ...char,
        reason: res.error || `Уровень не соответствует требованию (${startingLevel} ур.)`,
      });
    }
  }

  return {
    compliant,
    nonCompliant,
  };
}
