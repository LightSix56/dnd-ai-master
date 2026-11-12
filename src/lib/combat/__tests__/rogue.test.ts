import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { attemptHide, castSpell, dealDamage, endTurn, moveCombatant, performAttack, useAbility } from "../engine";
import { sneakAttackDice } from "../library-data";
import { hasAssassinate } from "../rules";
import { ally, bySrd, byName, classHero, cond, enemy, hasKey, hasLog, makeState } from "./helpers/class-harness";
import type { Combatant } from "../types";

// Плут: Скрытая атака, Хитрое действие, Невероятное уклонение, Увёртливость.
// Math.random = 0.5: к20 = 11, к4 = 3, к6 = 4, к8 = 5. Атака героя +7 (11 + 7 = 18) против КД 10,
// меч 1к8+3 = 8; у врага 200 хитов, все модификаторы −5.

let r: Combatant;
let foe: Combatant;
let state: any;

/** Плут с фехтовальным мечом; враг в 5 футах справа */
function setup(level: number, extra: Combatant[] = [], subclass = "") {
  r = classHero("Плут", "r", subclass, level, { x: 5, y: 5 });
  r.attacks[0].finesse = true;
  foe = enemy("orc", 6, 5);
  state = makeState([r, foe, ...extra]);
}

const attack = (id = "sword") => performAttack(state, "r", "orc", id);
const nextAttackOfTurn = () => {
  r.actionUsed = false;
  r.attacksMadeThisAction = 0;
};

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Плут: Скрытая атака", () => {
  it("кости растут: 1к6 на 1–2 ур., +1к6 каждые два уровня до 5к6 на 9–10", () => {
    const dice = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => sneakAttackDice(l));
    expect(dice).toEqual(["1d6", "1d6", "2d6", "2d6", "3d6", "3d6", "4d6", "4d6", "5d6", "5d6"]);
  });

  it("без преимущества и без союзника у цели не срабатывает", () => {
    setup(5);
    const out = attack();
    expect(out.hit).toBe(true);
    expect(out.damage).toBe(8);
    expect(out.text).not.toContain("скрытая атака");
  });

  it("союзник в 5 футах от цели даёт Скрытую атаку: 3к6 на 5 ур., к6 = 4", () => {
    setup(5, [ally("friend", 7, 5)]);
    const out = attack();
    expect(out.text).toContain("скрытая атака 3d6");
    expect(out.damage).toBe(8 + 12);
    expect(foe.hpCurrent).toBe(200 - 20);
  });

  it("союзник без сознания или оглушённый не считается", () => {
    setup(5, [ally("friend", 7, 5)]);
    state.get("friend").conditions.push({ type: "unconscious" });
    expect(attack().damage).toBe(8);
    nextAttackOfTurn();
    state.get("friend").conditions = [{ type: "stunned" }];
    r.conditions = r.conditions.filter((c) => c.type !== "sneak_used");
    expect(attack().damage).toBe(8);
  });

  it("враг рядом с целью — не союзник", () => {
    setup(5, [enemy("orc2", 7, 5)]);
    expect(attack().damage).toBe(8);
  });

  it("преимущество (скрытый плут) даёт Скрытую атаку без союзника", () => {
    setup(3);
    r.isHidden = true;
    const out = attack();
    expect(out.text).toContain("скрытая атака 2d6");
    expect(out.damage).toBe(8 + 8);
  });

  it("помеха отменяет Скрытую атаку, даже если рядом союзник", () => {
    setup(5, [ally("friend", 7, 5)]);
    const out = performAttack(state, "r", "orc", "sword", { manualDisadvantage: true });
    expect(out.text).not.toContain("скрытая атака");
  });

  it("преимущество и помеха вместе гасят друг друга, но помеха всё равно запрещает Скрытую атаку", () => {
    setup(5);
    const out = performAttack(state, "r", "orc", "sword", { manualAdvantage: true, manualDisadvantage: true });
    expect(out.text).not.toContain("скрытая атака");
  });

  it("только фехтовальным или дальнобойным оружием", () => {
    setup(5, [ally("friend", 7, 5)]);
    r.attacks[0].finesse = false;
    expect(attack().damage).toBe(8);
    nextAttackOfTurn();
    r.conditions = r.conditions.filter((c) => c.type !== "sneak_used");
    foe.x = 12;
    const shot = performAttack(state, "r", "orc", "bow");
    expect(shot.text).not.toContain("скрытая атака");
    // союзник рядом с целью на новой позиции
    state.get("friend").x = 13;
    nextAttackOfTurn();
    const shot2 = performAttack(state, "r", "orc", "bow");
    expect(shot2.text).toContain("скрытая атака 3d6");
  });

  it("раз в ход: вторая атака в том же ходу без добавки", () => {
    setup(5, [ally("friend", 7, 5)]);
    r.attacksPerAction = 2;
    const first = attack();
    expect(first.text).toContain("скрытая атака");
    const second = attack();
    expect(second.text).not.toContain("скрытая атака");
    expect(second.damage).toBe(8);
  });

  it("раз за ход, а не за бой: на следующий ход снова срабатывает, а реакцией в чужой ход — отдельно", () => {
    setup(5, [ally("friend", 7, 5)]);
    expect(attack().text).toContain("скрытая атака");
    endTurn(state); // ход орка
    // реакция плута в ход орка (провоцированная атака): свой счёт хода
    r.actionUsed = false;
    r.attacksMadeThisAction = 0;
    const reaction = performAttack(state, "r", "orc", "sword", { skipTurnCheck: true });
    expect(reaction.text).toContain("скрытая атака");
    endTurn(state); // ход союзника
    endTurn(state); // снова плут
    nextAttackOfTurn();
    expect(attack().text).toContain("скрытая атака");
  });

  it("критическое попадание удваивает кости Скрытой атаки", () => {
    setup(3, [ally("friend", 7, 5)]);
    // первый бросок — к20 = 20, дальше 0.5
    vi.spyOn(Math, "random").mockReset().mockReturnValueOnce(0.99).mockReturnValue(0.5);
    const out = attack();
    expect(out.crit).toBe(true);
    expect(out.text).toContain("(удвоена критом)");
    // оружие 2к8 + 3 = 13, Скрытая атака 2к6 удвоена: 4к6 = 16
    expect(out.damage).toBe(13 + 16);
  });

  it("мирный союзник тоже рядом с целью не нужен, если плут скрыт: преимущество — единственная причина", () => {
    setup(1);
    r.isHidden = true;
    const out = attack();
    expect(out.damage).toBe(8 + 4);
    expect(r.isHidden).toBe(false);
  });
});

