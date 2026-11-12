// Плут в бою: умения архетипов работают в движке сами.
//
// Механика собрана из типовых форм конструктора (class-kit.ts): кнопки — actions, срабатывания после
// атаки — afterAttack. Умения, которым нужны особые точки движка (Скрытая атака без преимущества,
// Могильные вопли после Скрытой атаки, Жетон души при гибели существа, Высокая скрытность,
// Магическая засада), подключены отдельным модулем через class-hooks.ts.
// Заряды, цели и описания заданы правилами в rogue.ts.

import { rollD20 } from "@/lib/dnd/dice";
import { distanceFt } from "../grid";
import { findPath, isCellBlocked, isTerrainBlocked } from "../movement";
import { effectiveSpeed, hasCondition } from "../rules";
import { EngineError, lastAttackThisTurn, type CombatState } from "../engine";
import { registerClassModule } from "../class-hooks";
import {
  abilityByKey,
  alive,
  applyEffect,
  dealDamage,
  friendly,
  hostilesOf,
  isOwnTurn,
  log,
  modOf,
  registerKit,
  result,
  rollOf,
  strikeWith,
  type ActionCtx,
} from "../class-kit";
import { armRider, armedRider, disarmRider, poolLeft, spendPool } from "../fighter-pool";
import { BLADE_ATTACK_ID, BLADE_BONUS_ATTACK_ID, PSIONIC_DICE_POOL, SOUL_TRINKETS_POOL, psionicFaces } from "../rogue-pool";
import { isHostile, type Attack, type Combatant } from "../types";
import { wailsDiceCount } from "./rogue";

const WAILS = "phantom/wails-from-the-grave";
const PANACHE = "panache";
const INSIGHTFUL = "insightful_fighting";
const SOUL_CHANCE = "soul_chance";

const hasFeature = (c: Combatant, key: string) => !!abilityByKey(c, key);
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Состязание: d20 + бонус против d20 + бонус. true — плут выиграл (ничья в пользу защищающегося) */
function contest(attackerBonus: number, defenderBonus: number): { won: boolean; text: string } {
  const a = rollD20(attackerBonus);
  const d = rollD20(defenderBonus);
  return { won: a.total > d.total, text: `${a.total} ([${a.natural}]${signed(attackerBonus)}) против ${d.total} ([${d.natural}]${signed(defenderBonus)})` };
}

function requireCreature(ctx: ActionCtx, opts: { hostile?: boolean; rangeFt?: number } = {}): Combatant {
  const target = ctx.target();
  if (target.id === ctx.c.id) throw new EngineError(`«${ctx.ability.name}»: выберите другое существо`);
  if (!alive(target)) throw new EngineError(`${target.name} уже выведен из боя`);
  if (opts.hostile && !isHostile(ctx.c.type, target.type)) throw new EngineError(`«${ctx.ability.name}»: выберите врага`);
  if (opts.rangeFt !== undefined && distanceFt(ctx.c, target) > opts.rangeFt) throw new EngineError(`${target.name} дальше ${opts.rangeFt} фт`);
  return target;
}

// ============ ПСИХИЧЕСКИЕ КЛИНКИ ============

/** Клинок на время удара: вплотную — рукопашная атака, дальше — бросок на 60 футов (без зоны максимальной дистанции) */
function psychicBlade(c: Combatant, target: Combatant, bonus: boolean): Attack {
  const dex = modOf(c, "DEX");
  const near = distanceFt(c, target) <= 5;
  return {
    id: bonus ? BLADE_BONUS_ATTACK_ID : BLADE_ATTACK_ID,
    name: bonus ? "Психический клинок (вторая рука)" : "Психический клинок",
    kind: near ? "melee" : "ranged",
    range: near ? { normal: 5 } : { normal: 60 },
    attackBonus: dex + (c.profBonus || 2),
    damage: [{ dice: bonus ? "1d4" : "1d6", mod: dex, type: "psychic", magical: true }],
    actionCost: bonus ? "bonus" : "action",
    finesse: true,
    thrown: true,
    magical: true,
  };
}

