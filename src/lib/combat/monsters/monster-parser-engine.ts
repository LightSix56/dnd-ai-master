import * as cheerio from "cheerio";
import type {
  CreatureSize,
  CreatureType,
  MonsterAction,
  MonsterDamageComponent,
  MonsterDefinition,
  MonsterLegendaryActions,
  MonsterSpeed,
  MonsterSpellcasting,
  MonsterTrait,
} from "./types";

interface ParseMeta {
  id?: string;
  slug?: string;
  source?: string;
  isNamed?: boolean;
}

const SKILL_MAP: Record<string, string> = {
  восприятие: "perception",
  скрытность: "stealth",
  атлетика: "athletics",
  акробатика: "acrobatics",
  магия: "arcana",
  история: "history",
  проницательность: "insight",
  запугивание: "intimidation",
  расследование: "investigation",
  медицина: "medicine",
  природа: "nature",
  выживание: "survival",
  обман: "deception",
  выступление: "performance",
  убеждение: "persuasion",
  дрессировка: "animal_handling",
  ловкость_рук: "sleight_of_hand",
  религия: "religion",
};

const DAMAGE_TYPE_MAP: Record<string, string> = {
  дробящий: "bludgeoning",
  колющий: "piercing",
  рубящий: "slashing",
  огонь: "fire",
  холод: "cold",
  молния: "lightning",
  звук: "thunder",
  кислота: "acid",
  яд: "poison",
  некротическая: "necrotic",
  излучение: "radiant",
  силовое: "force",
  психическая: "psychic",
};

function normalizeDamageType(word: string): string {
  const w = (word || "").toLowerCase().trim();
  if (w.includes("дробящ")) return "bludgeoning";
  if (w.includes("колющ")) return "piercing";
  if (w.includes("рубящ")) return "slashing";
  if (w.includes("огон") || w.includes("огн")) return "fire";
  if (w.includes("холод")) return "cold";
  if (w.includes("молни") || w.includes("электр")) return "lightning";
  if (w.includes("звук") || w.includes("гром")) return "thunder";
  if (w.includes("кислот")) return "acid";
  if (w.includes("яд")) return "poison";
  if (w.includes("некрот")) return "necrotic";
  if (w.includes("излуч") || w.includes("свет")) return "radiant";
  if (w.includes("силов")) return "force";
  if (w.includes("псих")) return "psychic";
  return DAMAGE_TYPE_MAP[w] || w || "slashing";
}

function parseSize(text: string): CreatureSize {
  const l = text.toLowerCase();
  if (l.includes("крошечн") || l.includes("tiny")) return "tiny";
  if (l.includes("маленьк") || l.includes("небольш") || l.includes("small")) return "small";
  if (l.includes("средн") || l.includes("medium")) return "medium";
  if (l.includes("больш") || l.includes("крупн") || l.includes("large")) return "large";
  if (l.includes("огромн") || l.includes("huge")) return "huge";
  if (l.includes("громадищ") || l.includes("исполин") || l.includes("колоссальн") || l.includes("gargantuan")) {
    return "gargantuan";
  }
  return "medium";
}

function parseType(text: string): CreatureType {
  const l = text.toLowerCase();
  if (l.includes("аберраци")) return "aberration";
  if (l.includes("звер")) return "beast";
  if (l.includes("небожител")) return "celestial";
  if (l.includes("конструкт")) return "construct";
  if (l.includes("дракон")) return "dragon";
  if (l.includes("элементал")) return "elemental";
  if (l.includes("фея") || l.includes("феи")) return "fey";
  if (l.includes("исчади")) return "fiend";
  if (l.includes("великан")) return "giant";
  if (l.includes("гуманоид")) return "humanoid";
  if (l.includes("монстр") || l.includes("чудовищ")) return "monstrosity";
  if (l.includes("слиз")) return "ooze";
  if (l.includes("растени")) return "plant";
  if (l.includes("нежит")) return "undead";
  return "humanoid";
}