describe("Плут: Хитрое действие", () => {
  it("на 1 уровне кнопок нет, со 2-го — три", () => {
    setup(1);
    expect(r.abilities.some((a) => a.name.startsWith("Хитрое действие"))).toBe(false);
    setup(2);
    expect(r.abilities.filter((a) => a.name.startsWith("Хитрое действие")).map((a) => a.name).sort()).toEqual([
      "Хитрое действие: Засада",
      "Хитрое действие: Отход",
      "Хитрое действие: Рывок",
    ]);
  });

  it("Рывок: бонусное действие, скорость удваивается", () => {
    setup(2);
    useAbility(state, "r", byName(r, "Хитрое действие: Рывок").id);
    expect(r.bonusActionUsed).toBe(true);
    expect(r.actionUsed).toBe(false);
    expect(cond(r, "dashing")).toBeDefined();
  });

  it("Отход: бонусное действие, уход из боя не провоцирует", () => {
    setup(2);
    useAbility(state, "r", byName(r, "Хитрое действие: Отход").id);
    expect(r.bonusActionUsed).toBe(true);
    const out = moveCombatant(state, "r", { x: 3, y: 5 });
    expect(out.opportunityAttacks).toHaveLength(0);
  });

  it("без Отхода выход из досягаемости провоцирует атаку", () => {
    setup(2);
    const out = moveCombatant(state, "r", { x: 3, y: 5 });
    expect(out.opportunityAttacks).toHaveLength(1);
  });

  it("Засада бонусным действием: прячется, если враги её не видят", () => {
    setup(2);
    foe.facing = "E"; // орк смотрит от плута
    const res = attemptHide(state, "r");
    expect(res.success).toBe(true);
    expect(r.isHidden).toBe(true);
    expect(r.bonusActionUsed).toBe(true);
    expect(r.actionUsed).toBe(false);
  });

  it("Засада на виду у врага невозможна", () => {
    setup(2);
    foe.facing = "W";
    expect(() => attemptHide(state, "r")).toThrow(/на виду/);
  });

  it("бонусное действие одно: после Рывка Засада уходит в действие", () => {
    setup(2);
    foe.facing = "E";
    useAbility(state, "r", byName(r, "Хитрое действие: Рывок").id);
    attemptHide(state, "r");
    expect(r.actionUsed).toBe(true);
  });
});

