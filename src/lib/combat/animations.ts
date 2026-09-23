// Типы и утилиты для боевых анимаций
import type { Attack, Cell } from "./types";

export type WeaponAnimType =
  | "sword_main"
  | "sword_off"
  | "sword_dual"
  | "dagger_main"
  | "dagger_off"
  | "dagger_dual"
  | "axe_shield"
  | "staff"
  | "bow"
  | "spell_projectile";

export type CombatOutcomeType = "hit" | "crit" | "dodge" | "block";

export interface CombatEffect {
  id: string;
  type: WeaponAnimType;
  attackerId: string;
  targetId: string;
  fromPx: { x: number; y: number };
  toPx: { x: number; y: number };
  angleDeg: number;
  distancePx: number;
  outcome: CombatOutcomeType;
  damage?: number;
  damageText?: string;
  isCrit?: boolean;
  durationMs: number;
  createdAt: number;
}

export interface DamagePopup {
  id: string;
  targetId: string;
  x: number;
  y: number;
  text: string;
  outcome: CombatOutcomeType;
  isCrit: boolean;
  createdAt: number;
}

/**
 * Автоматически определяет тип анимации на основе названия атаки, свойств и стоимости действия
 */
export function detectWeaponAnimType(
  attack?: Partial<Attack> | null,
  opts: {
    isSpell?: boolean;
    spellName?: string;
    isOffHand?: boolean;
    isDual?: boolean;
  } = {}
): WeaponAnimType {
  const name = (opts.spellName ?? attack?.name ?? "").toLowerCase();
  const kind = attack?.kind;
  const isOffHand = opts.isOffHand || attack?.actionCost === "bonus" || name.includes("вторая рука") || name.includes("второй рук") || name.includes("вторым") || name.includes("offhand");
  const isDual = opts.isDual || attack?.actionCost === "action+bonus" || name.includes("парн") || name.includes("двойн") || name.includes("dual") || name.includes("залп");

  // 1. Прямой флаг или тип заклинания
  if (opts.isSpell || kind === "spell") {
    return "spell_projectile";
  }

  // 2. Посохи, булавы, молоты (включая «Боевой посох (с Дубинкой)»)
  if (
    name.includes("посох") ||
    name.includes("палиц") ||
    name.includes("молот") ||
    name.includes("булава") ||
    name.includes("staff") ||
    name.includes("mace") ||
    name.includes("hammer")
  ) {
    return "staff";
  }

  // 3. Лук, арбалет, дротики / Дальний бой
  if (
    name.includes("лук") ||
    name.includes("арбалет") ||
    name.includes("bow") ||
    name.includes("crossbow") ||
    name.includes("выстрел") ||
    name.includes("дротик") ||
    kind === "ranged"
  ) {
    return "bow";
  }

  // 4. Кинжалы и ножи (обычное оружие ближнего боя)
  if ((name.includes("кинжал") || name.includes("dagger") || name.includes("нож") || name.includes("стилет")) && !name.includes("ледян")) {
    if (isDual) return "dagger_dual";
    if (isOffHand) return "dagger_off";
    return "dagger_main";
  }

  // 5. Топоры и щиты
  if (name.includes("топор") || name.includes("секира") || name.includes("axe") || name.includes("щит") || name.includes("shield")) {
    return "axe_shield";
  }

  // 6. Мечи и клинки
  if (name.includes("меч") || name.includes("рапир") || name.includes("скимитар") || name.includes("blade") || name.includes("sword")) {
    if (isDual) return "sword_dual";
    if (isOffHand) return "sword_off";
    return "sword_main";
  }

  // 7. Специфические заклинания и заговоры
  if (
    name.includes("ледян") ||
    name.includes("тернов") ||
    name.includes("кнут") ||
    name.includes("снаряд") ||
    name.includes("луч") ||
    name.includes("стрела хаоса") ||
    name.includes("магическ") ||
    name.includes("огненн") ||
    name.includes("плам") ||
    name.includes("молни") ||
    name.includes("электро") ||
    name.includes("священн") ||
    name.includes("мистическ") ||
    name.includes("кара") ||
    name.includes("волна гром") ||
    name.includes("порыв ветр") ||
    name.includes("опутыван") ||
    name.includes("исцелен") ||
    name.includes("лечен") ||
    name.includes("лечащ") ||
    name.includes("слово") ||
    name.includes("благослов") ||
    name.includes("указани") ||
    name.includes("кислот") ||
    name.includes("ядовит") ||
    name.includes("некрот") ||
    name.includes("свет") ||
    name.includes("звездн") ||
    name.includes("звёздн") ||
    name.includes("ореол спор") ||
    name.includes("дыхание дракона") ||
    name === "дубинка" ||
    name === "shillelagh"
  ) {
    return "spell_projectile";
  }

  // 8. По умолчанию для ближнего боя
  if (isDual) return "sword_dual";
  if (isOffHand) return "sword_off";
  return "sword_main";
}

/**
 * Рассчитывает вектор направления, угол (в градусах) и дистанцию в пикселях между клетками
 */
export function calculateAttackVector(
  fromCell: Cell,
  toCell: Cell,
  cellSize: number
): {
  fromPx: { x: number; y: number };
  toPx: { x: number; y: number };
  angleDeg: number;
  distancePx: number;
  dx: number;
  dy: number;
} {
  const fromPx = {
    x: fromCell.x * cellSize + cellSize / 2,
    y: fromCell.y * cellSize + cellSize / 2,
  };
  const toPx = {
    x: toCell.x * cellSize + cellSize / 2,
    y: toCell.y * cellSize + cellSize / 2,
  };

  const dx = toPx.x - fromPx.x;
  const dy = toPx.y - fromPx.y;
  const distancePx = Math.sqrt(dx * dx + dy * dy) || 1;
  const rad = Math.atan2(dy, dx);
  const angleDeg = (rad * 180) / Math.PI;

  return {
    fromPx,
    toPx,
    angleDeg,
    distancePx,
    dx,
    dy,
  };
}

/**
 * Рассчитывает смещение токена при отдаче (в момент попадания отталкивает по направлению удара)
 */
export function getRecoilOffset(
  angleDeg: number,
  intensity = 18
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.cos(rad) * intensity,
    y: Math.sin(rad) * intensity,
  };
}

/**
 * Рассчитывает смещение токена при уклонении (отскок перпендикулярно линии атаки и назад)
 */
export function getDodgeOffset(
  angleDeg: number,
  sidestep = 16,
  backstep = 8
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  // Перпендикуляр (-sin, cos) + откат назад (cos, sin)
  return {
    x: -Math.sin(rad) * sidestep + Math.cos(rad) * backstep,
    y: Math.cos(rad) * sidestep + Math.sin(rad) * backstep,
  };
}
