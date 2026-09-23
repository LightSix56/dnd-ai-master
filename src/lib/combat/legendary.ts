import { distanceFt } from "./grid";
import { performAttack, type CombatState } from "./engine";
import { canAct } from "./rules";
import type { Combatant } from "./types";

/**
 * Выполняет легендарное действие босса.
 */
export function performLegendaryAction(
  state: CombatState,
  bossId: string,
  optionIdOrName: string,
  targetId?: string
): void {
  const boss = state.require(bossId);
  if (!boss.legendaryState) {
    throw new Error(`${boss.name} не имеет легендарных действий`);
  }
  if (boss.hpCurrent <= 0 || !canAct(boss)) {
    throw new Error(`${boss.name} не может совершать легендарные действия (недееспособен)`);
  }

  const opt = boss.legendaryState.options.find(
    (o) =>
      o.id === optionIdOrName ||
      o.name.toLowerCase() === optionIdOrName.toLowerCase()
  );
  if (!opt) {
    throw new Error(`Легендарное действие не найдено: ${optionIdOrName}`);
  }

  if (boss.legendaryState.remainingActions < opt.cost) {
    throw new Error(
      `Недостаточно очков легендарных действий: требуется ${opt.cost}, осталось ${boss.legendaryState.remainingActions}`
    );
  }

  boss.legendaryState.remainingActions -= opt.cost;
  state.mark(boss.id);

  state.addLog(
    `👑 ${boss.name} совершает легендарное действие «${opt.name}» (Осталось очков: ${boss.legendaryState.remainingActions}/${boss.legendaryState.actionsPerRound})`,
    "ability",
    boss.name
  );

  // Если указана цель и есть связанная атака
  if (targetId) {
    const attack = boss.attacks.find(
      (a) =>
        a.id === opt.attackId ||
        a.name.toLowerCase().includes(opt.name.toLowerCase())
    );
    if (attack) {
      try {
        performAttack(state, boss.id, targetId, attack.id);
      } catch (e) {
        state.addLog(`Действие: ${opt.description}`, "system", boss.name);
      }
      return;
    }
  }

  state.addLog(`Действие: ${opt.description}`, "system", boss.name);
}

/**
 * Проверяет и использует заряд Легендарного сопротивления босса при провале спасброска.
 */
export function checkLegendaryResistance(
  boss: Combatant,
  state: CombatState,
  saveName: string
): boolean {
  if (!boss.legendaryState || boss.legendaryState.legendaryResistancesRemaining <= 0) {
    return false;
  }

  boss.legendaryState.legendaryResistancesRemaining -= 1;
  state.mark(boss.id);
  state.addLog(
    `👑 ${boss.name} использует Легендарное сопротивление и преуспевает в спасброске «${saveName}»! (Осталось ${boss.legendaryState.legendaryResistancesRemaining}/${boss.legendaryState.legendaryResistancesMax})`,
    "ability",
    boss.name
  );
  return true;
}

/**
 * Автоматический триггер легендарных действий ИИ-боссов в конце хода противников.
 */
export function triggerAILegendaryActions(
  state: CombatState,
  finishedTurnCombatantId: string
): void {
  const finished = state.get(finishedTurnCombatantId);
  if (!finished) return;

  // Находим активных боссов под управлением ИИ, враждебных завершившему ход
  const bosses = state.combatants.filter(
    (c) =>
      c.id !== finished.id &&
      c.isAIControlled &&
      c.hpCurrent > 0 &&
      canAct(c) &&
      c.type !== finished.type &&
      c.legendaryState &&
      c.legendaryState.remainingActions > 0
  );

  for (const boss of bosses) {
    if (!boss.legendaryState || boss.legendaryState.remainingActions <= 0) continue;

    // Ищем доступные по стоимости опции
    const affordableOptions = boss.legendaryState.options.filter(
      (o) => o.cost <= boss.legendaryState!.remainingActions
    );
    if (affordableOptions.length === 0) continue;

    // Приоритет атаки, если враг в пределах досягаемости (15 фт)
    const attackOpt = affordableOptions.find(
      (o) =>
        o.attackId ||
        boss.attacks.some((a) => a.name.toLowerCase().includes(o.name.toLowerCase()))
    );

    if (attackOpt) {
      const hostiles = state.combatants.filter(
        (c) => c.type !== boss.type && c.hpCurrent > 0 && distanceFt(boss, c) <= 15
      );
      if (hostiles.length > 0) {
        hostiles.sort((a, b) => distanceFt(boss, a) - distanceFt(boss, b));
        performLegendaryAction(state, boss.id, attackOpt.id, hostiles[0].id);
        continue;
      }
    }

    // Иначе используем первую доступную способность
    performLegendaryAction(state, boss.id, affordableOptions[0].id);
  }
}