function bladeStrike(ctx: ActionCtx, bonus: boolean) {
  const target = requireCreature(ctx, { hostile: true, rangeFt: 60 });
  if (bonus && !lastAttackThisTurn(ctx.state, ctx.c)) {
    throw new EngineError("Вторым клинком можно ударить только после действия Атака в этом ходу");
  }
  ctx.pay();
  const hit = strikeWith(ctx.state, ctx.c, target, psychicBlade(ctx.c, target, bonus));
  return result(`${ctx.c.name}: ${ctx.ability.name} — ${hit.text}`, [{ name: hit.name, hit: hit.hit, amount: hit.amount }]);
}

/** Клетки по прямой от a к b (без a), в порядке удаления */
function lineCells(a: { x: number; y: number }, b: { x: number; y: number }): Array<{ x: number; y: number }> {
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 1; i <= n; i++) out.push({ x: Math.round(a.x + ((b.x - a.x) * i) / n), y: Math.round(a.y + ((b.y - a.y) * i) / n) });
  return out;
}

const cellFree = (state: CombatState, c: Combatant, cell: { x: number; y: number }) =>
  cell.x >= 0 &&
  cell.y >= 0 &&
  cell.x < state.gridWidth &&
  cell.y < state.gridHeight &&
  !isTerrainBlocked(cell, state.mapElements) &&
  !isCellBlocked(cell, state.mapElements, state.combatants, c.id);

function psychicTeleportation(ctx: ActionCtx) {
  const { state, c } = ctx;
  const center = ctx.opts.center;
  if (!center) throw new EngineError("Выберите клетку для Психической телепортации");
  const faces = psionicFaces(c.level || 1);
  const rolled = rollOf(`1d${faces}`);
  const limitFt = rolled * 10;
  const reachable = lineCells(c, center).filter((cell) => distanceFt(c, cell) <= limitFt);
  let landing: { x: number; y: number } | undefined;
  for (const cell of reachable) if (cellFree(state, c, cell)) landing = cell;
  if (!landing) throw new EngineError(`Некуда телепортироваться: кость дала ${rolled}, ${limitFt} фт`);
  ctx.pay();
  c.x = landing.x;
  c.y = landing.y;
  state.mark(c.id);
  const short = landing.x !== center.x || landing.y !== center.y ? " (клинок упал раньше — цель дальше броска)" : "";
  log(state, c, `${c.name}: Психическая телепортация — кость ${rolled}, до ${limitFt} фт${short}`);
  return result(`${c.name} телепортируется в клетку (${landing.x}, ${landing.y}): кость ${rolled}, до ${limitFt} фт${short}`, [{ name: c.name, amount: 0 }]);
}

// ============ ЗАЧИНЩИК (СКАУТ) ============

function skirmisher(ctx: ActionCtx) {
  const { state, c } = ctx;
  const mover = state.current();
  if (!mover || mover.id === c.id || !isHostile(c.type, mover.type) || distanceFt(c, mover) > 5) {
    throw new EngineError("Зачинщик: враг должен заканчивать ход в пределах 5 футов от вас");
  }
  const dest = ctx.opts.center;
  if (!dest) throw new EngineError("Выберите клетку для перемещения");
  const budget = Math.floor(effectiveSpeed(c) / 2);
  const path = findPath(c, dest, budget, state.mapElements, state.combatants, state.gridWidth, state.gridHeight);
  if (!path.ok) throw new EngineError(path.reason ?? "Путь не найден");
  ctx.pay();
  c.x = dest.x;
  c.y = dest.y;
  state.mark(c.id);
  log(state, c, `${c.name}: Зачинщик — перемещается на ${path.costFt} фт (из ${budget} возможных), провоцированных атак нет`, "move");
  return result(`${c.name} перемещается на ${path.costFt} фт без провоцированных атак`, [{ name: c.name, amount: 0 }]);
}

// ============ КНОПКИ ============