function parseSpeed(text: string): MonsterSpeed {
  const speed: MonsterSpeed = { walk: 30 };
  const walkMatch = text.match(/(\d+)\s*(?:фт|фут[а-я]*)/i);
  if (walkMatch) speed.walk = parseInt(walkMatch[1], 10);

  const flyMatch = text.match(/(?:лета[яет]|полет|полёта)\s*(\d+)\s*(?:фт|фут[а-я]*)/i);
  if (flyMatch) {
    speed.fly = parseInt(flyMatch[1], 10);
    if (text.includes("парит")) speed.hover = true;
  }

  const swimMatch = text.match(/(?:плава[яет]|плавание)\s*(\d+)\s*(?:фт|фут[а-я]*)/i);
  if (swimMatch) speed.swim = parseInt(swimMatch[1], 10);

  const burrowMatch = text.match(/(?:копа[яет]|рыть[её]|копания)\s*(\d+)\s*(?:фт|фут[а-я]*)/i);
  if (burrowMatch) speed.burrow = parseInt(burrowMatch[1], 10);

  const climbMatch = text.match(/(?:лаза[яет]|лазание)\s*(\d+)\s*(?:фт|фут[а-я]*)/i);
  if (climbMatch) speed.climb = parseInt(climbMatch[1], 10);

  return speed;
}

function parseAbilities(text: string) {
  const result = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const strM = text.match(/Сил\s*(\d+)/i);
  const dexM = text.match(/Лов\s*(\d+)/i);
  const conM = text.match(/Тел\s*(\d+)/i);
  const intM = text.match(/Инт\s*(\d+)/i);
  const wisM = text.match(/Мдр\s*(\d+)/i);
  const chaM = text.match(/Хар\s*(\d+)/i);

  if (strM) result.str = parseInt(strM[1], 10);
  if (dexM) result.dex = parseInt(dexM[1], 10);
  if (conM) result.con = parseInt(conM[1], 10);
  if (intM) result.int = parseInt(intM[1], 10);
  if (wisM) result.wis = parseInt(wisM[1], 10);
  if (chaM) result.cha = parseInt(chaM[1], 10);

  return result;
}

function parseSavingThrows(text: string) {
  const saves: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>> = {};
  const regex = /(Сил|Лов|Тел|Инт|Мдр|Хар)\s*([+-]\d+)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1].toLowerCase();
    const val = parseInt(match[2], 10);
    if (key.startsWith("сил")) saves.str = val;
    else if (key.startsWith("лов")) saves.dex = val;
    else if (key.startsWith("тел")) saves.con = val;
    else if (key.startsWith("инт")) saves.int = val;
    else if (key.startsWith("мдр")) saves.wis = val;
    else if (key.startsWith("хар")) saves.cha = val;
  }
  return saves;
}

function parseSkills(text: string) {
  const skills: Record<string, number> = {};
  const clean = text.replace(/^Навыки\s*/i, "").trim();
  const parts = clean.split(",");
  for (const part of parts) {
    const m = part.trim().match(/([А-Яа-яЁё\s]+)\s*([+-]\d+)/);
    if (m) {
      const name = m[1].trim().toLowerCase().replace(/\s+/g, "_");
      const key = SKILL_MAP[name] || name;
      skills[key] = parseInt(m[2], 10);
    }
  }
  return skills;
}

function parseCR(text: string): { cr: number; xp: number } {
  const crMatch = text.match(/Опасность\s*(\d+(?:\/\d+)?)/i);
  let cr = 0;
  if (crMatch) {
    const raw = crMatch[1];
    if (raw.includes("/")) {
      const [num, den] = raw.split("/").map(Number);
      cr = num / den;
    } else {
      cr = parseFloat(raw);
    }
  }

  let xp = 0;
  const xpMatch = text.match(/\(([\d\s]+)\s*опыта\)/i);
  if (xpMatch) {
    xp = parseInt(xpMatch[1].replace(/\s+/g, ""), 10);
  }

  return { cr, xp };
}

function parseDamageTypes(text: string): string[] {
  const result: string[] = [];
  const lower = text.toLowerCase();
  for (const [ru, en] of Object.entries(DAMAGE_TYPE_MAP)) {
    if (lower.includes(ru)) {
      result.push(en);
    }
  }
  return result;
}

