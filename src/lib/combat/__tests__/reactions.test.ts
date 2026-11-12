// Окно реакции: решение игрока, список вариантов, отказ, воспроизводимость повтора.

import { describe, it, expect } from "vitest";
import { dealDamage, moveCombatant } from "../engine";
import { registerClassModule } from "../class-hooks";
import { ReactionPrompt, DECLINE, type ReactionContext } from "../reactions";
import { runWithReactions } from "../reaction-runtime";
import { rand } from "@/lib/rng";
import { enemy, hero, makeState } from "./helpers/fighter-harness";

const ctxOf = (decisions: Record<string, string> = {}): ReactionContext => ({ decisions, seq: 0 });

function scene(heroExtra: Record<string, unknown> = {}) {
  const h = hero("h", "", 1, { x: 5, y: 5 });
  Object.assign(h, heroExtra);
  const e = enemy("e", 6, 5, { attacks: [] });
  const state = makeState([h, e]);
  state.turnOrder = ["e", "h"];
  return { state, h, e };
}

const flee = (state: any) => moveCombatant(state, "e", { x: 6, y: 9 }, { skipTurnCheck: true });

describe("Атака по возможности: решение игрока", () => {
  it("без контекста (тесты, обычный вызов) реакция срабатывает сама", () => {
    const { state, h } = scene();
    const out = flee(state);
    expect(out.opportunityAttacks).toHaveLength(1);
    expect(h.reactionUsed).toBe(true);
  });

  it("с контекстом и без решения бросает окно с одним вариантом", () => {
    const { state } = scene();
    let prompt: ReactionPrompt | null = null;
    try {
      runWithReactions(ctxOf(), 1, () => flee(state));
    } catch (e) {
      prompt = e as ReactionPrompt;
    }
    expect(prompt).toBeInstanceOf(ReactionPrompt);
    expect(prompt!.prompt.reactorId).toBe("h");
    expect(prompt!.prompt.title).toContain("атаку по возможности");
    expect(prompt!.prompt.options.map((o) => o.id)).toEqual(["opportunity-attack"]);
    expect(prompt!.prompt.key).toBe("0:h");
  });

  it("«Да»: герой бьёт, враг останавливается в клетке удара", () => {
    const { state, h, e } = scene();
    const out = runWithReactions(ctxOf({ "0:h": "opportunity-attack" }), 1, () => flee(state));
    expect(out.opportunityAttacks.map((o) => o.attackerId)).toEqual(["h"]);
    expect(h.reactionUsed).toBe(true);
    expect(e.y).toBe(6);
  });

  it("«Нет»: реакция не тратится, враг уходит без остановки", () => {
    const { state, h, e } = scene();
    const out = runWithReactions(ctxOf({ "0:h": DECLINE }), 1, () => flee(state));
    expect(out.opportunityAttacks).toHaveLength(0);
    expect(h.reactionUsed).toBe(false);
    expect(e.y).toBe(9);
  });

  it("ИИ-боец и герой без реакции не спрашивают", () => {
    const ai = scene({ isAIControlled: true });
    expect(() => runWithReactions(ctxOf(), 1, () => flee(ai.state))).not.toThrow();
    expect(ai.h.reactionUsed).toBe(true);

    const tired = scene({ reactionUsed: true });
    const out = runWithReactions(ctxOf(), 1, () => flee(tired.state));
    expect(out.opportunityAttacks).toHaveLength(0);
  });

  it("враг-ИИ бьёт по герою без вопросов", () => {
    const h = hero("h", "", 1, { x: 5, y: 5 });
    const e = enemy("e", 6, 5, { attacks: hero("x", "", 1).attacks });
    const state = makeState([h, e]);
    state.turnOrder = ["h", "e"];
    const out = runWithReactions(ctxOf(), 1, () => moveCombatant(state, "h", { x: 5, y: 9 }, { skipTurnCheck: true }));
    expect(out.opportunityAttacks.map((o) => o.attackerId)).toEqual(["e"]);
  });
});

describe("Воспроизводимость повтора", () => {
  it("один seed даёт одни и те же броски, до и после решения", () => {
    const roll = (seed: number) => runWithReactions(ctxOf(), seed, () => [rand(), rand(), rand()]);
    expect(roll(7)).toEqual(roll(7));
    expect(roll(7)).not.toEqual(roll(8));
  });

  it("атака по возможности попадает и наносит урон одинаково при повторе", () => {
    const hit = () => {
      const { state, e } = scene();
      const out = runWithReactions(ctxOf({ "0:h": "opportunity-attack" }), 42, () => flee(state));
      return { dmg: out.opportunityAttacks[0].damage, hp: e.hpCurrent, hit: out.opportunityAttacks[0].hit };
    };
    expect(hit()).toEqual(hit());
  });
});