describe("Плут: Невероятное уклонение", () => {
  const hit = (amount: number, o: Record<string, any> = {}) =>
    dealDamage(state, "r", amount, { isAttack: true, attackerId: "orc", damageType: "slashing", ...o });

  it("с 5 уровня реакцией вдвое уменьшает урон атаки", () => {
    setup(5);
    hit(10);
    expect(r.hpCurrent).toBe(40 - 5);
    expect(r.reactionUsed).toBe(true);
    expect(hasLog(state, "Невероятное уклонение")).toBe(true);
  });

  it("реакция одна на раунд: второй удар проходит полностью", () => {
    setup(5);
    hit(10);
    hit(10);
    expect(r.hpCurrent).toBe(40 - 5 - 10);
  });

  it("на 4 уровне умения нет", () => {
    setup(4);
    hit(10);
    expect(r.hpCurrent).toBe(30);
  });

  it("это пассивное умение: нажать его нельзя", () => {
    setup(5);
    expect(() => useAbility(state, "r", bySrd(r, "rogue/uncanny-dodge").id)).toThrow(/само/);
  });

  it("не действует против урона не от атаки (заклинание, эффект)", () => {
    setup(5);
    dealDamage(state, "r", 10, { damageType: "fire" });
    expect(r.hpCurrent).toBe(30);
    expect(r.reactionUsed).toBe(false);
  });

  it("не видит атакующего — не уклоняется: ослеплён, нападающий невидим или скрыт", () => {
    setup(5);
    r.conditions.push({ type: "blinded" });
    hit(10);
    expect(r.hpCurrent).toBe(30);
    r.conditions = [];
    foe.conditions.push({ type: "invisible" });
    hit(10);
    expect(r.hpCurrent).toBe(20);
    foe.conditions = [];
    foe.isHidden = true;
    hit(10);
    expect(r.hpCurrent).toBe(10);
  });

  it("недееспособный плут не уклоняется", () => {
    setup(5);
    r.conditions.push({ type: "incapacitated" });
    hit(10);
    expect(r.hpCurrent).toBe(30);
  });

  it("с уже потраченной реакцией не срабатывает", () => {
    setup(5);
    r.reactionUsed = true;
    hit(10);
    expect(r.hpCurrent).toBe(30);
  });
});

describe("Плут: Увёртливость", () => {
  const fireball = {
    id: "burst",
    name: "Огненный шар",
    level: 3,
    parameters: {
      name: "Огненный шар",
      type: "spell" as const,
      actionCost: "action" as const,
      range: { type: "ranged" as const, value: 150 },
      targeting: "point" as any,
      aoe: { shape: "sphere", size: 20 },
      saveType: "DEX" as const,
      level: 3,
      damage: [{ dice: "8d6", mod: 0, type: "fire", save: "half" as const }],
    },
  };

  const cast = (dc: number) => {
    foe.spells = { slots: { 3: { max: 2, used: 0 } }, known: [], spellSaveDC: dc, spellAttackBonus: 5 } as any;
    foe.abilities = [];
    foe.actionUsed = false;
    castSpell(state, "orc", fireball as any, { center: { x: 5, y: 5 }, skipTurnCheck: true });
  };

  it("на 7 уровне при успехе — урона нет, при провале — половина", () => {
    setup(7);
    cast(5); // спасбросок Ловкости: 11 + 1 = 12 против СЛ 5 — успех
    expect(r.hpCurrent).toBe(40);
    cast(30); // провал: 8к6 = 32, половина = 16
    expect(r.hpCurrent).toBe(40 - 16);
  });

  it("без Увёртливости (6 ур.): успех — половина, провал — всё", () => {
    setup(6);
    r.hpCurrent = r.hpMax = 100;
    cast(5);
    expect(r.hpCurrent).toBe(100 - 16);
    cast(30);
    expect(r.hpCurrent).toBe(100 - 16 - 32);
  });

  it("недееспособный плут не уворачивается", () => {
    setup(7);
    r.conditions.push({ type: "incapacitated" });
    cast(5);
    expect(r.hpCurrent).toBe(40 - 16);
  });
});