registerKit({
  id: "rogue",

  actions: {
    // Дуэлянт: Щегольство
    "swashbuckler/panache": (ctx) => {
      const target = requireCreature(ctx, { rangeFt: 60 });
      ctx.pay();
      const res = contest(modOf(ctx.c, "CHA") + (ctx.c.profBonus || 2), modOf(target, "WIS"));
      if (!res.won) {
        log(ctx.state, ctx.c, `${ctx.c.name}: Щегольство против ${target.name} — ${res.text}: не удалось`);
        return result(`Щегольство не удалось: ${res.text}`, [{ name: target.name, saved: true, amount: 0 }]);
      }
      const hostile = isHostile(ctx.c.type, target.type);
      applyEffect(ctx.state, target.id, { condition: hostile ? PANACHE : "charmed", durationRounds: 10 }, ctx.c.id);
      const text = hostile
        ? `${target.name} теряет голову от блеска ${ctx.c.name}: атакует всех, кроме него, с помехой и не бьёт по другим провоцированными атаками`
        : `${target.name} очарован ${ctx.c.name} на минуту`;
      log(ctx.state, ctx.c, `${ctx.c.name}: Щегольство — ${res.text}. ${text}`);
      return result(text, [{ name: target.name, saved: false, amount: 0 }]);
    },

    // Комбинатор: Помощь бонусным действием, цель атаки в 30 футах
    "mastermind/master-of-tactics": (ctx) => {
      const ally = requireCreature(ctx);
      if (isHostile(ctx.c.type, ally.type)) throw new EngineError("Помощь оказывают союзнику");
      const foe = ctx.opts.targetIds?.[1] ? ctx.state.get(ctx.opts.targetIds[1]) : undefined;
      if (foe && (!isHostile(ctx.c.type, foe.type) || distanceFt(ctx.c, foe) > 30)) {
        throw new EngineError("Цель атаки союзника должна быть врагом в пределах 30 футов от вас");
      }
      ctx.pay();
      applyEffect(ctx.state, ally.id, { condition: "helped", durationRounds: 1 }, ctx.c.id);
      const where = foe ? ` против ${foe.name}` : "";
      log(ctx.state, ctx.c, `${ctx.c.name}: Мастер тактики — помогает ${ally.name}${where} бонусным действием`);
      return result(`${ally.name} получит преимущество на следующую атаку${where}`, [{ name: ally.name, amount: 0 }]);
    },

    // Сыщик: Внимательный взгляд — Восприятие против прячущихся врагов
    "inquisitive/eye-for-detail": (ctx) => {
      ctx.pay();
      const roll = rollD20(modOf(ctx.c, "WIS") + (ctx.c.profBonus || 2));
      const hidden = hostilesOf(ctx.state, ctx.c).filter((t) => t.isHidden);
      const found: string[] = [];
      for (const t of hidden) {
        const dc = 10 + modOf(t, "DEX") + (t.profBonus || 2);
        if (roll.total >= dc) {
          t.isHidden = false;
          ctx.state.mark(t.id);
          found.push(t.name);
        }
      }
      const text = hidden.length === 0
        ? `${ctx.c.name}: Восприятие ${roll.total} — скрытых врагов нет`
        : found.length
          ? `${ctx.c.name}: Восприятие ${roll.total} — замечает ${found.join(", ")}`
          : `${ctx.c.name}: Восприятие ${roll.total} — никого не заметил`;
      log(ctx.state, ctx.c, text);
      return result(text, found.map((name) => ({ name, amount: 0 })));
    },

    // Сыщик: Проницательный бой
    "inquisitive/insightful-fighting": (ctx) => {
      const target = requireCreature(ctx, { hostile: true });
      if (hasCondition(target, "incapacitated") || hasCondition(target, "unconscious") || hasCondition(target, "paralyzed") || hasCondition(target, "stunned")) {
        throw new EngineError(`${target.name} недееспособен — Проницательный бой не нужен`);
      }
      ctx.pay();
      const res = contest(modOf(ctx.c, "WIS") + (ctx.c.profBonus || 2), modOf(target, "CHA"));
      if (!res.won) {
        log(ctx.state, ctx.c, `${ctx.c.name}: Проницательный бой против ${target.name} — ${res.text}: не удалось`);
        return result(`Проницательный бой не удался: ${res.text}`, [{ name: target.name, saved: true, amount: 0 }]);
      }
      // Источник состояния — цель: Скрытая атака разрешена только по ней, прежняя отметка снимается
      applyEffect(ctx.state, ctx.c.id, { condition: INSIGHTFUL, durationRounds: 10 }, target.id);
      log(ctx.state, ctx.c, `${ctx.c.name}: Проницательный бой — ${res.text}. Скрытая атака по ${target.name} не требует преимущества`);
      return result(`Скрытая атака по ${target.name} теперь не требует преимущества`, [{ name: target.name, saved: false, amount: 0 }]);
    },

    // Скаут: Зачинщик
    "scout/skirmisher": skirmisher,

    // Клинок души
    "soulknife/psychic-blades": (ctx) => bladeStrike(ctx, false),
    "soulknife/psychic-blade-bonus": (ctx) => bladeStrike(ctx, true),
    "soulknife/psychic-teleportation": psychicTeleportation,
    "soulknife/psi-recover": (ctx) => {
      const pool = abilityByKey(ctx.c, PSIONIC_DICE_POOL);
      if (!pool || pool.usesUsed <= 0) throw new EngineError("Все кости псионической энергии на месте");
      ctx.pay();
      pool.usesUsed -= 1;
      ctx.c.abilities = [...ctx.c.abilities];
      log(ctx.state, ctx.c, `${ctx.c.name}: возвращает кость псионической энергии (${poolLeft(ctx.c, PSIONIC_DICE_POOL)} из ${pool.usesMax})`);
      return result(`Кость псионической энергии возвращена: ${poolLeft(ctx.c, PSIONIC_DICE_POOL)} из ${pool.usesMax}`, [{ name: ctx.c.name, amount: 0 }]);
    },

    // Фантом: Могильные вопли заряжаются до Скрытой атаки, второе существо выбирается сейчас
    [WAILS]: (ctx) => {
      const second = requireCreature(ctx);
      ctx.pay();
      armRider(ctx.c, WAILS, second.id);
      log(ctx.state, ctx.c, `${ctx.c.name} готовит Могильные вопли: ${second.name} получит урон после Скрытой атаки в этом ходу`);
      return result(`Могильные вопли нацелены на ${second.name}; сработают после Скрытой атаки в этом ходу`);
    },

    // Фантом: безделушка с частицей души погибшего рядом
    "phantom/soul-trinket-claim": (ctx) => {
      const { c, state } = ctx;
      const chance = c.conditions.find((x) => x.type === SOUL_CHANCE);
      if (!chance) throw new EngineError("Рядом (в 30 футах) никто не погиб — нечего запечатлеть");
      const pool = abilityByKey(c, SOUL_TRINKETS_POOL);
      if (!pool || pool.usesUsed <= 0) throw new EngineError("У вас уже максимум безделушек");
      ctx.pay();
      c.conditions = c.conditions.filter((x) => x !== chance);
      pool.usesUsed -= 1;
      c.abilities = [...c.abilities];
      const dead = chance.source ? state.get(chance.source)?.name : undefined;
      log(state, c, `${c.name}: запечатлевает частицу души${dead ? ` ${dead}` : ""} в безделушке (${poolLeft(c, SOUL_TRINKETS_POOL)} из ${pool.usesMax})`);
      return result(`Безделушка создана: ${poolLeft(c, SOUL_TRINKETS_POOL)} из ${pool.usesMax}`, [{ name: c.name, amount: 0 }]);
    },
  },

  // Дуэлянт: после рукопашной атаки в свой ход цель не бьёт провоцированной атакой
  afterAttack: {
    "swashbuckler/fancy-footwork": (state, c, _ability, target, attack) => {
      if (attack.kind !== "melee" || !isOwnTurn(state, c) || target.id === c.id) return;
      c.conditions = [...c.conditions.filter((x) => !(x.type === "fancy_footwork" && x.source === target.id)), { type: "fancy_footwork", source: target.id, duration: 1 }];
      state.mark(c.id);
      log(state, c, `${c.name}: Ловкое маневрирование — ${target.name} не бьёт провоцированной атакой до конца хода`);
    },
  },

  // Фантом: в начале боя безделушек нет
  battleStart: {
    [SOUL_TRINKETS_POOL]: (_state, _c, ability) => {
      ability.usesUsed = ability.usesMax;
    },
  },
});

