// API: Создать готовую тестовую арену с Магом 3-го круга, Друидом и стихийным ландшафтом
import { db } from "@/lib/db";
import { hydrateCombat } from "@/lib/combat/serialize";
import { CAMPAIGN_HEROES_PRESETS, createCombatantFromPreset } from "@/lib/combat/preset-data";
import { getSRDMonster } from "@/lib/combat/srd/adapter";

export async function POST() {
  try {
    // 1. Завершаем активные бои
    await db.combat.updateMany({
      where: { status: "active" },
      data: { status: "ended" },
    });

    // 2. Создаем бой
    const combat = await db.combat.create({
      data: {
        name: "Тестовая Арена: Магия 3-го круга и Дикий облик",
        status: "active",
        gridWidth: 20,
        gridHeight: 15,
        cellSize: 40,
        round: 1,
        currentTurnIndex: 0,
        turnOrder: "[]",
        log: JSON.stringify([
          {
            round: 1,
            text: "⚔️ Тестовая арена развернута! Доступен Архимаг 6 ур. (все заклинания 3-го круга: Огненный шар, Молния, Ускорение, Замедление, Вампирское прикосновение, Страх, Метель), Друид Круга Луны 6 ур. (Дикий облик), река, лава и орда врагов.",
            kind: "system",
          },
        ]),
      },
    });

    // 3. Создаем элементы ландшафта (Вода, Лава, Препятствия, Укрытия)
    const mapElementsData: any[] = [];

    // Водная река
    for (let y = 1; y <= 13; y++) {
      mapElementsData.push({ combatId: combat.id, type: "water", x: 8, y, width: 1, height: 1, properties: "{}" });
      mapElementsData.push({ combatId: combat.id, type: "water", x: 9, y, width: 1, height: 1, properties: "{}" });
    }

    // Лавовый разлом
    for (let y = 4; y <= 10; y++) {
      mapElementsData.push({ combatId: combat.id, type: "lava", x: 12, y, width: 1, height: 1, properties: "{}" });
      mapElementsData.push({ combatId: combat.id, type: "lava", x: 13, y, width: 1, height: 1, properties: "{}" });
    }

    // Каменные колонны
    mapElementsData.push({ combatId: combat.id, type: "obstacle", x: 5, y: 3, width: 1, height: 1, properties: "{}" });
    mapElementsData.push({ combatId: combat.id, type: "obstacle", x: 5, y: 11, width: 1, height: 1, properties: "{}" });
    mapElementsData.push({ combatId: combat.id, type: "obstacle", x: 15, y: 3, width: 1, height: 1, properties: "{}" });
    mapElementsData.push({ combatId: combat.id, type: "obstacle", x: 15, y: 11, width: 1, height: 1, properties: "{}" });

    // Укрытия
    mapElementsData.push({ combatId: combat.id, type: "cover", x: 4, y: 6, width: 1, height: 1, properties: "{}" });
    mapElementsData.push({ combatId: combat.id, type: "cover", x: 4, y: 7, width: 1, height: 1, properties: "{}" });
    mapElementsData.push({ combatId: combat.id, type: "cover", x: 4, y: 8, width: 1, height: 1, properties: "{}" });

    for (const el of mapElementsData) {
      await db.mapElement.create({ data: el });
    }

    // 4. Спавним Мага и Друида
    const magePreset = CAMPAIGN_HEROES_PRESETS.find((p) => p.id === "preset-eldrin-mage");
    const druidPreset = CAMPAIGN_HEROES_PRESETS.find((p) => p.id === "preset-myra-druid");

    const combatantsToCreate: any[] = [];

    if (magePreset) {
      combatantsToCreate.push(createCombatantFromPreset(magePreset, { x: 2, y: 7 }));
    }

    if (druidPreset) {
      combatantsToCreate.push(createCombatantFromPreset(druidPreset, { x: 2, y: 5 }));
    }

    // 5. Спавним Врагов (Орк-вождь, Орки, Гоблины)
    const orcWarChief = getSRDMonster("Orc War Chief") || getSRDMonster("Орк");
    const orc1 = getSRDMonster("Orc") || getSRDMonster("Орк");
    const goblin = getSRDMonster("Goblin") || getSRDMonster("Гоблин");

    if (orcWarChief) {
      const chief = createCombatantFromPreset(orcWarChief, { x: 17, y: 7 }, "Орк-вождь");
      chief.type = "enemy";
      chief.isAIControlled = true;
      combatantsToCreate.push(chief);
    }

    if (orc1) {
      const o1 = createCombatantFromPreset(orc1, { x: 16, y: 4 }, "Орк-воин 1");
      o1.type = "enemy";
      o1.isAIControlled = true;
      combatantsToCreate.push(o1);

      const o2 = createCombatantFromPreset(orc1, { x: 16, y: 10 }, "Орк-воин 2");
      o2.type = "enemy";
      o2.isAIControlled = true;
      combatantsToCreate.push(o2);
    }

    if (goblin) {
      const g1 = createCombatantFromPreset(goblin, { x: 15, y: 2 }, "Гоблин-лазутчик 1");
      g1.type = "enemy";
      g1.isAIControlled = true;
      combatantsToCreate.push(g1);

      const g2 = createCombatantFromPreset(goblin, { x: 15, y: 12 }, "Гоблин-лазутчик 2");
      g2.type = "enemy";
      g2.isAIControlled = true;
      combatantsToCreate.push(g2);

      const g3 = createCombatantFromPreset(goblin, { x: 18, y: 5 }, "Гоблин-стрелок 1");
      g3.type = "enemy";
      g3.isAIControlled = true;
      combatantsToCreate.push(g3);

      const g4 = createCombatantFromPreset(goblin, { x: 18, y: 9 }, "Гоблин-стрелок 2");
      g4.type = "enemy";
      g4.isAIControlled = true;
      combatantsToCreate.push(g4);
    }

    const createdIds: string[] = [];
    for (const c of combatantsToCreate) {
      const row = await db.combatant.create({
        data: {
          combatId: combat.id,
          name: c.name,
          type: c.type,
          color: c.color,
          x: c.x,
          y: c.y,
          hpMax: c.hpMax,
          hpCurrent: c.hpCurrent,
          hpTemp: c.hpTemp || 0,
          ac: c.ac,
          speed: c.speed,
          dexMod: c.dexMod,
          initiative: 0,
          initiativeTiebreak: Math.floor(Math.random() * 1_000_000),
          className: c.className || "",
          level: c.level || 1,
          size: c.size || "medium",
          conditions: JSON.stringify(c.conditions || []),
          isHidden: c.isHidden || false,
          hasActed: c.hasActed || false,
          attacksPerAction: c.attacksPerAction || 1,
          attacks: JSON.stringify(c.attacks || []),
          spells: JSON.stringify(c.spells || { slots: {}, known: [] }),
          abilities: JSON.stringify(c.abilities || []),
          saves: JSON.stringify(c.saves || {}),
          abilityMods: JSON.stringify(c.abilityMods || {}),
          profBonus: c.profBonus || 2,
          isAIControlled: c.isAIControlled || false,
        },
      });
      createdIds.push(row.id);
    }

    await db.combat.update({
      where: { id: combat.id },
      data: { turnOrder: JSON.stringify(createdIds) },
    });

    const result = await db.combat.findUnique({
      where: { id: combat.id },
      include: { combatants: true, mapElements: true },
    });

    return Response.json({ success: true, combat: result ? hydrateCombat(result) : null });
  } catch (error) {
    console.error("[combat/create-arena] error:", error);
    return Response.json(
      { error: "Не удалось создать арену", details: String(error) },
      { status: 500 }
    );
  }
}
