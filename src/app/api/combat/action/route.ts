// API: единый endpoint для всех операций с боем.
// Роут только валидирует вход, вызывает движок и сохраняет изменения —
// вся боевая логика живёт в lib/combat/engine.ts.

import { denyCombatAccess } from "@/lib/auth/campaign-access";
import { db } from "@/lib/db";
import {
  CombatState,
  EngineError,
  castSpell,
  checkCombatOver,
  dealDamage,
  endTurn,
  heal,
  moveCombatant,
  performAttack,
  removeCondition,
  rollInitiative,
  syncTurnOrder,
  useAbility,
  applyEffect,
  attemptHide,
  standUp,
  dropProne,
  setFacing,
  teleportCombatant,
  transformWildShape,
  revertWildShape,
  drinkPotion,
  performDeathSave,
  shoveCombatant,
  toggleDoor,
} from "@/lib/combat/engine";
import { runBotTurn, isBotTurn } from "@/lib/combat/bot";
import { hydrateCombat, dehydrateCombatant, safeParse } from "@/lib/combat/serialize";
import { TYPE_COLORS, type ActionParameters, type Cell } from "@/lib/combat/types";
import { buildTurnOrder } from "@/lib/combat/initiative";
import { getSpellDefinition } from "@/lib/combat/library-data";
import { awardCombatVictoryXP } from "@/lib/combat/xp-award";
import { syncCombatToSheets } from "@/lib/combat/combat-sheet-sync";
import { checkCombatControl } from "@/lib/room/combat-access";

/** Версия боя (Combat.updatedAt) на момент загрузки — для защиты от одновременных запросов */
const loadedVersion = new WeakMap<CombatState, Date>();

/** Бой изменён параллельным запросом: клиент должен повторить действие на свежем состоянии */
class ConflictError extends Error {}

/** Загружает бой из БД в снимок движка */
async function loadState(combatId: string): Promise<CombatState> {
  const row = await db.combat.findUnique({
    where: { id: combatId },
    include: { combatants: true, mapElements: true },
  });
  if (!row) throw new EngineError("Бой не найден");
  const state = new CombatState(hydrateCombat(row));
  loadedVersion.set(state, row.updatedAt);
  return state;
}

/**
 * Записывает в БД только то, что изменилось — одной транзакцией.
 * Если между загрузкой и записью бой успел изменить другой запрос (два игрока в комнате
 * нажали одновременно), запись отклоняется: иначе второй запрос молча затёр бы первый.
 */
async function saveState(combatId: string, state: CombatState): Promise<void> {
  const dirtyIds = state.dirtyIds.filter((id) => state.get(id));
  const removedIds = state.removedIds;
  if (dirtyIds.length === 0 && removedIds.length === 0 && !state.isCombatDirty) return;

  const version = loadedVersion.get(state);
  const combatData = {
    round: state.round,
    currentTurnIndex: state.currentTurnIndex,
    turnOrder: JSON.stringify(state.turnOrder),
    log: JSON.stringify(state.log),
  };

  await db.$transaction(async (tx) => {
    // Строка боя обновляется всегда: это и сохранение, и проверка версии, и её продвижение
    const guard = await tx.combat.updateMany({
      where: version ? { id: combatId, updatedAt: version } : { id: combatId },
      data: combatData,
    });
    if (guard.count === 0) {
      throw new ConflictError("Состояние боя только что изменилось — повторите действие");
    }
    for (const id of dirtyIds) {
      const c = state.get(id);
      if (!c) continue;
      await tx.combatant.update({ where: { id }, data: dehydrateCombatant(c) as any });
    }
    // Открытые и закрытые по ходу боя двери
    for (const id of state.dirtyElementIds) {
      const el = state.mapElements.find((e) => e.id === id);
      if (!el) continue;
      await tx.mapElement.update({ where: { id }, data: { properties: JSON.stringify(el.properties ?? {}) } });
    }
    // Сбежавшие с поля боя бойцы удаляются и из БД
    if (removedIds.length > 0) {
      await tx.combatant.deleteMany({ where: { id: { in: removedIds }, combatId } });
    }
  });

  const fresh = await db.combat.findUnique({ where: { id: combatId }, select: { updatedAt: true } });
  if (fresh) loadedVersion.set(state, fresh.updatedAt);
}