function parseSenses(text: string) {
  const senses: {
    blindsight?: number;
    darkvision?: number;
    tremorsense?: number;
    truesight?: number;
    passivePerception: number;
  } = { passivePerception: 10 };

  const blind = text.match(/слепое зрение\??\s*(\d+)\s*(?:фт|фут[а-я]*)/i);
  if (blind) senses.blindsight = parseInt(blind[1], 10);

  const dark = text.match(/т[её]мное зрение\??\s*(\d+)\s*(?:фт|фут[а-я]*)/i);
  if (dark) senses.darkvision = parseInt(dark[1], 10);

  const tremor = text.match(/чувство вибрации\??\s*(\d+)\s*(?:фт|фут[а-я]*)/i);
  if (tremor) senses.tremorsense = parseInt(tremor[1], 10);

  const trueSight = text.match(/истинное зрение\??\s*(\d+)\s*(?:фт|фут[а-я]*)/i);
  if (trueSight) senses.truesight = parseInt(trueSight[1], 10);

  const pass = text.match(/пассивное Восприятие\s*(\d+)/i);
  if (pass) senses.passivePerception = parseInt(pass[1], 10);

  return senses;
}

function parseAction(
  name: string,
  description: string,
  inheritedRecharge?: MonsterAction["recharge"]
): MonsterAction {
  const lowerDesc = description.toLowerCase();
  const lowerName = name.toLowerCase();

  let type: MonsterAction["type"] = "special";
  if (lowerName.includes("мультиатака") || lowerDesc.includes("совершает три атаки") || lowerDesc.includes("совершает две атаки")) {
    type = "multiattack";
  } else if (lowerDesc.includes("рукопашная атака") || lowerDesc.includes("рукопашная или дальнобойная")) {
    type = "melee_attack";
  } else if (lowerDesc.includes("дальнобойная атака")) {
    type = "ranged_attack";
  } else if (lowerName.includes("дыхание") || lowerDesc.includes("выдыхает")) {
    type = "breath";
  }

  const action: MonsterAction = {
    name,
    type,
    description,
  };

  // Бонус к атаке
  const atkM = description.match(/([+-]\d+)\s*к попаданию/i);
  if (atkM) {
    action.attackBonus = parseInt(atkM[1], 10);
  }

  // Досягаемость
  const reachM = description.match(/досягаемость\s*(\d+)\s*(?:фт|фут[а-я]*)/i);
  if (reachM) {
    action.reachFt = parseInt(reachM[1], 10);
  }

  // Дистанция
  const distM = description.match(/дистанция\s*(\d+)(?:\/(\d+))?\s*(?:фт|фут[а-я]*)/i);
  if (distM) {
    action.range = {
      normal: parseInt(distM[1], 10),
      long: distM[2] ? parseInt(distM[2], 10) : undefined,
    };
  }

  // Урон:
  // Формат 1: "19 (2к10 + 8) колющего урона"
  // Формат 2: "Колющий урон 4 (1к4 + 2)"
  const dmgM1 = description.match(/(\d+)\s*\(((\d+)[кkd](\d+)(?:\s*([+-])\s*(\d+))?)\)\s*([А-Яа-яЁё]+)?\s*урон/i);
  const dmgM2 = description.match(/([А-Яа-яЁё]+)?\s*урон\s*(\d+)\s*\(((\d+)[кkd](\d+)(?:\s*([+-])\s*(\d+))?)\)/i);

  const chosenMatch = dmgM1 || dmgM2;
  if (chosenMatch) {
    let dice = "";
    let mod = 0;
    let typeRu = "";

    if (dmgM1) {
      dice = `${dmgM1[3]}d${dmgM1[4]}`;
      if (dmgM1[5] && dmgM1[6]) {
        mod = parseInt(dmgM1[5] + dmgM1[6], 10);
      }
      typeRu = dmgM1[7] || "";
    } else if (dmgM2) {
      dice = `${dmgM2[4]}d${dmgM2[5]}`;
      if (dmgM2[6] && dmgM2[7]) {
        mod = parseInt(dmgM2[6] + dmgM2[7], 10);
      }
      typeRu = dmgM2[1] || "";
    }

    const typeEn = normalizeDamageType(typeRu);
    action.damage = [{ dice, mod, type: typeEn }];
  }

  // Перезарядка
  if (lowerName.includes("перезарядка 5–6") || lowerName.includes("перезарядка 5-6") || lowerDesc.includes("перезарядка 5–6") || lowerDesc.includes("перезарядка 5-6")) {
    action.recharge = "5-6";
  } else if (lowerName.includes("перезарядка 6") || lowerDesc.includes("перезарядка 6")) {
    action.recharge = "6";
  } else if (inheritedRecharge) {
    action.recharge = inheritedRecharge;
  }

  // AoE
  const aoeM = description.match(/(\d+)-футовым\s*(конусом|линией|сферой|кубом)/i);
  if (aoeM) {
    const sizeFt = parseInt(aoeM[1], 10);
    const shapeWord = aoeM[2].toLowerCase();
    const shape = shapeWord.includes("конус") ? "cone" : shapeWord.includes("лин") ? "line" : shapeWord.includes("сфер") ? "sphere" : "cube";
    action.aoe = { shape, sizeFt };
  }

  // Спасбросок
  const saveM = description.match(/спасбросок\s*(Силы|Ловкости|Телосложения|Интеллекта|Мудрости|Харизмы)\s*Сл\s*(\d+)/i) ||
                description.match(/преуспеть в спасброске\s*(Силы|Ловкости|Телосложения|Интеллекта|Мудрости|Харизмы)\s*Сл\s*(\d+)/i);
  if (saveM) {
    const abWord = saveM[1].toLowerCase();
    const ability = abWord.startsWith("сил") ? "STR" :
                    abWord.startsWith("лов") ? "DEX" :
                    abWord.startsWith("тел") ? "CON" :
                    abWord.startsWith("инт") ? "INT" :
                    abWord.startsWith("мдр") ? "WIS" : "CHA";
    const dc = parseInt(saveM[2], 10);
    const halfOnSuccess = lowerDesc.includes("половину этого урона") || lowerDesc.includes("половину урона");
    action.save = { ability, dc, halfOnSuccess };
  }

  return action;
}

