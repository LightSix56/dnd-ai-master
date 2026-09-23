import { generateEncounter } from "../src/lib/combat/encounters/encounter-generator";
import { CombatState, performAttack, castSpell, useAbility, moveCombatant, endTurn } from "../src/lib/combat/engine";
import { decideBotTurn, runBotTurn, finishBotTurn } from "../src/lib/combat/bot";
import { rollInitiativeForAll, buildTurnOrder } from "../src/lib/combat/initiative";
import { getSpellDefinition, getAbilityDefinition } from "../src/lib/combat/library-data";
import { distanceFt } from "../src/lib/combat/grid";
import { checkReach } from "../src/lib/combat/rules";
import type { Combat, Combatant, Cell, Attack, CombatAbility } from "../src/lib/combat/types";

// ==================== 1. СОЗДАНИЕ 3 ГЕРОЕВ 3-ГО УРОВНЯ ====================

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
  ac: 18, // Кольчуга + Щит
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
      attackBonus: 5, // +3 STR + 2 Prof
      damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
      actionCost: "action",
    },
  ],
  spells: {
    slots: {
      1: { max: 0, used: 0 },
      2: { max: 0, used: 0 },
    },
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
  ac: 18, // Кольчуга + Щит
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
      attackBonus: 4, // +2 STR + 2 Prof
      damage: [{ dice: "1d8", mod: 2, type: "bludgeoning" }],
      actionCost: "action",
    },
  ],
  spells: {
    slots: {
      1: { max: 4, used: 0 },
      2: { max: 2, used: 0 },
    },
    known: ["sacred flame", "guiding bolt", "healing word"],
    spellcastingAbility: "WIS",
    spellSaveDC: 13, // 8 + 2 Prof + 3 WIS
    spellAttackBonus: 5, // 2 Prof + 3 WIS
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
  ac: 15, // Доспехи мага (13 + 2 DEX)
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
      attackBonus: 4, // +2 DEX + 2 Prof
      damage: [{ dice: "1d8", mod: 2, type: "piercing" }],
      actionCost: "action",
    },
  ],
  spells: {
    slots: {
      1: { max: 4, used: 0 },
      2: { max: 2, used: 0 },
    },
    known: ["fire bolt", "magic missile", "shatter", "scorching ray"],
    spellcastingAbility: "INT",
    spellSaveDC: 13, // 8 + 2 Prof + 3 INT
    spellAttackBonus: 5, // 2 Prof + 3 INT
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

// ==================== 2. ГЕНЕРАЦИЯ ЭНКАУНТЕРА ЧЕРЕЗ ДВИЖОК ====================

async function runSimulation() {
  console.log("=== ШАГ 1: ГЕНЕРАЦИЯ БОЯ (Болота, Нежить, Hard, Boss + Minions) ===");

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

console.log(`Карта: ${encounter.mapPreset.name} (${encounter.mapPreset.gridWidth}x${encounter.mapPreset.gridHeight})`);
console.log(`Бюджет XP: цель ${encounter.targetXP} XP, скорректированный: ${encounter.adjustedXP} XP`);
console.log(`Награда за бой: ${encounter.actualXP} XP (${encounter.xpPerPlayer} XP / игрока)`);
console.log(`Враги (${encounter.enemies.length} шт.):`);
encounter.enemies.forEach((e, i) => {
  const c = e.combatant!;
  console.log(`  [${i + 1}] ${c.name} (${e.role}) - CR ${e.monster.challengeRating}, HP ${c.hpMax}, AC ${c.ac}, Координаты: (${c.x}, ${c.y})`);
});

// ==================== 3. СБОРКА И ИНИЦИАЛИЗАЦИЯ COMBAT STATE ====================

const allCombatants: Combatant[] = [
  { ...fighter },
  { ...cleric },
  { ...wizard },
  ...encounter.enemies.map((e) => ({ ...e.combatant! })),
];

// Рассчитываем реальную инициативу
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
  id: "sim_swamp_battle",
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

console.log("\n=== ШАГ 2: БРОСОК ИНИЦИАТИВЫ И ОЧЕРЕДНОСТЬ ХОДОВ ===");
state.turnOrder.forEach((id, idx) => {
  const c = state.require(id);
  console.log(`  ${idx + 1}. [Иниц: ${c.initiative}] ${c.name} (${c.type === "player" ? "Герой" : "Враг"}) - HP: ${c.hpCurrent}/${c.hpMax}`);
});

// ==================== 4. ТАКТИЧЕСКИЙ БОЕВОЙ ЦИКЛ ====================

console.log("\n=== ШАГ 3: РЕАЛЬНЫЙ БОЙ (РАУНД ЗА РАУНДОМ) ===");

const spellShatter = getSpellDefinition("shatter")!;
const spellGuidingBolt = getSpellDefinition("guiding bolt")!;
const spellSacredFlame = getSpellDefinition("sacred flame")!;
const spellFireBolt = getSpellDefinition("fire bolt")!;
const spellHealingWord = getSpellDefinition("healing word")!;
const spellMagicMissile = getSpellDefinition("magic missile")!;

let roundCount = 0;
const MAX_ROUNDS = 20;

function isEncounterOver(): { over: boolean; winner?: "players" | "enemies" } {
  const alivePlayers = state.combatants.filter((c) => c.type === "player" && c.hpCurrent > 0);
  const aliveEnemies = state.combatants.filter((c) => c.type === "enemy" && c.hpCurrent > 0);
  if (alivePlayers.length === 0) return { over: true, winner: "enemies" };
  if (aliveEnemies.length === 0) return { over: true, winner: "players" };
  return { over: false };
}

while (roundCount < MAX_ROUNDS) {
  roundCount++;
  console.log(`\n==================== РАУНД ${state.round} ====================`);
  const initialRound = state.round;

  let turnsInRound = 0;
  const totalInOrder = state.turnOrder.length;

  while (turnsInRound < totalInOrder) {
    const active = state.current();
    if (!active) break;

    // Если персонаж мертв, пропускаем
    if (active.hpCurrent <= 0) {
      endTurn(state);
      turnsInRound++;
      if (state.round > initialRound) break;
      continue;
    }

    console.log(`\n--- ХОД: ${active.name} (${active.type === "player" ? "Герой" : "Враг"}, HP: ${active.hpCurrent}/${active.hpMax}, Поз: [${active.x},${active.y}]) ---`);

    if (active.type === "enemy") {
      // Враги ходят через тактический AI бота движка
      const botRes = runBotTurn(state);
      botRes.steps.forEach((s) => console.log(`  [Враг AI] ${s.text}`));
      finishBotTurn(state);
    } else {
      // Игрок-герой ходит в соответствии со своим классом и D&D 5e тактикой:
      const enemies = state.combatants.filter((c) => c.type === "enemy" && c.hpCurrent > 0);
      if (enemies.length === 0) {
        endTurn(state);
        break;
      }

      if (active.id === "hero_wizard") {
        // ВОЛШЕБНИК:
        // Раунд 1: Оглушительный залп «Дребезги» (Shatter, 2 круг, 10 фт сфера) по скоплению кобольдов-зомби!
        // Последующие раунды: «Волшебная стрела» или «Огненный снаряд».
        const slot2 = active.spells.slots[2];
        const slot1 = active.spells.slots[1];

        if (slot2 && slot2.used < slot2.max) {
          // Ищем центр скопления врагов
          const minionEnemies = enemies.filter((e) => e.name.toLowerCase().includes("кобольд"));
          const targetEnemy = minionEnemies[0] || enemies[0];
          console.log(`  [Тактика Мага] Альдрин читает «${spellShatter.name}» (2 круг) в область вокруг ${targetEnemy.name} (координаты [${targetEnemy.x}, ${targetEnemy.y}])!`);
          try {
            const castRes = castSpell(state, active.id, spellShatter, {
              center: { x: targetEnemy.x, y: targetEnemy.y },
              slotLevel: 2,
            });
            console.log(`  [Результат] Затронуто целей: ${castRes.targetsHit}. Лог урона:`);
          } catch (err: any) {
            console.log(`  [Ошибка каста] ${err.message}`);
          }
        } else if (slot1 && slot1.used < slot1.max) {
          // Волшебная стрела по самому сильному живому врагу (боссу)
          const boss = enemies.find((e) => e.name.toLowerCase().includes("архелон")) || enemies[0];
          console.log(`  [Тактика Мага] Альдрин выпускает 3 «Волшебные стрелы» (1 круг) в ${boss.name}!`);
          try {
            const castRes = castSpell(state, active.id, spellMagicMissile, {
              targetIds: [boss.id, boss.id, boss.id],
              slotLevel: 1,
            });
            console.log(`  [Результат] Стрелы поразили цель! Нанесен урон.`);
          } catch (err: any) {
            console.log(`  [Ошибка] ${err.message}`);
          }
        } else {
          // Заговор Огненный снаряд
          const target = enemies[0];
          console.log(`  [Тактика Мага] Альдрин атакует заговором «${spellFireBolt.name}» цель: ${target.name}!`);
          try {
            castSpell(state, active.id, spellFireBolt, { targetIds: [target.id] });
          } catch (err: any) {
            console.log(`  [Ошибка] ${err.message}`);
          }
        }
      } else if (active.id === "hero_cleric") {
        // ЖРЕЦ:
        // 1. Проверяем, нужно ли кого-то полечить бонусным действием («Исцеляющее слово»)
        const woundedAlly = state.combatants.find(
          (c) => c.type === "player" && c.hpCurrent > 0 && c.hpCurrent < c.hpMax * 0.6
        );
        const slot1 = active.spells.slots[1];
        if (woundedAlly && slot1 && slot1.used < slot1.max) {
          console.log(`  [Тактика Жреца] Лира применяет бонусное действие «${spellHealingWord.name}» на ${woundedAlly.name} (HP: ${woundedAlly.hpCurrent}/${woundedAlly.hpMax})!`);
          try {
            castSpell(state, active.id, spellHealingWord, {
              targetIds: [woundedAlly.id],
              slotLevel: 1,
            });
          } catch (err: any) {
            console.log(`  [Ошибка хила] ${err.message}`);
          }
        }

        // 2. Основное действие: «Направляющий снаряд» (1 круг, 4d6 radiant) в босса или «Священное пламя»
        const boss = enemies.find((e) => e.name.toLowerCase().includes("архелон")) || enemies[0];
        if (slot1 && slot1.used < slot1.max && boss.hpCurrent > 0) {
          console.log(`  [Тактика Жреца] Лира обрушивает «${spellGuidingBolt.name}» (1 круг) на ${boss.name}!`);
          try {
            castSpell(state, active.id, spellGuidingBolt, {
              targetIds: [boss.id],
              slotLevel: 1,
            });
          } catch (err: any) {
            console.log(`  [Ошибка каста] ${err.message}`);
          }
        } else {
          // Заговор Священное пламя
          const target = enemies[0];
          console.log(`  [Тактика Жреца] Лира призывает «${spellSacredFlame.name}» на ${target.name}!`);
          try {
            castSpell(state, active.id, spellSacredFlame, { targetIds: [target.id] });
          } catch (err: any) {
            console.log(`  [Ошибка] ${err.message}`);
          }
        }
      } else if (active.id === "hero_fighter") {
        // ВОИН:
        // 1. Проверяем собственное здоровье: если < 15 HP, используем «Второе дыхание» (Second Wind)
        const secondWind = active.abilities.find((a) => a.name === "Второе дыхание");
        if (active.hpCurrent < 15 && secondWind && secondWind.usesUsed < secondWind.usesMax) {
          console.log(`  [Тактика Воина] Торден использует бонусное действие «Второе дыхание»!`);
          try {
            useAbility(state, active.id, secondWind.id, { targetIds: [active.id] });
          } catch (err: any) {
            console.log(`  [Ошибка абилки] ${err.message}`);
          }
        }

        // 2. Поиск цели в досягаемости меча или сближение
        const sword = active.attacks.find((a) => a.name === "Длинный меч")!;
        let targetEnemy = enemies.find((e) => checkReach(active, e, sword, state.mapElements).ok);

        if (!targetEnemy) {
          // Ищем ближайшего врага
          let closestEnemy = enemies[0];
          let minDist = distanceFt(active, closestEnemy);
          for (const e of enemies) {
            const d = distanceFt(active, e);
            if (d < minDist) {
              minDist = d;
              closestEnemy = e;
            }
          }

          // Перебираем соседние клетки к врагу
          const offsets = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
          ];
          const candidates: Cell[] = offsets
            .map((o) => ({ x: closestEnemy.x + o.x, y: closestEnemy.y + o.y }))
            .filter((c) => c.x >= 0 && c.x < state.gridWidth && c.y >= 0 && c.y < state.gridHeight)
            .filter((c) => !state.combatants.some((cb) => cb.hpCurrent > 0 && cb.x === c.x && cb.y === c.y))
            .sort((a, b) => distanceFt(active, a) - distanceFt(active, b));

          for (const c of candidates) {
            try {
              moveCombatant(state, active.id, c);
              console.log(`  [Движение Воина] Торден перемещается к [${c.x}, ${c.y}] навстречу ${closestEnemy.name}`);
              break;
            } catch {}
          }

          targetEnemy = enemies.find((e) => checkReach(active, e, sword, state.mapElements).ok);
        }

        // 3. Атака мечом
        if (targetEnemy) {
          console.log(`  [Атака Воина] Торден наносит удар Длинным мечом по ${targetEnemy.name}!`);
          try {
            const atkRes = performAttack(state, active.id, targetEnemy.id, sword.id);
            console.log(`  [Результат удара] Попадание: ${atkRes.hit ? "ДА" : "НЕТ"}, Крит: ${atkRes.crit ? "ДА" : "НЕТ"}, Урон: ${atkRes.damage}`);
          } catch (err: any) {
            console.log(`  [Ошибка атаки] ${err.message}`);
          }

          // 4. Action Surge (Порыв к действию) в 1 раунде для второго сокрушительного удара!
          const surge = active.abilities.find((a) => a.name === "Порыв к действию");
          if (surge && surge.usesUsed < surge.usesMax) {
            const secondTarget = targetEnemy.hpCurrent > 0 ? targetEnemy : enemies.find((e) => checkReach(active, e, sword, state.mapElements).ok);
            if (secondTarget) {
              console.log(`  [Порыв к действию] Торден активирует «Порыв к действию» и совершает вторую атаку!`);
              try {
                useAbility(state, active.id, surge.id, { targetIds: [active.id] });
                const atkRes2 = performAttack(state, active.id, secondTarget.id, sword.id);
                console.log(`  [Второй удар] Попадание: ${atkRes2.hit ? "ДА" : "НЕТ"}, Урон: ${atkRes2.damage}`);
              } catch (err: any) {
                console.log(`  [Ошибка surge] ${err.message}`);
              }
            }
          }
        } else {
          console.log(`  [Дистанция] Все живые враги вне зоны досягаемости меча`);
        }
      }

      endTurn(state);
    }

    // Печатаем последние записи лога боя
    const recentLogs = state.log.slice(-3);
    recentLogs.forEach((l) => console.log(`    📜 [ЛОГ ДВИЖКА] ${l.text}`));

    const check = isEncounterOver();
    if (check.over) {
      console.log(`\n>>> БОЙ ЗАВЕРШЕН! Победитель: ${check.winner === "players" ? "ГЕРОИ" : "НЕЖИТЬ"} <<<`);
      break;
    }

    turnsInRound++;
    if (state.round > initialRound) break;
  }

  const check = isEncounterOver();
  if (check.over) break;

  // Сводка состояния в конце раунда
  console.log(`\n--- ИТОГИ РАУНДА ${roundCount} ---`);
  state.combatants.forEach((c) => {
    const status = c.hpCurrent > 0 ? `${c.hpCurrent}/${c.hpMax} HP` : "☠️ ПОВЕРЖЕН";
    console.log(`  ${c.name} (${c.type}): ${status}`);
  });
}

// ==================== 5. ФИНАЛЬНЫЙ АУДИТ ====================

console.log("\n==================== ФИНАЛЬНАЯ СВОДКА БОЯ ====================");
const finalOver = isEncounterOver();
let resultStr = "Ничья (раунды исчерпаны)";
if (finalOver.winner === "players") resultStr = "Триумф героев! Вся нежить повержена.";
else if (finalOver.winner === "enemies") resultStr = "Герои пали в болотах.";
console.log(`Исход сражения: ${resultStr}`);
console.log(`Всего раундов: ${state.round}`);
console.log(`Всего событий в логе движка: ${state.log.length}`);

console.log("\nСостояние группы героев:");
[fighter, cleric, wizard].forEach((h) => {
  const current = state.require(h.id);
  const slotsUsed1 = current.spells.slots[1]?.used ?? 0;
  const slotsUsed2 = current.spells.slots[2]?.used ?? 0;
  console.log(`- ${current.name} (${current.className}):`);
  console.log(`    Хиты: ${current.hpCurrent}/${current.hpMax}`);
  if (current.spells.known.length > 0) {
    console.log(`    Ячейки 1 круга: потрачено ${slotsUsed1} из ${current.spells.slots[1]?.max ?? 0}`);
    console.log(`    Ячейки 2 круга: потрачено ${slotsUsed2} из ${current.spells.slots[2]?.max ?? 0}`);
  }
  if (current.abilities.length > 0) {
    current.abilities.forEach((a) => {
      console.log(`    Способность «${a.name}»: использовано ${a.usesUsed}/${a.usesMax}`);
    });
  }
});

console.log("\nСостояние монстров:");
  encounter.enemies.forEach((e) => {
    const current = state.get(e.combatant!.id);
    if (!current) {
      console.log(`- ${e.monster.name}: 🏃 СБЕЖАЛ С ПОЛЯ БОЯ`);
    } else {
      console.log(`- ${current.name}: ${current.hpCurrent > 0 ? `${current.hpCurrent}/${current.hpMax} HP` : "☠️ УНИЧТОЖЕН"}`);
    }
  });
}

runSimulation().catch(console.error);