describe("Несколько реакций сразу: список или отказ", () => {
  // Два тестовых умения, каждое уменьшает урон по герою с условием react-test и тратит реакцию
  for (const [id, cut] of [["test-a", 3], ["test-b", 5]] as const) {
    registerClassModule({
      id,
      reduceDamage(state, target, amount) {
        if (!target.conditions.some((c) => c.type === "react-test") || target.reactionUsed) return amount;
        target.reactionUsed = true;
        state.addLog(`${id}: урон меньше на ${cut}`, "ability", target.name);
        return amount - cut;
      },
    });
  }

  const hit = (decisions?: Record<string, string>) => {
    const h = hero("h", "", 1);
    h.conditions.push({ type: "react-test" } as any);
    const e = enemy("e", 6, 5, { attacks: [] });
    const state = makeState([h, e]);
    const run = () => dealDamage(state, "h", 20, { isAttack: true, attackerId: "e" });
    if (decisions) runWithReactions(ctxOf(decisions), 1, run);
    else runWithReactions(ctxOf(), 1, run);
    return h;
  };

  it("спрашивает один раз со списком всех доступных реакций", () => {
    let prompt: ReactionPrompt | null = null;
    try {
      hit();
    } catch (e) {
      prompt = e as ReactionPrompt;
    }
    expect(prompt).toBeInstanceOf(ReactionPrompt);
    expect(prompt!.prompt.reactorId).toBe("h");
    expect(prompt!.prompt.options.map((o) => o.id)).toEqual(["test-a", "test-b"]);
    expect(prompt!.prompt.options[0].label).toContain("test-a");
  });

  it("выбранная реакция срабатывает, остальные — нет", () => {
    const h = hit({ "0:h": "test-b" });
    expect(h.hpCurrent).toBe(40 - 15);
    expect(h.reactionUsed).toBe(true);
    expect(hit({ "0:h": "test-a" }).hpCurrent).toBe(40 - 17);
  });

  it("отказ: урон полный, реакция цела", () => {
    const h = hit({ "0:h": DECLINE });
    expect(h.hpCurrent).toBe(40 - 20);
    expect(h.reactionUsed).toBe(false);
  });
});

describe("Ход бота и окно реакции", () => {
  it("атака бота по герою с реакцией доходит до окна, а не глотается перехватом ошибок", async () => {
    const { CombatState } = await import("../engine");
    const { decideBotTurn } = await import("../bot");
    const h = hero("h", "", 1, { x: 5, y: 5 });
    h.conditions.push({ type: "react-test" } as any);
    const orc = enemy("orc", 6, 5, { isAIControlled: true, attacks: hero("x", "", 1).attacks.slice(0, 1) });
    orc.attacks[0].attackBonus = 30; // попадает наверняка
    const state = new CombatState({
      id: "c",
      name: "t",
      status: "active",
      round: 1,
      currentTurnIndex: 0,
      turnOrder: ["orc", "h"],
      combatants: [orc, h],
      mapElements: [],
      log: [],
      gridWidth: 20,
      gridHeight: 20,
    } as any);

    let prompt: ReactionPrompt | null = null;
    try {
      runWithReactions(ctxOf(), 5, () => decideBotTurn(state, "orc"));
    } catch (e) {
      prompt = e as ReactionPrompt;
    }
    expect(prompt).toBeInstanceOf(ReactionPrompt);
    expect(prompt!.prompt.reactorId).toBe("h");

    // Тот же ход с отказом дописывается целиком и бьёт по герою без реакции
    const fresh = new CombatState({ ...(state as any), combatants: [enemy("orc", 6, 5, { isAIControlled: true, attacks: orc.attacks }), (() => { const x = hero("h", "", 1, { x: 5, y: 5 }); x.conditions.push({ type: "react-test" } as any); return x; })()], log: [], turnOrder: ["orc", "h"], currentTurnIndex: 0 } as any);
    runWithReactions(ctxOf({ [prompt!.prompt.key]: DECLINE }), 5, () => decideBotTurn(fresh, "orc"));
    expect(fresh.require("h").hpCurrent).toBeLessThan(40);
    expect(fresh.require("h").reactionUsed).toBe(false);
  });
});