function parseSpellcasting(text: string): MonsterSpellcasting | null {
  if (!text.toLowerCase().includes("заклинател") && !text.toLowerCase().includes("заклинаний")) {
    return null;
  }

  const spellcasting: MonsterSpellcasting = {
    slots: {},
    spellsByLevel: {},
  };

  const lvlM = text.match(/заклинателем\s*(\d+)[-–—]?(?:го|ьего)?\s*уровня/i);
  if (lvlM) spellcasting.casterLevel = parseInt(lvlM[1], 10);

  const dcM = text.match(/Сл спасброска\s*(\d+)/i);
  if (dcM) spellcasting.spellSaveDC = parseInt(dcM[1], 10);

  const atkM = text.match(/([+-]\d+)\s*к попаданию атаками заклинаниями/i);
  if (atkM) spellcasting.spellAttackBonus = parseInt(atkM[1], 10);

  if (text.includes("Интеллект")) spellcasting.ability = "INT";
  else if (text.includes("Мудрость")) spellcasting.ability = "WIS";
  else if (text.includes("Харизма")) spellcasting.ability = "CHA";

  // Заговоры
  const cantripMatch = text.match(/Заговоры\s*\([^)]+\):\s*([^;\n]+)/i);
  if (cantripMatch) {
    spellcasting.spellsByLevel![0] = cantripMatch[1].split(",").map((s) => s.trim());
  }

  // Разбор ячеек: "1-й уровень (4 ячейки): ..."
  const slotRegex = /(\d+)[-–—]й уровень\s*\((?:(\d+)\s*яче[а-яё]+)\):\s*([^;\n\.]+)/gi;
  let sMatch;
  while ((sMatch = slotRegex.exec(text)) !== null) {
    const lvl = parseInt(sMatch[1], 10);
    const count = parseInt(sMatch[2], 10);
    const spells = sMatch[3].split(",").map((s) => s.trim());
    spellcasting.slots![lvl] = count;
    spellcasting.spellsByLevel![lvl] = spells;
  }

  return spellcasting;
}

/**
 * Чистая функция парсинга HTML карточки монстра в типизированный MonsterDefinition
 */