/** Ответ после любого действия: свежий бой + служебные поля */
async function respond(combatId: string, extra: Record<string, unknown> = {}) {
  const row = await db.combat.findUnique({
    where: { id: combatId },
    include: { combatants: true, mapElements: true },
  });
  return Response.json({ success: true, combat: row ? hydrateCombat(row) : null, ...extra });
}

/** Асинхронно обновляет персонажа в БД при использовании зелья в бою */
async function syncCharacterPotionConsumed(
  characterId: string,
  potionId: string,
  potionName: string,
  hpCurrent: number,
  hpTemp: number
): Promise<void> {
  try {
    const charRecord = await db.character.findUnique({
      where: { id: characterId },
      select: { inventory: true },
    });
    if (!charRecord) return;

    let inv: any[] = [];
    try {
      inv = JSON.parse(charRecord.inventory || "[]");
    } catch {
      inv = [];
    }

    if (Array.isArray(inv)) {
      const itemIdx = inv.findIndex(
        (item) =>
          (typeof item === "object" && item !== null && (item.id === potionId || item.name === potionName)) ||
          (typeof item === "string" && item.toLowerCase().includes(potionName.toLowerCase()))
      );
      if (itemIdx >= 0) {
        const item = inv[itemIdx];
        if (typeof item === "object" && item !== null) {
          const qty = Number(item.quantity ?? 1) - 1;
          if (qty <= 0) {
            inv.splice(itemIdx, 1);
          } else {
            item.quantity = qty;
          }
        } else {
          inv.splice(itemIdx, 1);
        }
      }
    }

    await db.character.update({
      where: { id: characterId },
      data: {
        hpCurrent,
        hpTemp,
        inventory: JSON.stringify(inv),
      },
    });
  } catch (e) {
    console.error("[drink-potion] Failed to sync character in DB:", e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, combatId } = body as { action: string; combatId: string };

    if (!combatId) {
      return Response.json({ error: "combatId required" }, { status: 400 });
    }

    // Бой кампании доступен её владельцу и участникам её сетевой комнаты
    const accessDenied = await denyCombatAccess(req, combatId);
    if (accessDenied) return accessDenied;

    // В сетевой комнате игрок не может ходить за героя другого игрока
    const denied = await checkCombatControl(req, combatId, action, body as Record<string, unknown>);
    if (denied) {
      return Response.json({ error: denied }, { status: 403 });
    }

    // ===================== ЦИКЛ ХОДОВ =====================

    if (action === "roll-initiative") {
      const state = await loadState(combatId);
      rollInitiative(state);
      await saveState(combatId, state);
      return respond(combatId, { turnOrder: state.turnOrder });
    }

    if (action === "set-initiative") {
      const { initiatives }: { initiatives: Array<{ id: string; initiative: number }> } = body;
      const state = await loadState(combatId);
      for (const { id, initiative } of initiatives) {
        const c = state.get(id);
        if (!c) continue;
        c.initiative = initiative;
        state.mark(id);
      }
      state.turnOrder = buildTurnOrder(state.combatants);
      state.currentTurnIndex = 0;
      state.markCombat();
      await saveState(combatId, state);
      return respond(combatId, { turnOrder: state.turnOrder });
    }

    if (action === "next-turn" || action === "next-turn-full" || action === "end-turn") {
      const state = await loadState(combatId);
      const { nextId } = endTurn(state);
      await saveState(combatId, state);
      return respond(combatId, {
        nextCombatantId: nextId,
        isBotTurn: isBotTurn(state),
        outcome: checkCombatOver(state),
      });
    }

    // Бот считает ход и останавливается — игрок смотрит лог и жмёт "Продолжить"
    if (action === "bot-turn") {
      const state = await loadState(combatId);
      if (!isBotTurn(state)) {
        return Response.json({ error: "Сейчас ход игрока" }, { status: 400 });
      }
      const result = runBotTurn(state);
      await saveState(combatId, state);
      return respond(combatId, { steps: result.steps, outcome: checkCombatOver(state) });
    }

    // Пакетное выполнение хода от ИИ-Мастера (AI DM Turn)
    if (action === "batch-actions" || action === "ai-turn") {
      const { actions }: { actions: Array<{ action: string; [key: string]: any }> } = body;
      const state = await loadState(combatId);
      const stepResults: any[] = [];

      const activeId = state.turnOrder[state.currentTurnIndex];

      for (const act of actions || []) {
        const cid: string = act.combatantId || act.attackerId || act.casterId || activeId || "";
        try {
          if (act.action === "set-facing" || act.action === "facing") {
            setFacing(state, cid, act.facing);
            stepResults.push({ action: "set-facing", ok: true, facing: act.facing });
          } else if (act.action === "move-combatant" || act.action === "move") {
            const res = moveCombatant(state, cid, { x: act.x, y: act.y });
            stepResults.push({
              action: "move",
              ok: true,
              x: act.x,
              y: act.y,
              costFt: res.costFt,
              remainingFt: res.remainingFt,
              opportunityAttacks: res.opportunityAttacks,
            });
          } else if (act.action === "attack") {
            const c = state.require(cid);
            const atk = c.attacks.find(
              (a) => a.id.toLowerCase() === act.attackId?.toLowerCase() || a.name.toLowerCase() === act.attackId?.toLowerCase()
            );
            const atkId = atk?.id ?? act.attackId;
            const res = performAttack(state, cid, act.targetId, atkId, {
              manualAdvantage: act.advantage,
              manualDisadvantage: act.disadvantage,
            });
            stepResults.push({ action: "attack", ok: true, result: res });
          } else if (act.action === "cast-spell" || act.action === "spell") {
            const sid = act.spellId || act.name;
            let def = getSpellDefinition(sid);
            if (!def) {
              const row = await db.spellLibrary.findFirst({
                where: { OR: [{ id: sid }, { name: { equals: sid } }] },
              });
              if (row) {
                def = {
                  name: row.name,
                  level: row.level,
                  school: row.school || "universal",
                  parameters: safeParse<ActionParameters>(row.parameters, {} as ActionParameters),
                };
              }
            }
            if (!def) throw new EngineError(`Заклинание «${sid}» не найдено`);

            const res = castSpell(
              state,
              cid,
              {
                id: def.name || sid,
                name: def.name || sid,
                level: def.level,
                parameters: def.parameters,
              },
              {
                targetIds: act.targetIds ?? (act.targetId ? [act.targetId] : []),
                center: act.center ?? act.centerCell ?? null,
                slotLevel: act.slotLevel ?? def.level,
              }
            );
            stepResults.push({ action: "cast-spell", ok: true, result: res });
          } else if (act.action === "use-ability" || act.action === "ability") {
            const c = state.require(cid);
            const ab = c.abilities.find(
              (a) => a.id.toLowerCase() === act.abilityId?.toLowerCase() || a.name.toLowerCase() === act.abilityId?.toLowerCase()
            );
            const abId = ab?.id ?? act.abilityId;
            const res = useAbility(state, cid, abId, {
              targetIds: act.targetIds ?? (act.targetId ? [act.targetId] : []),
              center: act.center ?? act.centerCell ?? null,
            });
            stepResults.push({ action: "use-ability", ok: true, result: res });
          } else if (act.action === "hide") {
            const res = attemptHide(state, cid);
            stepResults.push({ action: "hide", ok: true, success: res.success, text: res.text });
          } else if (act.action === "stand-up") {
            standUp(state, cid);
            const c = state.get(cid);
            stepResults.push({ action: "stand-up", ok: true, remainingFt: c ? Math.max(0, c.speed - c.movementUsed) : 0 });
          } else if (act.action === "drop-prone") {
            dropProne(state, cid);
            stepResults.push({ action: "drop-prone", ok: true });
          } else if (act.action === "drink-potion" || act.action === "use-potion") {
            const c = state.require(cid);
            const res = drinkPotion(state, cid, act.potionId);
            if (c.characterId) {
              syncCharacterPotionConsumed(
                c.characterId,
                res.potion.id,
                res.potion.name,
                c.hpCurrent,
                c.hpTemp
              ).catch((e) => console.error("[drink-potion] sync error:", e));
            }
            stepResults.push({
              action: act.action,
              ok: true,
              potionResult: {
                potionName: res.potion.name,
                hpHealed: res.hpHealed,
                tempHp: res.tempHp,
                buffEffect: res.buffEffect,
              },
            });
          } else if (act.action === "end-turn" || act.action === "next-turn") {
            const res = endTurn(state);
            stepResults.push({ action: "end-turn", ok: true, nextCombatantId: res.nextId });
          }
        } catch (err: any) {
          stepResults.push({ action: act.action, ok: false, error: err.message });
        }
      }

      await saveState(combatId, state);
      return respond(combatId, { stepResults, outcome: checkCombatOver(state) });
    }

    // ===================== ДЕЙСТВИЯ В БОЮ =====================

    if (action === "move-combatant") {
      const { combatantId, x, y }: { combatantId: string; x: number; y: number } = body;
      const state = await loadState(combatId);
      const result = moveCombatant(state, combatantId, { x, y });
      await saveState(combatId, state);
      return respond(combatId, {
        costFt: result.costFt,
        remainingFt: result.remainingFt,
        opportunityAttacks: result.opportunityAttacks,
      });
    }

    if (action === "reposition-combatant" || action === "dm-move") {
      const { combatantId, x, y }: { combatantId: string; x: number; y: number } = body;
      const state = await loadState(combatId);
      const c = state.require(combatantId);
      const clampedX = Math.max(0, Math.min(state.gridWidth - 1, Math.round(x)));
      const clampedY = Math.max(0, Math.min(state.gridHeight - 1, Math.round(y)));
      c.x = clampedX;
      c.y = clampedY;
      state.mark(c.id);
      state.addLog(`[Мастер] ${c.name} перемещён на (${clampedX}, ${clampedY})`, "system");
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "attack") {
      const {
        attackerId,
        targetId,
        attackId,
        advantage = false,
        disadvantage = false,
      }: {
        attackerId: string;
        targetId: string;
        attackId: string;
        advantage?: boolean;
        disadvantage?: boolean;
      } = body;
      const state = await loadState(combatId);
      const result = performAttack(state, attackerId, targetId, attackId, {
        manualAdvantage: advantage,
        manualDisadvantage: disadvantage,
      });
      await saveState(combatId, state);
      return respond(combatId, { result, outcome: checkCombatOver(state) });
    }

    if (action === "cast-spell") {
      const {
        casterId,
        spellId,
        targetIds = [],
        centerCell,
        center,
        slotLevel,
      }: {
        casterId: string;
        spellId: string;
        targetIds?: string[];
        // Клиент шлёт center, старые вызовы — centerCell
        centerCell?: Cell | null;
        center?: Cell | null;
        slotLevel?: number;
      } = body;

      // Поиск заклинания: 1) getSpellDefinition (память/алиасы), 2) db по ID, 3) db по имени
      let spellDef: { id: string; name: string; level: number; parameters: ActionParameters } | undefined;
      const memDef = getSpellDefinition(spellId);
      if (memDef) {
        spellDef = {
          id: memDef.name,
          name: memDef.name,
          level: memDef.level,
          parameters: memDef.parameters,
        };
      } else {
        const spellRow =
          (await db.spellLibrary.findUnique({ where: { id: spellId } })) ||
          (await db.spellLibrary.findFirst({ where: { name: { equals: spellId } } }));
        if (spellRow) {
          spellDef = {
            id: spellRow.id,
            name: spellRow.name,
            level: spellRow.level,
            parameters: safeParse<ActionParameters>(spellRow.parameters, {} as ActionParameters),
          };
        }
      }

      if (!spellDef) {
        return Response.json({ error: `Заклинание «${spellId}» не найдено в библиотеке` }, { status: 404 });
      }

      const state = await loadState(combatId);
      const result = castSpell(
        state,
        casterId,
        spellDef,
        { targetIds, center: centerCell ?? center ?? null, slotLevel }
      );
      await saveState(combatId, state);
      return respond(combatId, { result, outcome: checkCombatOver(state) });
    }

    if (action === "use-ability") {
      const {
        combatantId,
        abilityId,
        targetIds = [],
        centerCell,
        center,
      }: {
        combatantId: string;
        abilityId: string;
        targetIds?: string[];
        center?: Cell | null;
        centerCell?: Cell | null;
      } = body;
      const state = await loadState(combatId);
      const result = useAbility(state, combatantId, abilityId, {
        targetIds,
        center: centerCell ?? center ?? null,
      });
      await saveState(combatId, state);
      return respond(combatId, { result, outcome: checkCombatOver(state) });
    }

    if (action === "transform-wild-shape") {
      const { combatantId, formId }: { combatantId: string; formId: string } = body;
      const state = await loadState(combatId);
      transformWildShape(state, combatantId, formId);
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "revert-wild-shape") {
      const { combatantId }: { combatantId: string } = body;
      const state = await loadState(combatId);
      revertWildShape(state, combatantId);
      await saveState(combatId, state);
      return respond(combatId);
    }

    // Рывок / Уклонение / Отход — обёртки над одной механикой состояний
    if (action === "dash" || action === "dodge" || action === "disengage") {
      const { combatantId }: { combatantId: string } = body;
      const conditionByAction = {
        dash: "dashing",
        dodge: "dodging",
        disengage: "disengaging",
      } as const;
      const condition = conditionByAction[action as keyof typeof conditionByAction];

      const state = await loadState(combatId);
      const c = state.require(combatantId);
      const current = state.current();
      if (!current || current.id !== combatantId) {
        return Response.json({ error: "Не ваш ход" }, { status: 400 });
      }
      if (c.actionUsed && c.extraActions <= 0) {
        return Response.json({ error: "Действие уже использовано" }, { status: 400 });
      }
      if (c.conditions.some((cond) => cond.type === condition)) {
        return Response.json({ error: "Уже применено в этом ходу" }, { status: 400 });
      }
      if (c.actionUsed && c.extraActions > 0) {
        c.extraActions -= 1;
        c.attacksMadeThisAction = 0;
      } else {
        c.actionUsed = true;
      }
      c.attacksMadeThisAction = c.attacksPerAction;
      state.mark(combatantId);
      applyEffect(state, combatantId, { condition, durationRounds: 1 }, combatantId);
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "help") {
      const { combatantId, targetId }: { combatantId: string; targetId: string } = body;
      const state = await loadState(combatId);
      const c = state.require(combatantId);
      const current = state.current();
      if (!current || current.id !== combatantId) {
        return Response.json({ error: "Не ваш ход" }, { status: 400 });
      }
      if (c.actionUsed && c.extraActions <= 0) {
        return Response.json({ error: "Действие уже использовано" }, { status: 400 });
      }
      if (c.actionUsed && c.extraActions > 0) {
        c.extraActions -= 1;
      } else {
        c.actionUsed = true;
      }
      c.attacksMadeThisAction = c.attacksPerAction;
      state.mark(combatantId);
      applyEffect(state, targetId, { condition: "helped", durationRounds: 1 }, combatantId);
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "shove") {
      const {
        combatantId,
        targetId,
        shoveType = "prone",
      }: { combatantId: string; targetId: string; shoveType?: "push" | "prone" } = body;
      const state = await loadState(combatId);
      const result = shoveCombatant(state, combatantId, targetId, shoveType === "push" ? "push" : "prone");
      await saveState(combatId, state);
      return respond(combatId, { result, outcome: checkCombatOver(state) });
    }

    if (action === "hide") {
      const { combatantId }: { combatantId: string } = body;
      const state = await loadState(combatId);
      const res = attemptHide(state, combatantId);
      await saveState(combatId, state);
      return respond(combatId, { result: res });
    }

    if (action === "stand-up") {
      const { combatantId }: { combatantId: string } = body;
      const state = await loadState(combatId);
      standUp(state, combatantId);
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "drop-prone") {
      const { combatantId }: { combatantId: string } = body;
      const state = await loadState(combatId);
      dropProne(state, combatantId);
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "set-facing") {
      const { combatantId, facing }: { combatantId: string; facing: any } = body;
      const state = await loadState(combatId);
      setFacing(state, combatantId, facing);
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "teleport") {
      const {
        combatantId,
        x,
        y,
        maxRangeFt = 30,
      }: { combatantId: string; x: number; y: number; maxRangeFt?: number } = body;
      const state = await loadState(combatId);
      teleportCombatant(state, combatantId, { x, y }, maxRangeFt);
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "drink-potion" || action === "use-potion") {
      const { combatantId, potionId } = body as { combatantId: string; potionId?: string };
      const state = await loadState(combatId);
      const c = state.require(combatantId);

      const res = drinkPotion(state, combatantId, potionId);

      if (c.characterId) {
        syncCharacterPotionConsumed(
          c.characterId,
          res.potion.id,
          res.potion.name,
          c.hpCurrent,
          c.hpTemp
        ).catch((e) => console.error("[drink-potion] sync character error:", e));
      }

      await saveState(combatId, state);
      return respond(combatId, {
        potionResult: {
          potionName: res.potion.name,
          hpHealed: res.hpHealed,
          tempHp: res.tempHp,
          buffEffect: res.buffEffect,
        },
      });
    }

    // ===================== СОСТОЯНИЯ И РУЧНЫЕ ПРАВКИ =====================

    if (action === "add-condition") {
      const {
        combatantId,
        condition,
        duration,
        saveType,
        saveDC,
      }: {
        combatantId: string;
        // Клиент может прислать строку или объект {type, duration}
        condition: string | { type: string; duration?: number };
        duration?: number;
        saveType?: any;
        saveDC?: number;
      } = body;
      const type = typeof condition === "string" ? condition : condition?.type;
      if (!type) {
        return Response.json({ error: "Нужен тип состояния" }, { status: 400 });
      }
      const rounds =
        duration ?? (typeof condition === "object" ? condition.duration : undefined);
      const state = await loadState(combatId);
      applyEffect(state, combatantId, {
        condition: type,
        durationRounds: rounds,
        saveType,
        saveDC,
      });
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "remove-condition") {
      const { combatantId, conditionType }: { combatantId: string; conditionType: string } = body;
      const state = await loadState(combatId);
      removeCondition(state, combatantId, conditionType);
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "apply-damage" || action === "apply-healing") {
      const { combatantId, amount }: { combatantId: string; amount: number } = body;
      const state = await loadState(combatId);
      if (action === "apply-damage") dealDamage(state, combatantId, amount);
      else heal(state, combatantId, amount);
      await saveState(combatId, state);
      return respond(combatId, { outcome: checkCombatOver(state) });
    }

    if (action === "update-combatant") {
      const { combatantId, updates }: { combatantId: string; updates: Record<string, any> } = body;
      const allowedScalars = [
        "hpCurrent", "hpMax", "hpTemp", "ac", "speed", "initiative", "isHidden",
        "color", "name", "className", "level", "size", "dexMod", "profBonus",
        "attacksPerAction", "isAIControlled", "type", "x", "y",
      ];
      const allowedJson = ["conditions", "attacks", "spells", "abilities", "hotbar", "saves", "abilityMods"];
      const data: Record<string, unknown> = {};
      for (const key of allowedScalars) {
        if (updates[key] !== undefined) data[key] = updates[key];
      }
      for (const key of allowedJson) {
        if (updates[key] !== undefined) data[key] = JSON.stringify(updates[key]);
      }
      await db.combatant.update({ where: { id: combatantId }, data: data as any });

      // Если изменилась инициатива, пересчитываем очередь ходов
      if (updates.initiative !== undefined) {
        const state = await loadState(combatId);
        syncTurnOrder(state);
        await saveState(combatId, state);
      }

      return respond(combatId);
    }

    if (action === "death-save") {
      const { combatantId }: { combatantId: string } = body;
      const state = await loadState(combatId);
      const c = state.require(combatantId);
      if (
        c.hpCurrent <= 0 &&
        !c.conditions.some((cond) => cond.type === "dead" || cond.type === "stable")
      ) {
        performDeathSave(state, c.id);
        await saveState(combatId, state);
      }
      return respond(combatId, { outcome: checkCombatOver(state) });
    }

    if (action === "update-resources") {
      const { combatantId, updates }: { combatantId: string; updates: Record<string, any> } = body;
      const data: Record<string, unknown> = {};
      for (const key of [
        "actionUsed", "bonusActionUsed", "reactionUsed", "movementUsed",
        "hpCurrent", "hpMax", "hpTemp", "attacksMadeThisAction", "extraActions",
      ]) {
        if (updates[key] !== undefined) data[key] = updates[key];
      }
      for (const key of ["hotbar", "attacks", "spells", "abilities"]) {
        if (updates[key] !== undefined) data[key] = JSON.stringify(updates[key]);
      }
      await db.combatant.update({ where: { id: combatantId }, data: data as any });
      return respond(combatId);
    }

    if (action === "reset-turn") {
      const { combatantId }: { combatantId: string } = body;
      await db.combatant.update({
        where: { id: combatantId },
        data: {
          actionUsed: false,
          bonusActionUsed: false,
          reactionUsed: false,
          movementUsed: 0,
          attacksMadeThisAction: 0,
          hasActed: false,
        },
      });
      return respond(combatId);
    }

    // ===================== СОСТАВ БОЯ И КАРТА =====================

    if (action === "add-combatant") {
      const src = body.payload && typeof body.payload === "object" ? { ...body, ...body.payload } : body;
      const {
        name, type, x, y, hpMax, ac, speed, dexMod, color, className, level,
      }: any = src;
      await db.combatant.create({
        data: {
          combatId,
          name,
          type,
          color: color || TYPE_COLORS[type as keyof typeof TYPE_COLORS] || "#6b7280",
          x,
          y,
          hpMax: hpMax || 10,
          hpCurrent: hpMax || 10,
          ac: ac || 10,
          speed: speed || 30,
          initiative: 0,
          initiativeTiebreak: Math.floor(Math.random() * 1_000_000),
          dexMod: dexMod || 0,
          className: className || "",
          level: level || 1,
          conditions: "[]",
          isHidden: false,
          hasActed: false,
          isAIControlled: type === "enemy" || type === "npc",
        },
      });
      const state = await loadState(combatId);
      syncTurnOrder(state);
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "remove-combatant") {
      const { combatantId }: { combatantId: string } = body;
      await db.combatant.delete({ where: { id: combatantId } });
      const state = await loadState(combatId);
      syncTurnOrder(state);
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "add-element") {
      const { type, x, y, width = 1, height = 1 }: any = body;
      await db.mapElement.create({
        data: {
          combatId,
          type,
          x,
          y,
          width,
          height,
          properties: type === "door" ? JSON.stringify({ isOpen: false }) : "{}",
        },
      });
      return respond(combatId);
    }

    if (action === "remove-element") {
      const { elementId }: { elementId: string } = body;
      await db.mapElement.delete({ where: { id: elementId } });
      return respond(combatId);
    }

    if (action === "toggle-door") {
      const { elementId }: { elementId: string } = body;
      const state = await loadState(combatId);
      if (!state.mapElements.some((e) => e.id === elementId)) {
        return Response.json({ error: "Элемент не найден" }, { status: 404 });
      }
      toggleDoor(state, elementId);
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "resize-grid" || action === "update-grid") {
      const { gridWidth, gridHeight, cellSize }: { gridWidth?: number; gridHeight?: number; cellSize?: number } = body;
      const data: Record<string, number> = {};
      if (gridWidth && gridWidth >= 5 && gridWidth <= 100) data.gridWidth = Math.round(gridWidth);
      if (gridHeight && gridHeight >= 5 && gridHeight <= 100) data.gridHeight = Math.round(gridHeight);
      if (cellSize && cellSize >= 20 && cellSize <= 100) data.cellSize = Math.round(cellSize);

      if (Object.keys(data).length > 0) {
        await db.combat.update({
          where: { id: combatId },
          data,
        });
      }
      return respond(combatId);
    }

    if (action === "expand-grid-direction") {
      const { direction, count = 2 }: { direction: "top" | "bottom" | "left" | "right"; count?: number } = body;
      const combatRow = await db.combat.findUnique({ where: { id: combatId } });
      if (!combatRow) return Response.json({ error: "Бой не найден" }, { status: 404 });

      let { gridWidth, gridHeight } = combatRow;
      const shiftCount = Math.max(1, Math.min(20, count));
      let shiftX = 0;
      let shiftY = 0;

      if (direction === "top") {
        gridHeight = Math.min(100, gridHeight + shiftCount);
        shiftY = shiftCount;
      } else if (direction === "bottom") {
        gridHeight = Math.min(100, gridHeight + shiftCount);
      } else if (direction === "left") {
        gridWidth = Math.min(100, gridWidth + shiftCount);
        shiftX = shiftCount;
      } else if (direction === "right") {
        gridWidth = Math.min(100, gridWidth + shiftCount);
      }

      await db.combat.update({
        where: { id: combatId },
        data: { gridWidth, gridHeight },
      });

      if (shiftX !== 0 || shiftY !== 0) {
        const state = await loadState(combatId);
        for (const c of state.combatants) {
          c.x += shiftX;
          c.y += shiftY;
          state.mark(c.id);
        }
        for (const el of state.mapElements) {
          el.x += shiftX;
          el.y += shiftY;
          await db.mapElement.update({
            where: { id: el.id },
            data: { x: el.x, y: el.y },
          });
        }
        await saveState(combatId, state);
      }

      return respond(combatId);
    }

    if (action === "add-from-library") {
      const {
        combatantId,
        itemType,
        itemId,
      }: {
        combatantId: string;
        itemType: "attack" | "spell" | "ability";
        itemId: string;
      } = body;

      const state = await loadState(combatId);
      const c = state.require(combatantId);
      let addedName = "";

      if (itemType === "attack") {
        const atkDef = await db.attackLibrary.findUnique({ where: { id: itemId } });
        if (!atkDef) return Response.json({ error: "Атака не найдена в библиотеке" }, { status: 404 });
        addedName = atkDef.name;
        const damage = safeParse<any[]>(atkDef.damage, []);
        const newAtk: any = {
          id: `atk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: atkDef.name,
          attackBonus: atkDef.attackBonus,
          damage,
          kind: atkDef.kind,
          range: { normal: atkDef.rangeNormal, long: atkDef.rangeLong ?? undefined },
          actionCost: atkDef.actionCost || "action",
          finesse: atkDef.finesse,
        };
        c.attacks = [...c.attacks, newAtk];
        c.hotbar = [...c.hotbar, { id: newAtk.id, type: "attack", name: newAtk.name }];
      } else if (itemType === "spell") {
        const spDef = await db.spellLibrary.findUnique({ where: { id: itemId } });
        if (!spDef) return Response.json({ error: "Заклинание не найдено в библиотеке" }, { status: 404 });
        addedName = spDef.name;
        if (!c.spells) c.spells = { slots: {}, known: [], prepared: [] };
        if (!Array.isArray(c.spells.known)) c.spells.known = [];
        if (!Array.isArray(c.spells.prepared)) c.spells.prepared = [];
        if (!c.spells.known.includes(spDef.id)) {
          c.spells.known = [...c.spells.known, spDef.id];
        }
        if (!c.spells.prepared.includes(spDef.id)) {
          c.spells.prepared = [...c.spells.prepared, spDef.id];
        }
        const hotbarId = `spell_${spDef.id}`;
        if (!c.hotbar.some((h) => h.id === hotbarId)) {
          c.hotbar = [...c.hotbar, { id: hotbarId, type: "spell", name: spDef.name, libraryId: spDef.id }];
        }
      } else if (itemType === "ability") {
        const abDef = await db.abilityLibrary.findUnique({ where: { id: itemId } });
        if (!abDef) return Response.json({ error: "Способность не найдена в библиотеке" }, { status: 404 });
        addedName = abDef.name;
        const params = safeParse<any>(abDef.parameters, {});
        const newAb: any = {
          id: `abl_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: abDef.name,
          source: abDef.source || "Библиотека",
          usesMax: params.uses ?? 0,
          usesUsed: 0,
          refresh: params.refresh ?? "none",
          parameters: params,
        };
        c.abilities = [...c.abilities, newAb];
        c.hotbar = [...c.hotbar, { id: newAb.id, type: "ability", name: newAb.name }];
      }

      state.mark(combatantId);
      state.addLog(`${c.name} получает из библиотеки: «${addedName}»`, "system");
      await saveState(combatId, state);
      return respond(combatId);
    }

    if (action === "end-combat") {
      // Исход решает сервер по живым бойцам, а не клиент: клиент узнаёт о победе только
      // из ответов на атаки, и врагов, добитых правкой хитов мастером, он не заметит
      const outcome = checkCombatOver(await loadState(combatId));
      let xpAward: any = null;
      if (outcome === "players") {
        try {
          xpAward = await awardCombatVictoryXP(combatId);
        } catch (e) {
          console.error("Failed to award combat victory XP:", e);
        }
      }
      await db.combat.update({ where: { id: combatId }, data: { status: "ended" } });
      // Хиты, ячейки и состояния героев после боя — в их листы (один раз на бой)
      try {
        await syncCombatToSheets(combatId);
      } catch (e) {
        console.error("Failed to write combat results to hero sheets:", e);
      }
      return respond(combatId, { xpAward, outcome });
    }

    if (action === "delete-combat") {
      // Перед удалением боя его итоги (хиты, ячейки героев) записываются в листы
      try {
        await syncCombatToSheets(combatId);
      } catch (e) {
        console.error("Failed to write combat results to hero sheets:", e);
      }
      await db.combat.delete({ where: { id: combatId } });
      return Response.json({ success: true });
    }

    return Response.json({ error: `Неизвестное действие: ${action}` }, { status: 400 });
  } catch (error) {
    // Нарушение правил — это ошибка запроса, а не сбой сервера
    if (error instanceof EngineError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ConflictError) {
      return Response.json({ error: error.message, conflict: true }, { status: 409 });
    }
    console.error("[combat/action] error:", error);
    return Response.json(
      {
        error: "Не удалось выполнить действие",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