// ============ ТОЧКИ ДВИЖКА ============

registerClassModule({
  id: "rogue-extras",

  // Скрытая атака без преимущества: Лихая удаль и Проницательный бой
  sneakAllowed(state, attacker, target) {
    if (hasFeature(attacker, "swashbuckler/rakish-audacity") && distanceFt(attacker, target) <= 5) {
      const crowd = state.combatants.some((o) => o.id !== attacker.id && o.id !== target.id && alive(o) && distanceFt(attacker, o) <= 5);
      if (!crowd) return "Лихая удаль";
    }
    if (hasFeature(attacker, "inquisitive/insightful-fighting") && attacker.conditions.some((x) => x.type === INSIGHTFUL && x.source === target.id)) {
      return "Проницательный бой";
    }
    return null;
  },

  // Могильные вопли: половина костей Скрытой атаки второму существу
  sneakDealt(state, attacker, target, _attack, info) {
    const armed = armedRider(attacker, WAILS);
    const ability = abilityByKey(attacker, WAILS);
    if (!armed || !ability || !isOwnTurn(state, attacker)) return "";
    const second = armed.targetId ? state.get(armed.targetId) : undefined;
    if (!second || second.id === target.id || !alive(second) || distanceFt(target, second) > 30) {
      return `, Могильные вопли не сработали: второе существо должно быть в 30 футах от цели`;
    }
    // Свои использования, затем безделушка
    if (ability.usesMax > 0 && ability.usesUsed < ability.usesMax) ability.usesUsed += 1;
    else if (!spendPool(attacker, SOUL_TRINKETS_POOL)) return ", Могильные вопли: использований и безделушек не осталось";
    disarmRider(attacker, WAILS);
    attacker.abilities = [...attacker.abilities];
    const count = wailsDiceCount(Number(info.dice.split("d")[0]) || 1);
    const amount = rollOf(`${count}d6`);
    dealDamage(state, second.id, amount, { damageType: "necrotic", attackerId: attacker.id, source: attacker.id });
    log(state, attacker, `${attacker.name}: Могильные вопли — ${second.name} получает ${amount} некротического урона`);
    return `, Могильные вопли: ${second.name} −${amount} (${count}к6 некротического)`;
  },

  // Фантом: рядом погибло существо — можно создать безделушку реакцией
  creatureDown(state, target) {
    if (target.type === "player" && !hasCondition(target, "dead")) return;
    for (const owner of state.combatants) {
      if (owner.id === target.id || !alive(owner) || !hasFeature(owner, "phantom/soul-trinkets")) continue;
      if (distanceFt(owner, target) > 30) continue;
      owner.conditions = [...owner.conditions.filter((x) => !(x.type === SOUL_CHANCE && x.source === target.id)), { type: SOUL_CHANCE, source: target.id, duration: 1 }];
      state.mark(owner.id);
      log(state, owner, `${owner.name}: ${target.name} погибает рядом — можно запечатлеть частицу души реакцией`);
    }
  },

  // Вор, Превосходная скрытность: преимущество на Скрытность, если плут прошёл не больше половины скорости
  hideAdvantage(_state, c) {
    if (!hasFeature(c, "thief/supreme-sneak")) return null;
    return c.movementUsed <= Math.floor(c.speed / 2) ? "Превосходная скрытность" : null;
  },

  // Мистический ловкач, Магическая засада: скрытый заклинатель — помеха на спасброски цели
  castSaveDisadvantage(_state, caster) {
    return hasFeature(caster, "arcane-trickster/magical-ambush") && caster.isHidden ? "Магическая засада" : null;
  },

  // Щегольство кончается, когда союзник плута нападает на цель
  attackResolved(state, attacker, target) {
    const taunt = target.conditions.find((x) => x.type === PANACHE);
    if (!taunt?.source || taunt.source === attacker.id) return;
    const rogue = state.get(taunt.source);
    if (!rogue || !friendly(rogue, attacker)) return;
    target.conditions = target.conditions.filter((x) => x !== taunt);
    state.mark(target.id);
    log(state, rogue, `${target.name}: Щегольство прекращено — союзник напал на цель`);
  },

  // …и когда цель отходит от плута на 60 футов и дальше
  onMove(state, mover) {
    const taunt = mover.conditions.find((x) => x.type === PANACHE);
    if (!taunt?.source) return;
    const rogue = state.get(taunt.source);
    if (rogue && distanceFt(mover, rogue) < 60) return;
    mover.conditions = mover.conditions.filter((x) => x !== taunt);
    state.mark(mover.id);
    log(state, mover, `${mover.name}: Щегольство прекращено — цель отошла на 60 футов`);
  },
});