export function parseMonsterHtml(html: string, meta: ParseMeta = {}): MonsterDefinition {
  const $ = cheerio.load(html);

  // Заголовки
  let titleRu =
    $(".card-title [data-copy]").text().trim() ||
    $(".card-title").clone().children().remove().end().text().trim() ||
    $("h2.card-title").text().trim() ||
    $("h1.header-page_title").text().trim() ||
    "Безымянный монстр";

  let titleEn =
    $(".card-title-en").text().trim() ||
    $(".card-title small").text().trim() ||
    "";

  // Если в заголовке есть "Имя [Name In English]"
  const bracketMatch = titleRu.match(/^(.*?)\s*\[(.*?)\]$/);
  if (bracketMatch) {
    titleRu = bracketMatch[1].trim();
    if (!titleEn) titleEn = bracketMatch[2].trim();
  }
  if (!titleEn) titleEn = titleRu;

  // Извлекаем все элементы li параметров внутри карточки
  const paramItems: string[] = [];
  $("ul.params.card__article-body > li:not(.subsection)").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) paramItems.push(t);
  });

  // Если специфической разметки params нет, берем все li
  if (paramItems.length === 0) {
    $("li").each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t) paramItems.push(t);
    });
  }

  // Строка 1: размер, тип, подтип, мировоззрение
  const sizeTypeEl = $(".size-type-alignment");
  let subLine = sizeTypeEl.length > 0 ? sizeTypeEl.text().replace(/\s+/g, " ").trim() : "";
  if (!subLine) {
    subLine = paramItems.find((i) => {
      const l = i.toLowerCase();
      return (
        l.includes("гуманоид") ||
        l.includes("зверь") ||
        l.includes("дракон") ||
        l.includes("нежить") ||
        l.includes("исчадие") ||
        l.includes("великан") ||
        l.includes("чудовищ") ||
        l.includes("аберраци") ||
        l.includes("элементал")
      );
    }) || paramItems[1] || "";
  }

  const sizeTooltip = $("[tooltip-for^='size.']").attr("tooltip-for");
  const size = (sizeTooltip ? sizeTooltip.replace("size.", "") as CreatureSize : null) || parseSize(subLine);
  const type = parseType(subLine);
  const subMatch = subLine.match(/\((.*?)\)/);
  const subtype = subMatch ? subMatch[1] : null;
  const alignParts = subLine.split(",");
  const alignment = alignParts.length > 1 ? alignParts.slice(1).join(",").trim() : "без мировоззрения";

  // AC
  const acLine = paramItems.find((i) => i.includes("Класс Доспеха")) || "";
  const acM = acLine.match(/Класс Доспеха\s*(\d+)(?:\s*\((.*?)\))?/i);
  const armorClass = {
    value: acM ? parseInt(acM[1], 10) : 10,
    type: acM?.[2] || undefined,
  };

  // HP
  const hpLine = paramItems.find((i) => i.includes("Хиты")) || "";
  const hpM = hpLine.match(/Хиты\s*(\d+)(?:\s*\((.*?)\))?/i);
  const hitPoints = {
    average: hpM ? parseInt(hpM[1], 10) : 10,
    hitDice: hpM?.[2]?.replace(/к/g, "d") || "1d8",
  };

  // Speed
  const speedLine = paramItems.find((i) => i.includes("Скорость")) || "";
  const speed = parseSpeed(speedLine);

  // Abilities
  const abLine = paramItems.find((i) => i.includes("Сил") && i.includes("Лов") && i.includes("Тел")) || "";
  const abilities = parseAbilities(abLine);

  // Saves & Skills
  const saveLine = paramItems.find((i) => i.startsWith("Спасброски")) || "";
  const savingThrows = parseSavingThrows(saveLine);

  const skillLine = paramItems.find((i) => i.startsWith("Навыки")) || "";
  const skills = parseSkills(skillLine);

  // Immunities & Resistances
  const resLine = paramItems.find((i) => i.startsWith("Сопротивление к урону")) || "";
  const damageResistances = parseDamageTypes(resLine);

  const immLine = paramItems.find((i) => i.startsWith("Иммунитет к урону")) || "";
  const damageImmunities = parseDamageTypes(immLine);

  const vulLine = paramItems.find((i) => i.startsWith("Уязвимость к урону")) || "";
  const damageVulnerabilities = parseDamageTypes(vulLine);

  const condImmLine = paramItems.find((i) => i.startsWith("Иммунитет к состояниям")) || "";
  const conditionImmunities = condImmLine ? condImmLine.replace("Иммунитет к состояниям", "").split(",").map((s) => s.trim()) : [];

  // Senses & Languages
  const senseLine = paramItems.find((i) => i.startsWith("Чувства")) || "";
  const senses = parseSenses(senseLine);

  const langLine = paramItems.find((i) => i.startsWith("Языки")) || "";
  const languages = langLine ? langLine.replace("Языки", "").split(",").map((s) => s.trim()) : [];

  // CR & XP
  const crLine = paramItems.find((i) => i.startsWith("Опасность")) || "";
  const { cr, xp } = parseCR(crLine);

  // Источник
  let source = meta.source || $(".source-plaque").attr("title") || "Monster Manual";
  const sourceLine = paramItems.find((i) => i.includes("Источник:"));
  if (sourceLine) {
    const sMatch = sourceLine.match(/Источник:\s*«(.*?)»/);
    if (sMatch) source = sMatch[1];
  }

  // Особенности, Действия, Легендарные действия
  const traits: MonsterTrait[] = [];
  const actions: MonsterAction[] = [];
  const reactions: MonsterAction[] = [];
  let legendaryActions: MonsterLegendaryActions | null = null;
  let spellcasting: MonsterSpellcasting | null = null;

  const subsections = $("li.subsection.desc");
  if (subsections.length > 0) {
    // Реальная верстка карточки dnd.su
    subsections.each((_, subEl) => {
      const title = $(subEl).find(".subsection-title").text().trim();
      const contentDiv = $(subEl).children("div");

      // Пропускаем Логово, Опционально и Описание
      if (title.startsWith("Логово") || title.startsWith("Действия логова") || title.startsWith("Местные эффекты") || title.startsWith("Описание") || $(subEl).find(".additionalInfo").length > 0) {
        return;
      }

      if (!title) {
        // Черты (Traits)
        contentDiv.find("p").each((_, p) => {
          const pText = $(p).text().replace(/\s+/g, " ").trim();
          if (!pText) return;
          const strongName = $(p).find("strong, em").first().text().replace(/\s+/g, " ").trim();
          const cleanName = strongName.replace(/[\.:]$/, "").trim();
          const name = cleanName || pText.slice(0, 40).trim();
          const desc = pText.slice(name.length).replace(/^[.\s:]+/, "").trim();

          if (name.includes("заклинаний") || desc.includes("заклинаний") || name.includes("колдовство")) {
            spellcasting = parseSpellcasting(pText);
          }
          traits.push({ name, description: desc });
        });
      } else if (title === "Действия") {
        // Действия (Actions)
        contentDiv.children().each((_, child) => {
          const tag = (child as any).tagName ? (child as any).tagName.toLowerCase() : "";
          if (tag === "p") {
            const pText = $(child).text().replace(/\s+/g, " ").trim();
            if (!pText) return;
            const rawStrong = $(child).find("strong").first().text() || $(child).find("em").first().text() || "";
            const strongName = rawStrong.replace(/\s+/g, " ").trim();
            let cleanName = strongName;
            if (cleanName.includes(".")) {
              cleanName = cleanName.split(".")[0].trim();
            }
            cleanName = cleanName.replace(/[\.:]$/, "").trim();
            const name = cleanName || pText.slice(0, 40).trim();
            const desc = pText.slice(name.length).replace(/^[.\s:]+/, "").trim();

            // Проверяем, есть ли перезарядка в названии родительского блока
            let inheritedRecharge: MonsterAction["recharge"];
            if (name.includes("перезарядка 5–6") || name.includes("перезарядка 5-6")) inheritedRecharge = "5-6";
            else if (name.includes("перезарядка 6")) inheritedRecharge = "6";

            actions.push(parseAction(name, desc, inheritedRecharge));
          } else if (tag === "ul") {
            // Подсписок действий (например, виды дыхания)
            // Ищем перезарядку у предыдущего действия, если есть
            const prevAction = actions[actions.length - 1];
            const parentRecharge = prevAction?.recharge;

            $(child).find("li").each((_, subLi) => {
              const liText = $(subLi).text().replace(/\s+/g, " ").trim();
              if (!liText) return;
              const strongName = $(subLi).find("strong, em").first().text().replace(/\s+/g, " ").trim();
              const cleanName = strongName.replace(/[\.:]$/, "").trim();
              const name = cleanName || liText.slice(0, 40).trim();
              const desc = liText.slice(name.length).replace(/^[.\s:]+/, "").trim();

              actions.push(parseAction(name, desc, parentRecharge));
            });
          }
        });
      } else if (title === "Реакции") {
        contentDiv.find("p").each((_, p) => {
          const pText = $(p).text().replace(/\s+/g, " ").trim();
          if (!pText) return;
          const strongName = $(p).find("strong, em").first().text().replace(/\s+/g, " ").trim();
          const cleanName = strongName.replace(/[\.:]$/, "").trim();
          const name = cleanName || pText.slice(0, 40).trim();
          const desc = pText.slice(name.length).replace(/^[.\s:]+/, "").trim();

          reactions.push(parseAction(name, desc));
        });
      } else if (title === "Легендарные действия") {
        legendaryActions = {
          actionsPerRound: 3,
          options: [],
        };
        const paragraphs = contentDiv.find("p");
        paragraphs.each((idx, p) => {
          const pText = $(p).text().replace(/\s+/g, " ").trim();
          if (!pText) return;
          if (idx === 0 && pText.includes("легендарн")) {
            const m = pText.match(/(\d+)\s*легендарн/i);
            if (m) legendaryActions!.actionsPerRound = parseInt(m[1], 10);
            return;
          }
          const strongName = $(p).find("strong, em").first().text().replace(/\s+/g, " ").trim();
          const cleanName = strongName.replace(/[\.:]$/, "").trim();
          const name = cleanName || pText.slice(0, 40).trim();
          const desc = pText.slice(name.length).replace(/^[.\s:]+/, "").trim();

          const costMatch = name.match(/стоит (\d+) действия/i);
          const cost = costMatch ? parseInt(costMatch[1], 10) : 1;
          legendaryActions!.options.push({ name, cost, description: desc });
        });
      }
    });
  } else {
    // Упрощенная плоская разметка li (как в синтетических тестах)
    let section: "traits" | "actions" | "reactions" | "legendary" = "traits";

    for (const item of paramItems) {
      if (
        item === "Распечатать" ||
        item === subLine ||
        item === acLine ||
        item === hpLine ||
        item === speedLine ||
        item === abLine ||
        item === saveLine ||
        item === skillLine ||
        item === resLine ||
        item === immLine ||
        item === vulLine ||
        item === condImmLine ||
        item === senseLine ||
        item === langLine ||
        item === crLine ||
        item.startsWith("Источник:")
      ) {
        continue;
      }

      if (item === "Действия") {
        section = "actions";
        continue;
      }
      if (item === "Реакции") {
        section = "reactions";
        continue;
      }
      if (item.startsWith("Легендарные действия")) {
        section = "legendary";
        legendaryActions = { actionsPerRound: 3, options: [] };
        continue;
      }

      // Проверка спеллкастинга
      if (item.includes("Использование заклинаний") || item.includes("Врождённое колдовство")) {
        spellcasting = parseSpellcasting(item);
      }

      const dotIdx = item.indexOf(".");
      const name = dotIdx > 0 ? item.slice(0, dotIdx).trim() : item.slice(0, 40).trim();
      const desc = dotIdx > 0 ? item.slice(dotIdx + 1).trim() : item;

      if (section === "traits") {
        traits.push({ name, description: desc });
      } else if (section === "actions") {
        actions.push(parseAction(name, desc));
      } else if (section === "reactions") {
        reactions.push(parseAction(name, desc));
      } else if (section === "legendary" && legendaryActions) {
        const costMatch = name.match(/стоит (\d+) действия/i);
        const cost = costMatch ? parseInt(costMatch[1], 10) : 1;
        legendaryActions.options.push({ name, cost, description: desc });
      }
    }
  }

  const id = meta.id || meta.slug || titleEn.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const slug = meta.slug || id;

  return {
    id,
    slug,
    name: titleRu,
    nameEn: titleEn,
    size,
    type,
    subtype,
    alignment,
    challengeRating: cr,
    xp,
    source,
    isNamed: meta.isNamed || false,
    armorClass,
    hitPoints,
    speed,
    abilities,
    savingThrows,
    skills,
    damageResistances,
    damageImmunities,
    damageVulnerabilities,
    conditionImmunities,
    senses,
    languages,
    traits,
    actions,
    reactions,
    legendaryActions,
    lairActions: [],
    spellcasting,
  };
}
