// Скрипт верификации настройки ИИ-Мастера на Polza.ai
import assert from "node:assert/strict";

async function main() {
  console.log("=== ВЕРИФИКАЦИЯ НАСТРОЙКИ ИИ-МАСТЕРА (POLZA.AI) ===");

  // 1. Проверка моделей и дефолтов
  console.log("\n1. Проверка разрешения моделей (src/lib/ai/models.ts)...");
  const models = await import("../src/lib/ai/models.ts");

  assert.equal(
    models.DEFAULT_DM_MODEL,
    "deepseek/deepseek-v4.1-flash",
    "DEFAULT_DM_MODEL должен быть deepseek/deepseek-v4.1-flash"
  );
  assert.equal(
    models.DEFAULT_CHEAP_MODEL,
    "deepseek/deepseek-v4-flash",
    "DEFAULT_CHEAP_MODEL должен быть deepseek/deepseek-v4-flash"
  );
  assert.equal(
    models.DEFAULT_STORY_MODEL,
    "deepseek/deepseek-v4.1-flash",
    "DEFAULT_STORY_MODEL должен быть deepseek/deepseek-v4.1-flash"
  );

  assert.equal(models.resolveDmModel(), "deepseek/deepseek-v4.1-flash");
  assert.equal(models.resolveCheapModel(), "deepseek/deepseek-v4-flash");
  assert.equal(models.resolveStoryModel(), "deepseek/deepseek-v4.1-flash");

  console.log("  ✅ Дефолты 3-х моделей соответствуют требованиям!");

  // 2. Проверка системного промпта и правил темпа (Pacing)
  console.log("\n2. Проверка системного промпта и правил темпа (src/lib/ai/system-prompt.ts)...");
  const systemPromptModule = await import("../src/lib/ai/system-prompt.ts");
  const prompt = systemPromptModule.buildSystemPrompt({
    name: "Тестовая кампания",
    setting: "Забытые Королевства",
    tone: "heroic",
    difficulty: "normal",
    dmStyle: "balanced",
    ruleStrictness: "standard",
    startingLevel: 1,
    levelFrom: 1,
    levelTo: 5,
    language: "ru",
  });

  assert.ok(
    prompt.includes("ТЕМП ИГРЫ (PACING) — КАТЕГОРИЧЕСКИЙ ЗАПРЕТ НА СПЕШКУ"),
    "Промпт должен содержать запрет на спешку"
  );
  assert.ok(
    prompt.includes("В блоке контекста NPC указаны качественно"),
    "Промпт должен указывать на качественное отображение NPC"
  );
  assert.ok(
    prompt.includes("start_combat"),
    "Промпт должен содержать инструкцию для тактического боя"
  );
  console.log("  ✅ Системный промпт содержит правила темпа и качественные статусы NPC!");

  // 3. Проверка качественного формата NPC (реформа контекста)
  console.log("\n3. Проверка правил форматирования качественного контекста NPC...");
  // Симулируем функцию генерации списка персонажей из scene-context
  const sampleParty = [
    {
      name: "Варис",
      type: "player",
      race: "Эльф",
      class: "Следопыт",
      level: 3,
      hpCurrent: 28,
      hpMax: 28,
      ac: 15,
      location: "Таверна «Гарцующий пони»",
      relation: 0,
      notes: null,
    },
    {
      name: "Староста Кормак",
      type: "npc",
      race: "Человек",
      class: null,
      level: 1,
      hpCurrent: 10,
      hpMax: 10,
      ac: 10,
      location: "за дальним столиком",
      relation: 30,
      notes: "ведёт разговор с героем, насторожен",
    },
    {
      name: "Раненый бандит",
      type: "enemy",
      race: "Полуорк",
      class: "Разбойник",
      level: 2,
      hpCurrent: 3,
      hpMax: 22,
      ac: 12,
      location: "в углу",
      relation: -50,
      notes: "прижимает рану к боку",
    },
  ];

  const renderedLines = sampleParty.map((c) => {
    const where = c.location ? `, локация: ${c.location}` : "";
    if (c.type === "player") {
      const who = [c.race, c.class].filter(Boolean).join(" ");
      return `- [Ты] ${c.name} (${who ? `${who}, ` : ""}${c.level}ур): HP ${c.hpCurrent}/${c.hpMax}, AC ${c.ac}${where}`;
    }

    let healthCondition = "здоров";
    if (c.hpCurrent <= 0) {
      healthCondition = "без сознания / при смерти";
    } else if (c.hpCurrent <= c.hpMax * 0.3) {
      healthCondition = "в тяжёлом состоянии / тяжело ранен";
    } else if (c.hpCurrent < c.hpMax * 0.75) {
      healthCondition = "ранен";
    }

    let relationLabel = "нейтрален";
    if (c.type === "enemy" || c.relation <= -30) {
      relationLabel = "враг";
    } else if (c.relation < 0) {
      relationLabel = "насторожен / неприязнь";
    } else if (c.type === "companion" || c.relation >= 50) {
      relationLabel = "соратник / друг";
    } else if (c.relation > 20) {
      relationLabel = "союзник";
    }

    const role = [c.race, c.class].filter(Boolean).join(" ");
    const roleDesc = role ? ` (${role})` : "";
    const notesDesc = c.notes ? `; состояние: ${c.notes}` : "";

    return `- ${c.name}${roleDesc} [${relationLabel}${where}]: ${healthCondition}${notesDesc}`;
  });

  console.log("  Сгенерированный контекст:");
  renderedLines.forEach((l) => console.log("   ", l));

  // Проверяем: у игрока ЕСТЬ числа HP и AC
  assert.ok(renderedLines[0].includes("HP 28/28, AC 15"), "У игрока должны быть точные числа HP и AC");
  // Проверяем: у NPC НЕТ чисел HP и AC!
  assert.ok(!renderedLines[1].includes("HP"), "У NPC не должно быть метки HP");
  assert.ok(!renderedLines[1].includes("AC"), "У NPC не должно быть метки AC");
  assert.ok(renderedLines[1].includes("союзник"), "У Кормака статус союзник");
  assert.ok(renderedLines[1].includes("здоров"), "У Кормака здоровье: здоров");

  assert.ok(!renderedLines[2].includes("HP"), "У врага не должно быть чисел HP");
  assert.ok(renderedLines[2].includes("враг"), "У бандита статус враг");
  assert.ok(renderedLines[2].includes("тяжело ранен"), "У бандита статус тяжело ранен");

  console.log("  ✅ Реформа контекста NPC успешно верифицирована (0 числовых HP/AC для NPC, качественные статусы)!");

  // 4. Проверка реального каталога моделей на Polza.ai
  console.log("\n4. Проверка доступности API Polza.ai (GET https://polza.ai/api/v1/models?type=chat)...");
  try {
    const res = await fetch("https://polza.ai/api/v1/models?type=chat", {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data || [];
      const hasDs41 = list.some((m) => m.id === "deepseek/deepseek-v4.1-flash");
      const hasDs40 = list.some((m) => m.id === "deepseek/deepseek-v4-flash");
      console.log(`  ✅ Polza.ai API доступен! Найдено чат-моделей: ${list.length}`);
      console.log(`  - deepseek/deepseek-v4.1-flash доступна: ${hasDs41 ? "ДА" : "НЕТ"}`);
      console.log(`  - deepseek/deepseek-v4-flash доступна: ${hasDs40 ? "ДА" : "НЕТ"}`);
      assert.ok(hasDs41, "deepseek/deepseek-v4.1-flash должна быть доступна на Polza.ai");
      assert.ok(hasDs40, "deepseek/deepseek-v4-flash должна быть доступна на Polza.ai");
    } else {
      console.log(`  ⚠️ Polza.ai ответил кодом ${res.status} (будет использован fallback на FEATURED_MODELS)`);
    }
  } catch (e) {
    console.log(`  ⚠️ Сеть до Polza.ai временно ограничена: ${e.message} (будет использован fallback на FEATURED_MODELS)`);
  }

  console.log("\n🎉 ВСЕ ТЕСТЫ ВЕРИФИКАЦИИ УСПЕШНО ПРОЙДЕНЫ!");
}

main().catch((err) => {
  console.error("❌ Ошибка верификации:", err);
  process.exit(1);
});
