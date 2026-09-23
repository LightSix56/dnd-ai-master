import fs from "fs";
import path from "path";
import { generateEncounter, loadMonsterDefinition } from "../src/lib/combat/encounters/encounter-generator";
import { monsterDefinitionToCombatant } from "../src/lib/combat/monsters/monster-adapter";
import { lavaCavePreset } from "../src/lib/combat/maps/presets/lava-cave";
import { CombatState, performAttack, castSpell, useAbility, moveCombatant, endTurn } from "../src/lib/combat/engine";
import { runBotTurn, finishBotTurn } from "../src/lib/combat/bot";
import { rollInitiativeForAll, buildTurnOrder } from "../src/lib/combat/initiative";
import { getSpellDefinition, getAbilityDefinition } from "../src/lib/combat/library-data";
import { generateCombatLoot } from "../src/lib/combat/rewards/loot-generator";
import type { Combat, Combatant } from "../src/lib/combat/types";

const SESSION_FILE = path.resolve(__dirname, "../scratch/interactive-combat-session.json");

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveState(state: CombatState, metadata?: Record<string, unknown>) {
  ensureDir(SESSION_FILE);
  const combatData: Combat = {
    id: state.id,
    name: state.name,
    status: state.status,
    combatants: state.combatants,
    mapElements: state.mapElements,
    round: state.round,
    turnOrder: state.turnOrder,
    currentTurnIndex: state.currentTurnIndex,
    log: state.log,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
  };
  const data = {
    combat: combatData,
    metadata: metadata || {},
  };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function loadSession(): { state: CombatState; metadata: Record<string, unknown> } {
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error("Сессия боя не найдена. Сначала инициализируйте бой: init");
  }
  const raw = fs.readFileSync(SESSION_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  const state = new CombatState(parsed.combat);
  return { state, metadata: parsed.metadata || {} };
}

// 3 Героя 3-го уровня
function createHeroes(): Combatant[] {
  const fighter: Combatant = {
    id: "hero_fighter",
    name: "Торден Каменный Щит",
    type: "player",
    color: "#3b82f6",
    x: 3,
    y: 14,
    facing: "N",
    hpCurrent: 28,
    hpMax: 28,
    hpTemp: 0,
    ac: 18,
    speed: 30,
    initiative: 0,
    initiativeTiebreak: 12,
    dexMod: 1,
    abilityMods: { STR: 3, DEX: 1, CON: 2, INT: 0, WIS: 1, CHA: -1 },
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "Воин",
    level: 3,
    size: "medium",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: [
      {
        id: "atk_longsword",
        name: "Длинный меч",
        kind: "melee",
        range: { normal: 5 },
        attackBonus: 5,
        damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
        actionCost: "action",
      },
    ],
    spells: {
      slots: { 1: { max: 0, used: 0 }, 2: { max: 0, used: 0 } },
      known: [],
    },
    abilities: [
      {
        id: "ab_second_wind",
        name: "Второе дыхание",
        usesMax: 1,
        usesUsed: 0,
        refresh: "short",
        parameters: getAbilityDefinition("second_wind")!.parameters,
      },
      {
        id: "ab_action_surge",
        name: "Порыв к действию",
        usesMax: 1,
        usesUsed: 0,
        refresh: "short",
        parameters: getAbilityDefinition("action_surge")!.parameters,
      },
    ],
    concentration: null,
    saves: {
      STR: { prof: true, mod: 5 },
      DEX: { prof: false, mod: 1 },
      CON: { prof: true, mod: 4 },
      INT: { prof: false, mod: 0 },
      WIS: { prof: false, mod: 1 },
      CHA: { prof: false, mod: -1 },
    },
  };

  const cleric: Combatant = {
    id: "hero_cleric",
    name: "Лира Солнечный Свет",
    type: "player",
    color: "#eab308",
    x: 4,
    y: 14,
    facing: "N",
    hpCurrent: 24,
    hpMax: 24,
    hpTemp: 0,
    ac: 18,
    speed: 30,
    initiative: 0,
    initiativeTiebreak: 10,
    dexMod: 0,
    abilityMods: { STR: 2, DEX: 0, CON: 2, INT: 0, WIS: 3, CHA: 1 },
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "Жрец",
    level: 3,
    size: "medium",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: [
      {
        id: "atk_warhammer",
        name: "Боевой молот",
        kind: "melee",
        range: { normal: 5 },
        attackBonus: 4,
        damage: [{ dice: "1d8", mod: 2, type: "bludgeoning" }],
        actionCost: "action",
      },
    ],
    spells: {
      slots: {
        1: { max: 4, used: 0 },
        2: { max: 2, used: 0 },
      },
      known: ["sacred flame", "guiding bolt", "healing word", "bless"],
      spellcastingAbility: "WIS",
      spellSaveDC: 13,
      spellAttackBonus: 5,
    },
    abilities: [],
    concentration: null,
    saves: {
      STR: { prof: false, mod: 2 },
      DEX: { prof: false, mod: 0 },
      CON: { prof: false, mod: 2 },
      INT: { prof: false, mod: 0 },
      WIS: { prof: true, mod: 5 },
      CHA: { prof: true, mod: 3 },
    },
  };

  const wizard: Combatant = {
    id: "hero_wizard",
    name: "Альдрин Звездочёт",
    type: "player",
    color: "#a855f7",
    x: 2,
    y: 15,
    facing: "N",
    hpCurrent: 20,
    hpMax: 20,
    hpTemp: 0,
    ac: 15,
    speed: 30,
    initiative: 0,
    initiativeTiebreak: 14,
    dexMod: 2,
    abilityMods: { STR: -1, DEX: 2, CON: 2, INT: 3, WIS: 1, CHA: 0 },
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "Волшебник",
    level: 3,
    size: "medium",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: [
      {
        id: "atk_crossbow",
        name: "Легкий арбалет",
        kind: "ranged",
        range: { normal: 80, long: 320 },
        attackBonus: 4,
        damage: [{ dice: "1d8", mod: 2, type: "piercing" }],
        actionCost: "action",
      },
    ],
    spells: {
      slots: {
        1: { max: 4, used: 0 },
        2: { max: 2, used: 0 },
      },
      known: ["ray of frost", "magic missile", "shatter", "scorching ray", "shield"],
      spellcastingAbility: "INT",
      spellSaveDC: 13,
      spellAttackBonus: 5,
    },
    abilities: [],
    concentration: null,
    saves: {
      STR: { prof: false, mod: -1 },
      DEX: { prof: false, mod: 2 },
      CON: { prof: false, mod: 2 },
      INT: { prof: true, mod: 5 },
      WIS: { prof: true, mod: 3 },
      CHA: { prof: false, mod: 0 },
    },
  };

  return [fighter, cleric, wizard];
}

async function initDragonCombat() {
  console.log("=== Инициализация тактического энкаунтера (Лавовая пещера, Вирмлинг красного дракона + Культисты) ===");
  const heroes = createHeroes();
  const fighter = heroes.find((h) => h.id === "hero_fighter")!;
  const cleric = heroes.find((h) => h.id === "hero_cleric")!;
  const wizard = heroes.find((h) => h.id === "hero_wizard")!;

  // Расстановка героев у входа в каверну перед лавовым мостом (мост на x: 10..11, y: 8..9)
  fighter.x = 4;
  fighter.y = 8;
  cleric.x = 3;
  cleric.y = 8;
  wizard.x = 3;
  wizard.y = 9;

  // Загружаем полноценные описания монстров из компендиума
  const dragonPath = path.resolve(__dirname, "../src/data/compendium/monsters/dragon/110-red-dragon-wyrmling.json");
  const dragonDef = JSON.parse(fs.readFileSync(dragonPath, "utf8"));
  const cultistPath = path.resolve(__dirname, "../src/data/compendium/monsters/humanoid/482-dragonclaw.json");
  const cultistDef = JSON.parse(fs.readFileSync(cultistPath, "utf8"));

  const dragon = monsterDefinitionToCombatant(dragonDef, {
    id: "enemy_dragon",
    role: "boss",
    isAIControlled: true,
    type: "enemy",
  });
  dragon.name = "Пепельный Клык (Вирмлинг красного дракона)";
  dragon.x = 18;
  dragon.y = 8;

  const cultist1 = monsterDefinitionToCombatant(cultistDef, {
    id: "enemy_cultist_1",
    role: "vanguard",
    isAIControlled: true,
    type: "enemy",
  });
  cultist1.name = "Драконий коготь Игнарис";
  cultist1.x = 13;
  cultist1.y = 8;

  const cultist2 = monsterDefinitionToCombatant(cultistDef, {
    id: "enemy_cultist_2",
    role: "vanguard",
    isAIControlled: true,
    type: "enemy",
  });
  cultist2.name = "Драконий коготь Варок";
  cultist2.x = 13;
  cultist2.y = 9;

  const allCombatants: Combatant[] = [fighter, cleric, wizard, dragon, cultist1, cultist2];

  const initRolls = rollInitiativeForAll(allCombatants);
  const rollMap = new Map(initRolls.map((r) => [r.id, r]));
  allCombatants.forEach((c) => {
    const r = rollMap.get(c.id);
    if (r) {
      c.initiative = r.initiative;
      c.initiativeTiebreak = r.tiebreak;
    }
  });

  const turnOrder = buildTurnOrder(allCombatants);

  const combatData: Combat = {
    id: "session_dragon_battle",
    name: "Битва в лавовой пещере: Ярость Пепельного Клыка",
    status: "active",
    combatants: allCombatants,
    mapElements: lavaCavePreset.elements,
    round: 1,
    turnOrder,
    currentTurnIndex: 0,
    log: [],
    gridWidth: lavaCavePreset.gridWidth,
    gridHeight: lavaCavePreset.gridHeight,
  };

  const state = new CombatState(combatData);
  saveState(state, {
    encounterDetails: {
      targetXP: 1200,
      adjustedXP: 3000,
      actualXP: 1500,
      xpPerPlayer: 500,
      biome: "lava",
      enemies: [
        { id: dragon.id, name: dragon.name, role: "boss", cr: 4, xp: 1100 },
        { id: cultist1.id, name: cultist1.name, role: "vanguard", cr: 1, xp: 200 },
        { id: cultist2.id, name: cultist2.name, role: "vanguard", cr: 1, xp: 200 },
      ],
    },
  });

  printStatus(state);
}

async function initCombat() {
  console.log("=== Инициализация тактического энкаунтера (Болота, Нежить, Boss + Minions) ===");
  const heroes = createHeroes();
  const encounter = await generateEncounter({
    party: [
      { id: "hero_fighter", level: 3, name: "Торден" },
      { id: "hero_cleric", level: 3, name: "Лира" },
      { id: "hero_wizard", level: 3, name: "Альдрин" },
    ],
    difficulty: "hard",
    mapPresetId: "swamp_bog",
    biome: "swamp_bog",
    storyFaction: { creatureTypes: ["undead"] },
    archetype: "boss_minions",
  });

  const allCombatants: Combatant[] = [
    ...heroes,
    ...encounter.enemies.map((e) => ({ ...e.combatant! })),
  ];

  const initRolls = rollInitiativeForAll(allCombatants);
  const rollMap = new Map(initRolls.map((r) => [r.id, r]));
  allCombatants.forEach((c) => {
    const r = rollMap.get(c.id);
    if (r) {
      c.initiative = r.initiative;
      c.initiativeTiebreak = r.tiebreak;
    }
  });

  const turnOrder = buildTurnOrder(allCombatants);

  const combatData: Combat = {
    id: "session_swamp_battle",
    name: `Битва в болотах: ${encounter.mapPreset.name}`,
    status: "active",
    combatants: allCombatants,
    mapElements: encounter.mapPreset.elements,
    round: 1,
    turnOrder,
    currentTurnIndex: 0,
    log: [],
    gridWidth: encounter.mapPreset.gridWidth,
    gridHeight: encounter.mapPreset.gridHeight,
  };

  const state = new CombatState(combatData);
  saveState(state, {
    encounterDetails: {
      targetXP: encounter.targetXP,
      adjustedXP: encounter.adjustedXP,
      actualXP: encounter.actualXP,
      xpPerPlayer: encounter.xpPerPlayer,
      enemies: encounter.enemies.map((e) => ({
        id: e.combatant!.id,
        name: e.combatant!.name,
        role: e.role,
        cr: e.monster.challengeRating,
      })),
    },
  });

  printStatus(state);
}

function printStatus(state: CombatState) {
  const active = state.current();
  console.log(`\n================== РАУНД ${state.round} | ХОД: ${active ? active.name : "Никто"} (${active?.type === "player" ? "ИГРОК" : "ВРАГ"}) ==================`);
  console.log("Очередь инициативы:");
  state.turnOrder.forEach((id, idx) => {
    const c = state.require(id);
    const mark = id === active?.id ? "▶" : " ";
    const status = c.hpCurrent <= 0 ? "☠️ ПОВЕРЖЕН" : `${c.hpCurrent}/${c.hpMax} HP (AC ${c.ac}, [${c.x},${c.y}])`;
    console.log(`  ${mark} [${idx + 1}] (${c.initiative}) ${c.name} [${c.type.toUpperCase()}] (id: ${c.id}): ${status}`);
  });

  if (active) {
    console.log(`\nАктивный комбатант: ${active.name}`);
    console.log(`  HP: ${active.hpCurrent}/${active.hpMax} | AC: ${active.ac} | Скорость: ${active.speed} фт (использовано: ${active.movementUsed} фт)`);
    console.log(`  Координаты: (${active.x}, ${active.y})`);
    console.log(`  Статус действий: Действие=${active.actionUsed ? "ИСПОЛЬЗОВАНО" : "ДОСТУПНО"}, Бонус=${active.bonusActionUsed ? "ИСПОЛЬЗОВАНО" : "ДОСТУПНО"}, Реакция=${active.reactionUsed ? "ИСПОЛЬЗОВАНО" : "ДОСТУПНО"}`);
    if (active.attacks.length > 0) {
      console.log(`  Атаки: ${active.attacks.map((a) => `${a.name} (атака +${a.attackBonus}, урон ${a.damage.map((d) => `${d.dice}+${d.mod}`).join("/")})`).join(", ")}`);
    }
    if (active.spells && active.spells.known.length > 0) {
      console.log(`  Заклинания: ${active.spells.known.join(", ")}`);
      console.log(`  Ячейки 1: ${active.spells.slots[1].max - active.spells.slots[1].used}/${active.spells.slots[1].max} | Ячейки 2: ${active.spells.slots[2].max - active.spells.slots[2].used}/${active.spells.slots[2].max}`);
    }
    if (active.abilities && active.abilities.length > 0) {
      console.log(`  Умения: ${active.abilities.map((ab) => `${ab.name} (${ab.usesMax - ab.usesUsed}/${ab.usesMax})`).join(", ")}`);
    }
  }

  // Проверка окончания боя
  const alivePlayers = state.combatants.filter((c) => c.type === "player" && c.hpCurrent > 0);
  const aliveEnemies = state.combatants.filter((c) => c.type === "enemy" && c.hpCurrent > 0);
  if (alivePlayers.length === 0) {
    console.log("\n💀 ВСЕ ГЕРОИ ПОВЕРЖЕНЫ! TPK!");
  } else if (aliveEnemies.length === 0) {
    console.log("\n🎉 ВСЕ ВРАГИ УНИЧТОЖЕНЫ! ПОБЕДА ГЕРОЕВ!");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "help") {
    console.log(`Команды manual-combat-runner:
  init                           - Инициализировать бой на болотах
  status                         - Показать статус поля боя и текущего хода
  move <x> <y>                   - Переместить активного персонажа в (x, y)
  attack <targetId> [attackId]   - Атаковать цель оружием
  spell <name> [targetId] [lvl] [tx] [ty] - Использовать заклинание
  ability <id> [targetId]        - Использовать умение (second_wind, action_surge)
  npc-turn                       - Выполнить ход текущего NPC/монстра (авто-бот)
  end-turn                       - Завершить текущий ход и перейти к следующему
  finish-rewards                 - Сгенерировать лут и опыт после победы`);
    return;
  }

  if (cmd === "init-dragon" || (cmd === "init" && args[1] === "dragon")) {
    await initDragonCombat();
    return;
  }

  if (cmd === "init") {
    await initCombat();
    return;
  }

  const { state, metadata } = loadSession();
  const logLenBefore = state.log.length;

  try {
    if (cmd === "status") {
      printStatus(state);
      return;
    }

    const active = state.current();
    if (!active) {
      console.log("Нет активного комбатанта.");
      return;
    }

    if (cmd === "move") {
      const tx = parseInt(args[1], 10);
      const ty = parseInt(args[2], 10);
      const res = moveCombatant(state, active.id, { x: tx, y: ty });
      console.log(`[ПЕРЕМЕЩЕНИЕ] Результат: УСПЕХ (затрачено: ${res.costFt} фт, осталось: ${res.remainingFt} фт)`);
    } else if (cmd === "attack") {
      const targetId = args[1];
      const attackId = args[2] || active.attacks[0]?.id;
      if (!targetId || !attackId) {
        console.log("Укажите targetId и attackId!");
        return;
      }
      const res = performAttack(state, active.id, targetId, attackId);
      console.log(`[АТАКА] Результат: ${res.hit ? "ПОПАДАНИЕ" : "ПРОМАХ"} (${res.damage} урона)`);
    } else if (cmd === "spell") {
      const spellName = args[1];
      const targetId = args[2] === "none" || !args[2] ? undefined : args[2];
      const slotLevel = args[3] ? parseInt(args[3], 10) : undefined;
      const targetArea = args[4] && args[5] ? { x: parseInt(args[4], 10), y: parseInt(args[5], 10) } : undefined;
      const spellDef = getSpellDefinition(spellName);
      if (!spellDef) {
        console.log(`Заклинание «${spellName}» не найдено в библиотеке!`);
        return;
      }
      const opts: any = {};
      if (targetId) opts.targetIds = [targetId];
      if (slotLevel !== undefined) opts.slotLevel = slotLevel;
      if (targetArea) opts.center = targetArea;
      const res = castSpell(state, active.id, spellDef, opts);
      console.log(`[ЗАКЛИНАНИЕ] Результат: УСПЕХ (${spellDef.name})`);
    } else if (cmd === "ability") {
      const abilityId = args[1];
      const targetId = args[2] || active.id;
      const opts: any = {};
      if (targetId && targetId !== active.id) opts.targetIds = [targetId];
      const res = useAbility(state, active.id, abilityId, opts);
      console.log(`[УМЕНИЕ] Результат: УСПЕХ (${abilityId})`);
    } else if (cmd === "npc-turn") {
      if (active.type !== "enemy") {
        console.log(`Текущий комбатант ${active.name} — это ИГРОК, а не NPC! Для игрока делайте move, attack, spell, end-turn.`);
        return;
      }
      if (active.hpCurrent <= 0) {
        console.log(`${active.name} мертв, пропускаем ход.`);
        endTurn(state);
      } else {
        const botRes = runBotTurn(state);
        botRes.steps.forEach((s) => console.log(`  [AI БОТ] ${s.text}`));
        finishBotTurn(state);
      }
    } else if (cmd === "end-turn") {
      endTurn(state);
      console.log(`[КОНЕЦ ХОДА] Переход к следующему комбатанту.`);
    } else if (cmd === "finish-rewards") {
      const encounterDetails = (metadata.encounterDetails as any) || {};
      const enemies = encounterDetails.enemies || [
        { name: "Вирмлинг красного дракона", cr: 4 },
        { name: "Драконий коготь Игнарис", cr: 1 },
        { name: "Драконий коготь Варок", cr: 1 },
      ];
      const biome = encounterDetails.biome || "lava";
      const loot = generateCombatLoot(enemies, biome, 3);
      console.log("\n================== НАГРАДЫ ЗА ПОБЕДУ ==================");
      console.log(`Опыт: ${loot.totalXp} XP всего (${loot.xpPerPlayer} XP на каждого героя)`);
      console.log(`Монеты: ${loot.coins.gold} зм, ${loot.coins.silver} см, ${loot.coins.copper} мм (Всего в золоте: ${loot.coins.totalGoldValue} зм)`);
      console.log(`Трофеи и предметы (${loot.items.length} шт.):`);
      loot.items.forEach((item) => {
        console.log(`  - ${item.name} (${item.type}, ${item.rarity || "обычный"}): ${item.description} [${item.valueGp} зм]`);
      });
      console.log(`\nИтог: ${loot.summaryText}`);
      return;
    }

    // Выводим новые записи лога
    const newLogs = state.log.slice(logLenBefore);
    if (newLogs.length > 0) {
      console.log("\n--- Лог событий ---");
      newLogs.forEach((l) => console.log(`📜 [${l.type}] ${l.text}`));
    }

    saveState(state, metadata);
    printStatus(state);
  } catch (err: any) {
    console.error("Ошибка выполнения команды:", err.message);
  }
}

main();
