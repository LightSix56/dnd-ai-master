// Утилита для бросков кубиков D&D 5e

export interface DiceRoll {
  notation: string; // "3d6+2"
  rolls: number[];  // [3, 5, 2]
  modifier: number; // +2
  total: number;
  critical?: "success" | "failure"; // для d20
}

/**
 * Парсит нотацию броска: "2d6+3", "d20", "1d8-1", "3d6", "1", "11d8+1d6"
 */
export function parseDiceNotation(notation: string): {
  count: number;
  sides: number;
  modifier: number;
} {
  const cleaned = notation.toLowerCase().replace(/\s/g, "").replace(/к/g, "d");

  // Flat number like "1", "5", "+2", "-1"
  const flatMatch = cleaned.match(/^([+-]?\d+)$/);
  if (flatMatch) {
    return { count: 0, sides: 0, modifier: parseInt(flatMatch[1], 10) };
  }

  // Standard dice notation: "2d6", "d20", "1d8+3", "2d6-1"
  const match = cleaned.match(/^(\d*)d(\d+)(?:([+-])(\d+))?$/);
  if (match) {
    const count = match[1] ? parseInt(match[1], 10) : 1;
    const sides = parseInt(match[2], 10);
    const modifierSign = match[3] === "-" ? -1 : 1;
    const modifier = match[4] ? modifierSign * parseInt(match[4], 10) : 0;
    return { count, sides, modifier };
  }

  // Compound dice like "11d8+1d6" or "2d6+1d4+2"
  const parts = cleaned.match(/([+-]?[^+-]+)/g);
  if (parts && parts.length > 1) {
    let totalCount = 0;
    let mainSides = 0;
    let totalMod = 0;
    for (const part of parts) {
      const p = part.startsWith("+") ? part.slice(1) : part;
      const isNeg = p.startsWith("-");
      const cleanP = isNeg ? p.slice(1) : p;
      if (cleanP.includes("d")) {
        const dMatch = cleanP.match(/^(\d*)d(\d+)$/);
        if (dMatch) {
          const c = (dMatch[1] ? parseInt(dMatch[1], 10) : 1) * (isNeg ? -1 : 1);
          totalCount += c;
          mainSides = parseInt(dMatch[2], 10);
        }
      } else if (/^\d+$/.test(cleanP)) {
        totalMod += parseInt(cleanP, 10) * (isNeg ? -1 : 1);
      }
    }
    return { count: totalCount, sides: mainSides, modifier: totalMod };
  }

  throw new Error(`Invalid dice notation: ${notation}`);
}

/**
 * Бросок кубиков
 */
export function rollDice(notation: string): DiceRoll {
  const cleaned = notation.toLowerCase().replace(/\s/g, "").replace(/к/g, "d");

  // Flat number like "1"
  const flatMatch = cleaned.match(/^([+-]?\d+)$/);
  if (flatMatch) {
    const val = parseInt(flatMatch[1], 10);
    return { notation, rolls: [], modifier: val, total: val };
  }

  // Check if compound notation: e.g. "11d8+1d6" or "2d6+1d4+3"
  const parts = cleaned.match(/([+-]?[^+-]+)/g);
  if (parts && parts.length > 1 && parts.some((p) => p.includes("d"))) {
    const rolls: number[] = [];
    let modifier = 0;
    for (const part of parts) {
      const p = part.startsWith("+") ? part.slice(1) : part;
      const isNeg = p.startsWith("-");
      const cleanP = isNeg ? p.slice(1) : p;
      if (cleanP.includes("d")) {
        const dMatch = cleanP.match(/^(\d*)d(\d+)$/);
        if (dMatch) {
          const count = dMatch[1] ? parseInt(dMatch[1], 10) : 1;
          const sides = parseInt(dMatch[2], 10);
          for (let i = 0; i < count; i++) {
            const r = 1 + Math.floor(Math.random() * sides);
            rolls.push(isNeg ? -r : r);
          }
        }
      } else if (/^\d+$/.test(cleanP)) {
        modifier += parseInt(cleanP, 10) * (isNeg ? -1 : 1);
      }
    }
    const sum = rolls.reduce((a, b) => a + b, 0);
    const total = sum + modifier;
    return { notation, rolls, modifier, total };
  }

  // Standard dice notation
  const { count, sides, modifier } = parseDiceNotation(notation);
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(1 + Math.floor(Math.random() * sides));
  }
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;

  let critical: "success" | "failure" | undefined;
  if (sides === 20 && count === 1) {
    if (rolls[0] === 20) critical = "success";
    else if (rolls[0] === 1) critical = "failure";
  }

  return { notation, rolls, modifier, total, critical };
}

/**
 * Модификатор характеристики по правилам 5e
 */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Бонус мастерства по уровню
 */
export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

export interface D20Roll {
  d20: number;
  natural: number;
  modifier: number;
  total: number;
  isCrit: boolean;
  isFumble: boolean;
  mode: "normal" | "advantage" | "disadvantage";
  advantage?: "normal" | "advantage" | "disadvantage";
  otherD20?: number;
  rolls: number[];
}

/**
 * Бросок d20 с преимуществом / помехой и модификатором
 */
export function rollD20(
  modifier: number = 0,
  advOrAdvantage?: boolean | "normal" | "advantage" | "disadvantage",
  disadvantage?: boolean
): D20Roll {
  let mode: "normal" | "advantage" | "disadvantage" = "normal";
  if (typeof advOrAdvantage === "string") {
    mode = advOrAdvantage;
  } else {
    const hasAdv = Boolean(advOrAdvantage);
    const hasDis = Boolean(disadvantage);
    if (hasAdv && !hasDis) mode = "advantage";
    else if (hasDis && !hasAdv) mode = "disadvantage";
    else mode = "normal";
  }

  const roll1 = 1 + Math.floor(Math.random() * 20);
  if (mode === "normal") {
    return {
      d20: roll1,
      natural: roll1,
      modifier,
      total: roll1 + modifier,
      isCrit: roll1 === 20,
      isFumble: roll1 === 1,
      mode: "normal",
      advantage: "normal",
      rolls: [roll1],
    };
  }

  const roll2 = 1 + Math.floor(Math.random() * 20);
  const chosen = mode === "advantage" ? Math.max(roll1, roll2) : Math.min(roll1, roll2);
  const other = chosen === roll1 ? roll2 : roll1;

  return {
    d20: chosen,
    natural: chosen,
    modifier,
    total: chosen + modifier,
    isCrit: chosen === 20,
    isFumble: chosen === 1,
    mode,
    advantage: mode,
    otherD20: other,
    rolls: [roll1, roll2],
  };
}

/**
 * Форматирует бросок d20 для отображения в логе
 */
export function formatD20Roll(r: D20Roll): string {
  const modSign = r.modifier >= 0 ? `+${r.modifier}` : `${r.modifier}`;
  const advText =
    r.mode === "advantage"
      ? ` [преим. ${r.d20} vs ${r.otherD20}]`
      : r.mode === "disadvantage"
      ? ` [помеха ${r.d20} vs ${r.otherD20}]`
      : "";
  const critText = r.isCrit ? " (КРИТ!)" : r.isFumble ? " (ПРОВАЛ!)" : "";
  return `🎲 d20(${r.d20}${critText})${modSign}${advText} = ${r.total}`;
}