describe("Плут: сборка способностей", () => {
  it("на каждом уровне 1–10 каждого архетипа герой собирается, умения подкласса видны с 3 уровня", () => {
    const subclasses = ["Вор", "Убийца", "Мистический ловкач", "Головорез", "Мастер интриг", "Сыщик", "Скаут", "Фантом", "Клинок души"];
    for (const sub of subclasses) {
      for (let level = 1; level <= 10; level++) {
        expect(() => classHero("Плут", "x", sub, level), `${sub} ${level}`).not.toThrow();
      }
      const names = classHero("Плут", "x", sub, 2).abilities.map((a) => a.parameters?.srdKey ?? "");
      expect(names.some((k) => !k.startsWith("rogue/") && k.includes("/") && !k.startsWith("thief/")), `${sub}: нет умений архетипа на 2 уровне`).toBe(false);
    }
  });

  it("герой 20 уровня каждого архетипа собирается без ошибок", () => {
    for (const sub of ["Вор", "Убийца", "Мистический ловкач", "Головорез", "Мастер интриг", "Сыщик", "Скаут", "Фантом", "Клинок души"]) {
      expect(() => classHero("Плут", "x", sub, 20), sub).not.toThrow();
    }
  });

  it("базовые умения: Скрытая атака, Невероятное уклонение с 5 ур., Увёртливость с 7 ур.", () => {
    const c5 = classHero("Плут", "x", "", 5);
    expect(hasKey(c5, "rogue/sneak-attack")).toBe(true);
    expect(hasKey(c5, "rogue/uncanny-dodge")).toBe(true);
    expect(hasKey(c5, "rogue/evasion")).toBe(false);
    expect(hasKey(classHero("Плут", "x", "", 7), "rogue/evasion")).toBe(true);
  });
});

describe("Убийца: Ликвидация", () => {
  it("умение приходит из правил подкласса один раз", () => {
    const a = classHero("Плут", "a", "Убийца", 3);
    expect(a.abilities.filter((x) => x.parameters?.srdKey === "assassin/assassinate")).toHaveLength(1);
    expect(a.abilities.filter((x) => /Ликвидация/.test(x.name))).toHaveLength(1);
    expect(hasAssassinate(a)).toBe(true);
    expect(hasAssassinate(classHero("Плут", "b", "Вор", 3))).toBe(false);
  });

  it("преимущество на атаку по существу, которое ещё не ходило, и Скрытая атака с ним", () => {
    setup(3, [], "Убийца");
    foe.hasActed = false;
    const out = attack();
    expect(out.text).toContain("Ликвидация (цель ещё не ходила)");
    expect(out.text).toContain("скрытая атака 2d6");
  });

  it("по существу, которое уже ходило, преимущества нет", () => {
    setup(3, [], "Убийца");
    foe.hasActed = true;
    const out = attack();
    expect(out.text).not.toContain("Ликвидация");
    expect(out.text).not.toContain("скрытая атака");
  });

  it("попадание по захваченному врасплох — критическое", () => {
    setup(3, [], "Убийца");
    foe.conditions.push({ type: "surprised" });
    const out = attack();
    expect(out.crit).toBe(true);
    expect(out.text).toContain("АВТО-КРИТ (Ликвидация");
    // 2к8 + 3 = 13 и 2к6 Скрытой атаки, удвоенные до 4к6 = 16
    expect(out.damage).toBe(13 + 16);
  });

  it("захваченный врасплох, но уже ходивший, критом не бьётся без умения у других плутов", () => {
    setup(3, [], "Вор");
    foe.conditions.push({ type: "surprised" });
    const out = attack();
    expect(out.crit).toBe(false);
  });
});
