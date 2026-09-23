import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseMonsterHtml } from "../monster-parser-engine";

describe("Monster Parser Engine (monster-parser-engine)", () => {
  it("should accurately parse Adult Silver Dragon HTML card with all attributes", () => {
    // Read saved silver dragon fixture
    const fixturePath = path.resolve(process.cwd(), "scratch/silver-dragon.html");
    const html = fs.readFileSync(fixturePath, "utf8");

    const monster = parseMonsterHtml(html, {
      id: "132-adult_silver_dragon",
      slug: "adult_silver_dragon",
      source: "Monster Manual",
    });

    // 1. Basic Metadata
    expect(monster.id).toBe("132-adult_silver_dragon");
    expect(monster.name).toContain("серебряный дракон");
    expect(monster.size).toBe("huge");
    expect(monster.type).toBe("dragon");
    expect(monster.challengeRating).toBe(16);
    expect(monster.xp).toBe(15000);

    // 2. AC and HP
    expect(monster.armorClass.value).toBe(19);
    expect(monster.armorClass.type).toContain("природный доспех");
    expect(monster.hitPoints.average).toBe(243);
    expect(monster.hitPoints.hitDice).toContain("18d12");

    // 3. Speeds
    expect(monster.speed.walk).toBe(40);
    expect(monster.speed.fly).toBe(80);

    // 4. Ability Scores
    expect(monster.abilities.str).toBe(27);
    expect(monster.abilities.dex).toBe(10);
    expect(monster.abilities.con).toBe(25);
    expect(monster.abilities.int).toBe(16);
    expect(monster.abilities.wis).toBe(13);
    expect(monster.abilities.cha).toBe(21);

    // 5. Saves and Skills
    expect(monster.savingThrows.dex).toBe(5);
    expect(monster.savingThrows.con).toBe(12);
    expect(monster.savingThrows.wis).toBe(6);
    expect(monster.savingThrows.cha).toBe(10);
    expect(monster.skills.perception).toBe(11);
    expect(monster.skills.stealth).toBe(5);

    // 6. Immunities and Senses
    expect(monster.damageImmunities).toContain("cold");
    expect(monster.senses.blindsight).toBe(60);
    expect(monster.senses.darkvision).toBe(120);
    expect(monster.senses.passivePerception).toBe(21);

    // 7. Actions and Attacks
    const multiattack = monster.actions.find((a) => a.name.toLowerCase().includes("мультиатака"));
    expect(multiattack).toBeDefined();

    const bite = monster.actions.find((a) => a.name.toLowerCase().includes("укус"));
    expect(bite).toBeDefined();
    expect(bite?.attackBonus).toBe(13);
    expect(bite?.reachFt).toBe(10);

    // 8. Breath Weapon with Recharge
    const breath = monster.actions.find((a) => a.name.toLowerCase().includes("дыхание"));
    expect(breath).toBeDefined();
    expect(breath?.recharge).toBe("5-6");
    expect(breath?.aoe?.shape).toBe("cone");
    expect(breath?.aoe?.sizeFt).toBe(60);
    expect(breath?.save?.dc).toBe(20);

    // 9. Legendary Actions
    expect(monster.legendaryActions).toBeDefined();
    expect(monster.legendaryActions?.actionsPerRound).toBe(3);
    expect(monster.legendaryActions?.options.length).toBeGreaterThan(0);
  });

  it("should accurately parse synthetic Spellcaster card with spell slots", () => {
    const casterHtml = `
      <div class="card-wrapper">
        <h2 class="card-title">Маг <small class="card-title-en">Mage</small></h2>
        <ul>
          <li>Средний гуманоид (любой расы), любое мировоззрение</li>
          <li><strong>Класс Доспеха</strong> 12 (15 с доспехами мага)</li>
          <li><strong>Хиты</strong> 40 (9к8)</li>
          <li><strong>Скорость</strong> 30 футов</li>
          <li>Сил 9 (-1) Лов 14 (+2) Тел 11 (+0) Инт 17 (+3) Мдр 12 (+1) Хар 11 (+0)</li>
          <li><strong>Спасброски</strong> Инт +6, Мдр +4</li>
          <li><strong>Навыки</strong> Магия +6, История +6</li>
          <li><strong>Чувства</strong> пассивное Восприятие 11</li>
          <li><strong>Языки</strong> любые четыре языка</li>
          <li><strong>Опасность</strong> 6 (2 300 опыта)</li>
          <li><strong>Использование заклинаний.</strong> Маг является заклинателем 9-го уровня. Его базовой характеристикой является Интеллект (Сл спасброска 14, +6 к попаданию атаками заклинаниями). У него приготовлены следующие заклинания волшебника:
            Заговоры (неограниченно): огненный снаряд [fire bolt], луч холода [ray of frost];
            1-й уровень (4 ячейки): доспехи мага [mage armor], волшебная стрела [magic missile];
            2-й уровень (3 ячейки): туманный шаг [misty step];
            3-й уровень (3 ячейки): огненный шар [fireball], молния [lightning bolt];
            4-й уровень (3 ячейки): высшая невидимость [greater invisibility];
            5-й уровень (1 ячейка): конус холода [cone of cold].
          </li>
          <li><strong>Действия</strong></li>
          <li><strong>Кинжал.</strong> Рукопашная или дальнобойная атака оружием: +5 к попаданию, досягаемость 5 фт. или дистанция 20/60 фт., одна цель. Попадание: Колющий урон 4 (1к4 + 2).</li>
        </ul>
      </div>
    `;

    const monster = parseMonsterHtml(casterHtml, { id: "mage-1", slug: "mage" });
    expect(monster.name).toBe("Маг");
    expect(monster.type).toBe("humanoid");
    expect(monster.challengeRating).toBe(6);
    expect(monster.xp).toBe(2300);

    // Spellcasting validation
    expect(monster.spellcasting).toBeDefined();
    expect(monster.spellcasting?.casterLevel).toBe(9);
    expect(monster.spellcasting?.spellSaveDC).toBe(14);
    expect(monster.spellcasting?.spellAttackBonus).toBe(6);
    expect(monster.spellcasting?.ability).toBe("INT");
    expect(monster.spellcasting?.slots?.[1]).toBe(4);
    expect(monster.spellcasting?.slots?.[3]).toBe(3);
    expect(monster.spellcasting?.slots?.[5]).toBe(1);

    // Dagger action
    const dagger = monster.actions.find((a) => a.name.includes("Кинжал"));
    expect(dagger).toBeDefined();
    expect(dagger?.attackBonus).toBe(5);
    expect(dagger?.reachFt).toBe(5);
    expect(dagger?.range?.normal).toBe(20);
    expect(dagger?.range?.long).toBe(60);
  });
});
