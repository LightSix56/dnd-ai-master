import { describe, it, expect } from "vitest";
import {
  detectWeaponAnimType,
  calculateAttackVector,
  getRecoilOffset,
  getDodgeOffset,
} from "../animations";

describe("Combat Animations Math & Detection", () => {
  it("should calculate angle and distance correctly in all 8 directions", () => {
    const cellSize = 50;
    const center = { x: 5, y: 5 };

    // 1. Вправо (E) -> 0°
    const east = calculateAttackVector(center, { x: 6, y: 5 }, cellSize);
    expect(east.angleDeg).toBeCloseTo(0);
    expect(east.distancePx).toBeCloseTo(50);

    // 2. Вниз (S) -> +90°
    const south = calculateAttackVector(center, { x: 5, y: 6 }, cellSize);
    expect(south.angleDeg).toBeCloseTo(90);
    expect(south.distancePx).toBeCloseTo(50);

    // 3. Влево (W) -> 180°
    const west = calculateAttackVector(center, { x: 4, y: 5 }, cellSize);
    expect(Math.abs(west.angleDeg)).toBeCloseTo(180);
    expect(west.distancePx).toBeCloseTo(50);

    // 4. Вверх (N) -> -90°
    const north = calculateAttackVector(center, { x: 5, y: 4 }, cellSize);
    expect(north.angleDeg).toBeCloseTo(-90);
    expect(north.distancePx).toBeCloseTo(50);

    // 5. Диагональ вниз-вправо (SE) -> +45°
    const se = calculateAttackVector(center, { x: 6, y: 6 }, cellSize);
    expect(se.angleDeg).toBeCloseTo(45);
    expect(se.distancePx).toBeCloseTo(50 * Math.SQRT2);

    // 6. Диагональ вверх-вправо (NE) -> -45°
    const ne = calculateAttackVector(center, { x: 6, y: 4 }, cellSize);
    expect(ne.angleDeg).toBeCloseTo(-45);

    // 7. Диагональ вверх-влево (NW) -> -135°
    const nw = calculateAttackVector(center, { x: 4, y: 4 }, cellSize);
    expect(nw.angleDeg).toBeCloseTo(-135);

    // 8. Диагональ вниз-влево (SW) -> +135°
    const sw = calculateAttackVector(center, { x: 4, y: 6 }, cellSize);
    expect(sw.angleDeg).toBeCloseTo(135);
  });

  it("should detect weapon animation types properly", () => {
    // Луки
    expect(detectWeaponAnimType({ name: "Длинный лук", kind: "ranged" })).toBe("bow");
    expect(detectWeaponAnimType({ name: "Ручной арбалет", kind: "ranged" })).toBe("bow");

    // Кинжалы
    expect(detectWeaponAnimType({ name: "Кинжал", actionCost: "action" })).toBe("dagger_main");
    expect(detectWeaponAnimType({ name: "Кинжал", actionCost: "bonus" })).toBe("dagger_off");
    expect(detectWeaponAnimType({ name: "Парные кинжалы", actionCost: "action+bonus" })).toBe("dagger_dual");

    // Мечи
    expect(detectWeaponAnimType({ name: "Короткий меч", actionCost: "action" })).toBe("sword_main");
    expect(detectWeaponAnimType({ name: "Короткий меч (доп. рука)", actionCost: "bonus" })).toBe("sword_off");
    expect(detectWeaponAnimType({ name: "Парные мечи", actionCost: "action+bonus" })).toBe("sword_dual");

    // Топор и щит
    expect(detectWeaponAnimType({ name: "Боевой топор со щитом" })).toBe("axe_shield");

    // Посох
    expect(detectWeaponAnimType({ name: "Боевой посох" })).toBe("staff");

    // Заклинания
    expect(detectWeaponAnimType(null, { isSpell: true, spellName: "Огненный снаряд" })).toBe("spell_projectile");
  });

  it("should calculate recoil impulse along the attack angle", () => {
    // Вправо -> импульс +X
    const recoilEast = getRecoilOffset(0, 18);
    expect(recoilEast.x).toBeCloseTo(18);
    expect(recoilEast.y).toBeCloseTo(0);

    // Вниз -> импульс +Y
    const recoilSouth = getRecoilOffset(90, 18);
    expect(recoilSouth.x).toBeCloseTo(0);
    expect(recoilSouth.y).toBeCloseTo(18);

    // Влево -> импульс -X
    const recoilWest = getRecoilOffset(180, 18);
    expect(recoilWest.x).toBeCloseTo(-18);
    expect(recoilWest.y).toBeCloseTo(0);
  });

  it("should calculate dodge vector perpendicular to incoming attack", () => {
    const dodgeEast = getDodgeOffset(0, 16, 8);
    // При атаке слева направо (0°), уклонение смещает цель вбок (Y) и слегка назад (+X)
    expect(dodgeEast.x).toBeCloseTo(8);
    expect(dodgeEast.y).toBeCloseTo(16);
  });
});
