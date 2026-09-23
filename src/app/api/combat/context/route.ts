// API: Получение полного тактического контекста боя для ИИ-Мастера и игроков.
import { db } from "@/lib/db";
import { hydrateCombat } from "@/lib/combat/serialize";
import { CombatState } from "@/lib/combat/engine";
import {
  isInVisionCone,
  hasLineOfSight,
  hasCoverBetween,
  computeVisibilityStatus,
} from "@/lib/combat/movement";
import { isHostile } from "@/lib/combat/types";
import { getSpellDefinition } from "@/lib/combat/library-data";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const combatId = searchParams.get("combatId");

    const row = combatId
      ? await db.combat.findUnique({
          where: { id: combatId },
          include: { combatants: true, mapElements: true },
        })
      : await db.combat.findFirst({
          where: { status: "active" },
          orderBy: { updatedAt: "desc" },
          include: { combatants: true, mapElements: true },
        });

    if (!row) {
      return Response.json({ error: "Активный бой не найден" }, { status: 404 });
    }

    const state = new CombatState(hydrateCombat(row));
    const activeId = state.turnOrder[state.currentTurnIndex];
    const active = activeId ? state.get(activeId) : null;

    if (!active) {
      return Response.json({
        combatId: state.id,
        status: state.status,
        round: state.round,
        turnOrder: state.turnOrder,
        message: "Бой ещё не начат или очередь пуста",
      });
    }

    const remainingMovement = Math.max(0, active.speed - active.movementUsed);

    // Враги и Союзники относительно текущего активного существа
    const allEnemiesRaw = state.combatants.filter((c) => c.hpCurrent > 0 && isHostile(active.type, c.type));
    
    const visibleEnemies: any[] = [];
    const unseenOrHiddenEnemies: any[] = [];

    for (const e of allEnemiesRaw) {
      const distFt = Math.max(Math.abs(e.x - active.x), Math.abs(e.y - active.y)) * 5;
      const inVision = isInVisionCone(active, e);
      const los = hasLineOfSight(active, e, state.mapElements);
      const cover = hasCoverBetween(active, e, state.mapElements, state.combatants);
      const vis = computeVisibilityStatus(e, state.combatants, state.mapElements);
      const isPerceived =
        !e.conditions.some((c) => c.type === "invisible") &&
        (e.isHidden ? distFt <= 5 : los);

      if (isPerceived) {
        visibleEnemies.push({
          id: e.id,
          name: e.name,
          type: e.type,
          className: e.className,
          pos: { x: e.x, y: e.y },
          facing: e.facing || "E",
          hp: `${e.hpCurrent}/${e.hpMax}${e.hpTemp > 0 ? ` (+${e.hpTemp} temp)` : ""}`,
          hpCurrent: e.hpCurrent,
          hpMax: e.hpMax,
          ac: e.ac,
          distanceFt: distFt,
          canSeeTarget: true,
          canAttackDirectly: true,
          cover,
          visibilityStatus: vis.status,
          isHidden: false,
          isConcentrating: e.concentration !== null,
          conditions: e.conditions.map((c) => c.type),
        });
      } else {
        unseenOrHiddenEnemies.push({
          id: e.id,
          name: e.name,
          type: e.type,
          className: e.className,
          pos: "UNKNOWN (Скрыт / Вне поля зрения)",
          facing: "UNKNOWN",
          hp: `${e.hpCurrent}/${e.hpMax}`,
          ac: e.ac,
          distanceFt: "UNKNOWN",
          canSeeTarget: false,
          canAttackDirectly: false,
          reason: e.isHidden
            ? "Цель успешно скрылась (Скрытность / Hide)"
            : e.conditions.some((c) => c.type === "invisible")
            ? "Цель невидима (Invisible)"
            : "Цель за глухим препятствием или стеной",
          visibilityStatus: "unseen",
          isHidden: e.isHidden,
          isConcentrating: e.concentration !== null,
          conditions: e.conditions.map((c) => c.type),
        });
      }
    }

    const enemies = visibleEnemies;

    const allies = state.combatants
      .filter((c) => c.id !== active.id && c.hpCurrent > 0 && !isHostile(active.type, c.type))
      .map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        pos: { x: a.x, y: a.y },
        facing: a.facing || "E",
        hp: `${a.hpCurrent}/${a.hpMax}`,
        distanceFt: Math.max(Math.abs(a.x - active.x), Math.abs(a.y - active.y)) * 5,
        conditions: a.conditions.map((c) => c.type),
      }));

    // Интерактивные элементы карты
    const doors = state.mapElements
      .filter((el) => el.type === "door")
      .map((d) => {
        let isOpen = false;
        try {
          const p = typeof d.properties === "string" ? JSON.parse(d.properties) : d.properties;
          isOpen = !!p?.isOpen;
        } catch {}
        return { id: d.id, pos: { x: d.x, y: d.y }, isOpen };
      });

    const coverSpots = state.mapElements
      .filter((el) => el.type === "cover" || el.type === "obstacle")
      .map((el) => ({ type: el.type, x: el.x, y: el.y, width: el.width, height: el.height }));

    // Заклинания активного существа с расшифровкой параметров
    const spellsDetailed = (active.spells?.prepared?.length ? active.spells.prepared : active.spells?.known || []).map((spellName) => {
      const def = getSpellDefinition(spellName);
      return {
        name: spellName,
        level: def?.level ?? 1,
        school: def?.school ?? "universal",
        actionCost: def?.parameters?.actionCost ?? "action",
        rangeFt: def?.parameters?.range?.value ?? (def?.parameters?.range?.type === "touch" ? 5 : 30),
        aoe: def?.parameters?.aoe ?? null,
        targeting: def?.parameters?.targeting ?? "creature",
        description: def?.parameters?.description ?? "",
      };
    });

    const context = {
      combatId: state.id,
      name: state.name,
      round: state.round,
      currentTurnIndex: state.currentTurnIndex,
      turnOrderSummary: state.turnOrder.map((id) => {
        const c = state.get(id);
        return {
          id,
          name: c?.name ?? id,
          isCurrent: id === active.id,
          hp: c ? `${c.hpCurrent}/${c.hpMax}` : "—",
          isAI: c?.isAIControlled ?? false,
        };
      }),
      activeCombatant: {
        id: active.id,
        name: active.name,
        type: active.type,
        className: active.className,
        level: active.level,
        isAIControlled: active.isAIControlled,
        pos: { x: active.x, y: active.y },
        facing: active.facing || "E",
        hp: { current: active.hpCurrent, max: active.hpMax, temp: active.hpTemp },
        ac: active.ac,
        speedFt: active.speed,
        movementUsedFt: active.movementUsed,
        movementRemainingFt: remainingMovement,
        actions: {
          actionUsed: active.actionUsed,
          bonusActionUsed: active.bonusActionUsed,
          reactionUsed: active.reactionUsed,
          extraActions: active.extraActions,
        },
        conditions: active.conditions.map((c) => c.type),
        isHidden: active.isHidden,
        concentration: active.concentration ? active.concentration.spellName : null,
        attacks: active.attacks.map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          rangeFt: a.range.normal,
          attackBonus: a.attackBonus,
          damage: a.damage.map((d) => `${d.dice}${d.mod ? `+${d.mod}` : ""}`).join(" + "),
          actionCost: a.actionCost,
        })),
        spells: spellsDetailed,
        spellSlots: active.spells?.slots || {},
        abilities: active.abilities.map((ab) => ({
          id: ab.id,
          name: ab.name,
          uses: `${ab.usesMax - ab.usesUsed}/${ab.usesMax}`,
          actionCost: ab.parameters?.actionCost ?? "bonus",
          range: ab.parameters?.range ?? { type: "self" },
          targeting: ab.parameters?.targeting ?? "self",
          description: ab.parameters?.description ?? "",
        })),
      },
      enemies: visibleEnemies,
      visibleEnemies,
      unseenOrHiddenEnemies,
      attackableTargetIds: visibleEnemies.map((e) => e.id),
      targetingRules:
        "⚠️ ВНИМАНИЕ: Атаковать оружием ('attack') и точечными заклинаниями ('cast-spell') РАЗРЕШЕНО ТОЛЬКО цели из attackableTargetIds (visibleEnemies). Скрытые цели (unseenOrHiddenEnemies) атаковать напрямую ЗАПРЕЩЕНО, их точные координаты неизвестны.",
      allies,
      map: {
        gridWidth: state.gridWidth,
        gridHeight: state.gridHeight,
        doors,
        coverSpots,
      },
      recentLog: state.log.slice(-6).map((l) => ({ round: l.round, text: l.text, kind: l.kind })),
    };

    return Response.json(context);
  } catch (error: any) {
    console.error("[combat/context] error:", error);
    return Response.json({ error: error.message || "Ошибка получения контекста" }, { status: 500 });
  }
}
