// Процедурный генератор тактических карт и энкаунтеров для AI DM
import { db } from "@/lib/db";
import { abilityModifier, proficiencyBonus } from "@/lib/dnd/dice";
import { rollInitiativeForAll, sortByInitiative } from "./initiative";
import type { Attack, CombatPotion, CombatantType, CreatureSize, MapElementType, HotbarItem } from "./types";
import {
  extractAttacksFromCharacter,
  extractSpellsFromCharacter,
  extractAbilitiesFromCharacter,
} from "./character-adapter";
import { ATTACK_LIBRARY } from "./library-data";
import { generateEncounter } from "./encounters/encounter-generator";
import type {
  StoryFactionContext,
  SquadArchetype,
  EncounterDifficulty,
  PartyMember,
  GeneratedEncounter,
} from "./encounters/types";
import { resolveBattlemapForNarrative } from "./maps/open-map-service";
import { resolveMonsterCombatant } from "./monsters/bestiary-resolver";

export type EnvironmentType =
  | "dungeon"
  | "cave"
  | "tavern"
  | "forest"
  | "ruins"
  | "arena"
  | "open_field";

export interface GeneratedMapElement {
  type: MapElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: Record<string, unknown>;
}

export interface EnemyInput {
  name: string;
  monsterSlug?: string;
  hpMax?: number;
  ac?: number;
  speed?: number;
  dexMod?: number;
  strMod?: number;
  conMod?: number;
  intMod?: number;
  wisMod?: number;
  chaMod?: number;
  size?: CreatureSize;
  color?: string;
  position?: { x: number; y: number };
  attacks?: Array<{
    name: string;
    kind?: "melee" | "ranged" | "spell";
    attackBonus?: number;
    damageDice: string; // e.g. "1d6+2"
    damageType?: string;
    rangeNormal?: number;
    rangeLong?: number;
  }>;
}

export interface CreateEncounterParams {
  campaignId?: string;
  name: string;
  environment?: EnvironmentType;
  gridWidth?: number;
  gridHeight?: number;
  mapDescription?: string;
  customMapElements?: GeneratedMapElement[];
  enemies?: EnemyInput[];
  biome?: string;
  difficulty?: EncounterDifficulty;
  storyFaction?: StoryFactionContext;
  archetype?: SquadArchetype;
  isActClimax?: boolean;
  mapPresetId?: string;
}

export interface TacticalEncounterResult {
  combatId: string;
  name: string;
  environment: string;
  gridWidth: number;
  gridHeight: number;
  combatantsCount: number;
  turnOrder: string[];
  enemyNames: string[];
  awardedXP: number;
  xpPerPlayer: number;
}

/**
 * Процедурная генерация элементов карты под тип локации.
 * По умолчанию создаёт масштабную тактическую карту 50×50 клеток с высокой детализацией.
 */
export function generateTacticalMap(
  environment: EnvironmentType = "dungeon",
  width: number = 50,
  height: number = 50
): GeneratedMapElement[] {
  const elements: GeneratedMapElement[] = [];

  switch (environment) {
    case "dungeon": {
      // 1. Внешние стены по периметру
      elements.push({ type: "wall", x: 0, y: 0, width, height: 1, properties: { label: "Каменная стена" } });
      elements.push({ type: "wall", x: 0, y: height - 1, width, height: 1, properties: { label: "Каменная стена" } });
      elements.push({ type: "wall", x: 0, y: 1, width: 1, height: height - 2, properties: { label: "Каменная стена" } });
      elements.push({ type: "wall", x: width - 1, y: 1, width: 1, height: height - 2, properties: { label: "Каменная стена" } });

      // Входные железные ворота слева
      const midY = Math.floor(height / 2);
      elements.push({
        type: "door",
        x: 0,
        y: midY - 1,
        width: 1,
        height: 2,
        properties: { isOpen: true, label: "Тяжёлые железные ворота" },
      });

      // 2. Внутренние залы и перегородки
      // Центральный тронный / ритуальный зал (коридоры сверху и снизу)
      const qX1 = Math.floor(width * 0.28);
      const qX2 = Math.floor(width * 0.72);
      const qY1 = Math.floor(height * 0.28);
      const qY2 = Math.floor(height * 0.72);

      // Северные и южные внутренние стены
      elements.push({ type: "wall", x: qX1, y: 1, width: 1, height: qY1 - 4 });
      elements.push({ type: "door", x: qX1, y: qY1 - 3, width: 1, height: 2, properties: { isOpen: false, label: "Дубовая дверь" } });
      elements.push({ type: "wall", x: qX1, y: qY2 + 2, width: 1, height: height - qY2 - 3 });
      elements.push({ type: "door", x: qX1, y: qY2, width: 1, height: 2, properties: { isOpen: false, label: "Дубовая дверь" } });

      elements.push({ type: "wall", x: qX2, y: 1, width: 1, height: qY1 - 4 });
      elements.push({ type: "door", x: qX2, y: qY1 - 3, width: 1, height: 2, properties: { isOpen: false, label: "Дубовая дверь" } });
      elements.push({ type: "wall", x: qX2, y: qY2 + 2, width: 1, height: height - qY2 - 3 });
      elements.push({ type: "door", x: qX2, y: qY2, width: 1, height: 2, properties: { isOpen: false, label: "Дубовая дверь" } });

      // 3. Колоннады и массивные каменные опоры (полу-укрытия)
      const pillarRows = [Math.floor(height * 0.38), Math.floor(height * 0.62)];
      const pillarCols = [
        Math.floor(width * 0.38),
        Math.floor(width * 0.46),
        Math.floor(width * 0.54),
        Math.floor(width * 0.62),
      ];

      for (const py of pillarRows) {
        for (const px of pillarCols) {
          elements.push({
            type: "cover",
            x: px,
            y: py,
            width: 2,
            height: 2,
            properties: { coverBonus: 2, label: "Монументальная колонна (+2 КД)" },
          });
        }
      }

      // 4. Тёмный канал / ров с водой (трудная местность)
      elements.push({
        type: "difficult",
        x: Math.floor(width * 0.48),
        y: 1,
        width: 3,
        height: height - 2,
        properties: { label: "Затопленный каменный сток (трудная местность)" },
      });
      // Каменный мостик через сток в центре
      elements.push({
        type: "obstacle",
        x: Math.floor(width * 0.48),
        y: midY - 2,
        width: 1,
        height: 1,
        properties: { label: "Перила моста" },
      });
      elements.push({
        type: "obstacle",
        x: Math.floor(width * 0.48),
        y: midY + 2,
        width: 1,
        height: 1,
        properties: { label: "Перила моста" },
      });

      // 5. Саркофаги и постаменты
      elements.push({
        type: "cover",
        x: Math.floor(width * 0.8),
        y: Math.floor(height * 0.35),
        width: 3,
        height: 1,
        properties: { coverBonus: 2, label: "Каменный саркофаг" },
      });
      elements.push({
        type: "cover",
        x: Math.floor(width * 0.8),
        y: Math.floor(height * 0.65),
        width: 3,
        height: 1,
        properties: { coverBonus: 2, label: "Каменный саркофаг" },
      });
      elements.push({
        type: "obstacle",
        x: Math.floor(width * 0.78),
        y: midY - 1,
        width: 2,
        height: 2,
        properties: { label: "Осквернённый алтарь", coverBonus: 2 },
      });

      // Завалы щебня (трудная местность)
      elements.push({
        type: "difficult",
        x: Math.floor(width * 0.15),
        y: Math.floor(height * 0.2),
        width: 4,
        height: 3,
        properties: { label: "Каменные обвалы" },
      });
      elements.push({
        type: "difficult",
        x: Math.floor(width * 0.15),
        y: Math.floor(height * 0.75),
        width: 4,
        height: 3,
        properties: { label: "Каменные обвалы" },
      });
      break;
    }

    case "tavern": {
      // Периметр бревенчатых стен
      elements.push({ type: "wall", x: 0, y: 0, width, height: 1, properties: { label: "Бревенчатая стена" } });
      elements.push({ type: "wall", x: 0, y: height - 1, width, height: 1, properties: { label: "Бревенчатая стена" } });
      elements.push({ type: "wall", x: 0, y: 1, width: 1, height: height - 2, properties: { label: "Бревенчатая стена" } });
      elements.push({ type: "wall", x: width - 1, y: 1, width: 1, height: height - 2, properties: { label: "Бревенчатая стена" } });

      const midY = Math.floor(height / 2);
      // Главный вход слева
      elements.push({
        type: "door",
        x: 0,
        y: midY - 1,
        width: 1,
        height: 2,
        properties: { isOpen: true, label: "Парадные дубовые двери" },
      });

      // Задняя дверь кухни справа
      elements.push({
        type: "door",
        x: width - 1,
        y: 6,
        width: 1,
        height: 1,
        properties: { isOpen: false, label: "Служебный выход на задний двор" },
      });

      // Перегородка кухни (справа сверху)
      const kitchenX = Math.floor(width * 0.75);
      const kitchenY = Math.floor(height * 0.35);
      elements.push({ type: "wall", x: kitchenX, y: 1, width: 1, height: kitchenY - 2 });
      elements.push({ type: "door", x: kitchenX, y: kitchenY - 2, width: 1, height: 2, properties: { isOpen: true, label: "Дверь на кухню" } });
      elements.push({ type: "wall", x: kitchenX, y: kitchenY, width: width - kitchenX - 1, height: 1 });

      // Барная стойка (Г-образная)
      elements.push({
        type: "obstacle",
        x: kitchenX - 4,
        y: 4,
        width: 4,
        height: 1,
        properties: { label: "Дубовая барная стойка", coverBonus: 2 },
      });
      elements.push({
        type: "obstacle",
        x: kitchenX - 4,
        y: 5,
        width: 1,
        height: Math.floor(height * 0.28),
        properties: { label: "Дубовая барная стойка", coverBonus: 2 },
      });
      // Бочки за стойкой
      elements.push({
        type: "obstacle",
        x: kitchenX - 2,
        y: 2,
        width: 2,
        height: 2,
        properties: { label: "Бочки с элем и вином" },
      });

      // Большой камин в центре
      elements.push({
        type: "obstacle",
        x: Math.floor(width * 0.5),
        y: 1,
        width: 4,
        height: 2,
        properties: { label: "Каменный камин с пылающим очагом" },
      });

      // Сцена для бардов снизу справа
      elements.push({
        type: "cover",
        x: Math.floor(width * 0.78),
        y: Math.floor(height * 0.78),
        width: 8,
        height: 6,
        properties: { label: "Деревянный помост сцены (+укрытие)", coverBonus: 2 },
      });

      // Обеденные столы со стульями (укрытия + трудная местность)
      const tableLayout = [
        { x: Math.floor(width * 0.18), y: Math.floor(height * 0.22) },
        { x: Math.floor(width * 0.36), y: Math.floor(height * 0.22) },
        { x: Math.floor(width * 0.18), y: Math.floor(height * 0.42) },
        { x: Math.floor(width * 0.36), y: Math.floor(height * 0.42) },
        { x: Math.floor(width * 0.18), y: Math.floor(height * 0.65) },
        { x: Math.floor(width * 0.36), y: Math.floor(height * 0.65) },
        { x: Math.floor(width * 0.55), y: Math.floor(height * 0.45) },
        { x: Math.floor(width * 0.55), y: Math.floor(height * 0.68) },
      ];

      for (const t of tableLayout) {
        elements.push({
          type: "cover",
          x: t.x,
          y: t.y,
          width: 4,
          height: 2,
          properties: { coverBonus: 2, label: "Массивный дубовый стол" },
        });
        elements.push({
          type: "difficult",
          x: t.x - 1,
          y: t.y - 1,
          width: 6,
          height: 4,
          properties: { label: "Отодвинутые стулья и лавки" },
        });
      }
      break;
    }

    case "forest": {
      // 1. Извилистая река / ручей через всю карту
      const riverX = Math.floor(width * 0.48);
      elements.push({
        type: "difficult",
        x: riverX,
        y: 0,
        width: 4,
        height: height,
        properties: { label: "Бурный каменистый ручей (трудная местность)" },
      });

      // Деревянный мост через реку в центре
      elements.push({
        type: "obstacle",
        x: riverX,
        y: Math.floor(height * 0.45),
        width: 4,
        height: 1,
        properties: { label: "Перила моста" },
      });
      elements.push({
        type: "obstacle",
        x: riverX,
        y: Math.floor(height * 0.55),
        width: 4,
        height: 1,
        properties: { label: "Перила моста" },
      });

      // 2. Деревья-великаны (непроходимые препятствия с укрытием)
      const treeClusters = [
        { x: 6, y: 6 }, { x: 12, y: 8 }, { x: 8, y: 18 }, { x: 14, y: 28 }, { x: 6, y: 38 },
        { x: 18, y: 12 }, { x: 22, y: 36 }, { x: 16, y: 44 },
        { x: 34, y: 8 }, { x: 42, y: 12 }, { x: 36, y: 22 }, { x: 44, y: 28 }, { x: 38, y: 40 }, { x: 44, y: 44 },
      ];

      for (const t of treeClusters) {
        if (t.x < width - 2 && t.y < height - 2) {
          elements.push({
            type: "obstacle",
            x: t.x,
            y: t.y,
            width: 2,
            height: 2,
            properties: { label: "Вековой дуб (препятствие)" },
          });
          elements.push({
            type: "cover",
            x: t.x - 1,
            y: t.y - 1,
            width: 4,
            height: 4,
            properties: { coverBonus: 2, label: "Ствол и корни дерева (+укрытие)" },
          });
        }
      }

      // 3. Густые заросли колючего кустарника (трудная местность + полу-укрытие)
      const thickets = [
        { x: 10, y: 22, w: 6, h: 5 },
        { x: 22, y: 6, w: 8, h: 4 },
        { x: 30, y: 30, w: 7, h: 6 },
        { x: 38, y: 16, w: 5, h: 5 },
      ];
      for (const th of thickets) {
        elements.push({
          type: "difficult",
          x: th.x,
          y: th.y,
          width: th.w,
          height: th.h,
          properties: { label: "Густые заросли ежевики", coverBonus: 2 },
        });
      }

      // 4. Поваленные брёвна (укрытия)
      elements.push({
        type: "cover",
        x: Math.floor(width * 0.2),
        y: Math.floor(height * 0.52),
        width: 6,
        height: 1,
        properties: { coverBonus: 2, label: "Мшистый ствол поваленной сосны" },
      });
      elements.push({
        type: "cover",
        x: Math.floor(width * 0.68),
        y: Math.floor(height * 0.48),
        width: 6,
        height: 1,
        properties: { coverBonus: 2, label: "Поваленное дерево" },
      });

      // 5. Лесной лагерь / стоянка (костёр и палатки)
      const campX = Math.floor(width * 0.28);
      const campY = Math.floor(height * 0.72);
      elements.push({
        type: "obstacle",
        x: campX,
        y: campY,
        width: 2,
        height: 2,
        properties: { label: "Очаг лагерного костра" },
      });
      elements.push({
        type: "cover",
        x: campX - 4,
        y: campY - 2,
        width: 3,
        height: 3,
        properties: { coverBonus: 2, label: "Кожаная палатка" },
      });
      elements.push({
        type: "cover",
        x: campX + 3,
        y: campY - 1,
        width: 2,
        height: 2,
        properties: { coverBonus: 2, label: "Ящики с припасами" },
      });
      break;
    }

    case "cave": {
      // Неровные скальные стены по контуру
      for (let x = 0; x < width; x += 4) {
        elements.push({ type: "wall", x, y: 0, width: 3, height: 2 });
        elements.push({ type: "wall", x: x + 1, y: height - 2, width: 3, height: 2 });
      }
      for (let y = 0; y < height; y += 4) {
        elements.push({ type: "wall", x: 0, y, width: 2, height: 3 });
        elements.push({ type: "wall", x: width - 2, y: y + 1, width: 2, height: 3 });
      }

      // Глубокий разлом в породе (непроходимая пропасть)
      const chasmX = Math.floor(width * 0.5);
      elements.push({
        type: "obstacle",
        x: chasmX - 1,
        y: 4,
        width: 3,
        height: Math.floor(height * 0.38),
        properties: { label: "Бездонная расщелина в камне" },
      });
      elements.push({
        type: "obstacle",
        x: chasmX - 1,
        y: Math.floor(height * 0.58),
        width: 3,
        height: Math.floor(height * 0.38),
        properties: { label: "Бездонная расщелина в камне" },
      });

      // Сталагмитовые поля и валуны
      const rockPillars = [
        { x: 12, y: 12 }, { x: 18, y: 24 }, { x: 10, y: 34 },
        { x: 36, y: 14 }, { x: 40, y: 28 }, { x: 34, y: 38 },
      ];
      for (const r of rockPillars) {
        elements.push({
          type: "obstacle",
          x: r.x,
          y: r.y,
          width: 3,
          height: 3,
          properties: { label: "Гигантский сталагмит" },
        });
        elements.push({
          type: "cover",
          x: r.x - 1,
          y: r.y - 1,
          width: 5,
          height: 5,
          properties: { coverBonus: 2, label: "Каменная глыба (+укрытие)" },
        });
      }

      // Осыпи гравия и скользкие сталактиты (трудная местность)
      elements.push({
        type: "difficult",
        x: chasmX - 6,
        y: Math.floor(height * 0.4),
        width: 12,
        height: Math.floor(height * 0.2),
        properties: { label: "Скользкая каменная осыпь у моста" },
      });
      elements.push({
        type: "difficult",
        x: 8,
        y: 8,
        width: 8,
        height: 6,
        properties: { label: "Поле мелких сталагмитов" },
      });
      elements.push({
        type: "difficult",
        x: 36,
        y: 32,
        width: 8,
        height: 6,
        properties: { label: "Подземная топь" },
      });
      break;
    }

    case "ruins": {
      // Разрушенные стены замка и башни
      elements.push({ type: "cover", x: 6, y: 6, width: 10, height: 2, properties: { coverBonus: 2, label: "Обломок крепостной стены" } });
      elements.push({ type: "cover", x: 6, y: 8, width: 2, height: 8, properties: { coverBonus: 2, label: "Обломок крепостной стены" } });

      elements.push({ type: "cover", x: width - 16, y: 6, width: 10, height: 2, properties: { coverBonus: 2, label: "Обломок крепостной стены" } });
      elements.push({ type: "cover", x: width - 8, y: 8, width: 2, height: 8, properties: { coverBonus: 2, label: "Обломок крепостной стены" } });

      elements.push({ type: "cover", x: 8, y: height - 12, width: 12, height: 2, properties: { coverBonus: 2, label: "Разрушенный парапет" } });
      elements.push({ type: "cover", x: width - 20, y: height - 12, width: 12, height: 2, properties: { coverBonus: 2, label: "Разрушенный парапет" } });

      // Рухнувшая дозорная башня (в центре)
      const centerRuinsX = Math.floor(width * 0.44);
      const centerRuinsY = Math.floor(height * 0.44);
      elements.push({
        type: "obstacle",
        x: centerRuinsX,
        y: centerRuinsY,
        width: 6,
        height: 6,
        properties: { label: "Фундамент разрушенной башни" },
      });
      elements.push({
        type: "difficult",
        x: centerRuinsX - 3,
        y: centerRuinsY - 3,
        width: 12,
        height: 12,
        properties: { label: "Завалы битого камня и плюща" },
      });
      break;
    }

    case "arena": {
      // Замкнутый контур арены
      elements.push({ type: "wall", x: 0, y: 0, width, height: 1, properties: { label: "Стена амфитеатра" } });
      elements.push({ type: "wall", x: 0, y: height - 1, width, height: 1, properties: { label: "Стена амфитеатра" } });
      elements.push({ type: "wall", x: 0, y: 1, width: 1, height: height - 2, properties: { label: "Стена амфитеатра" } });
      elements.push({ type: "wall", x: width - 1, y: 1, width: 1, height: height - 2, properties: { label: "Стена амфитеатра" } });

      // 4 решётки для гладиаторов и зверей
      const midY = Math.floor(height / 2);
      const midX = Math.floor(width / 2);
      elements.push({ type: "door", x: 0, y: midY - 2, width: 1, height: 4, properties: { isOpen: true, label: "Западные врата" } });
      elements.push({ type: "door", x: width - 1, y: midY - 2, width: 1, height: 4, properties: { isOpen: true, label: "Восточные врата" } });

      // Центральный гладиаторский помост
      elements.push({
        type: "cover",
        x: midX - 4,
        y: midY - 4,
        width: 8,
        height: 8,
        properties: { coverBonus: 2, label: "Возвышенный каменный помост" },
      });

      // 4 угловые колонны
      const colDistX = Math.floor(width * 0.22);
      const colDistY = Math.floor(height * 0.22);
      const arenaPillars = [
        { x: colDistX, y: colDistY },
        { x: width - colDistX - 2, y: colDistY },
        { x: colDistX, y: height - colDistY - 2 },
        { x: width - colDistX - 2, y: height - colDistY - 2 },
      ];
      for (const ap of arenaPillars) {
        elements.push({
          type: "cover",
          x: ap.x,
          y: ap.y,
          width: 3,
          height: 3,
          properties: { coverBonus: 2, label: "Трофейная колонна (+укрытие)" },
        });
      }

      // Ямы с шипами / ловушки (трудная местность)
      elements.push({
        type: "difficult",
        x: midX - 8,
        y: midY - 2,
        width: 3,
        height: 4,
        properties: { label: "Шипастая полоса препятствий" },
      });
      elements.push({
        type: "difficult",
        x: midX + 5,
        y: midY - 2,
        width: 3,
        height: 4,
        properties: { label: "Шипастая полоса препятствий" },
      });
      break;
    }

    case "open_field":
    default: {
      // Извилистая грунтовая дорога
      const midY = Math.floor(height / 2);
      // Каменные изгороди фермеров (укрытия)
      elements.push({
        type: "cover",
        x: Math.floor(width * 0.15),
        y: midY - 6,
        width: 12,
        height: 1,
        properties: { coverBonus: 2, label: "Каменная ограда пастбища" },
      });
      elements.push({
        type: "cover",
        x: Math.floor(width * 0.55),
        y: midY + 6,
        width: 14,
        height: 1,
        properties: { coverBonus: 2, label: "Каменная ограда пастбища" },
      });

      // Перевёрнутая торговая повозка
      elements.push({
        type: "obstacle",
        x: Math.floor(width * 0.45),
        y: midY - 1,
        width: 3,
        height: 2,
        properties: { label: "Разбитая телега", coverBonus: 2 },
      });
      elements.push({
        type: "difficult",
        x: Math.floor(width * 0.43),
        y: midY - 3,
        width: 6,
        height: 6,
        properties: { label: "Рассыпанные мешки и обломки" },
      });

      // Рощица деревьев
      elements.push({
        type: "obstacle",
        x: Math.floor(width * 0.75),
        y: Math.floor(height * 0.2),
        width: 3,
        height: 3,
        properties: { label: "Группа старых вязов" },
      });
      elements.push({
        type: "difficult",
        x: Math.floor(width * 0.72),
        y: Math.floor(height * 0.18),
        width: 7,
        height: 7,
        properties: { label: "Высокая трава и кустарник" },
      });
      break;
    }
  }

  return elements;
}

/**
 * Подбирает базовую атаку из библиотеки, если у врага не указаны подробные
 */
function resolveEnemyAttacks(enemy: EnemyInput): Attack[] {
  if (enemy.attacks && enemy.attacks.length > 0) {
    return enemy.attacks.map((a, i) => {
      const match = a.damageDice.match(/^(\d*d\d+)(?:([+-])(\d+))?$/i);
      const dice = match ? match[1] : a.damageDice || "1d6";
      const mod = match && match[3] ? (match[2] === "-" ? -1 : 1) * parseInt(match[3], 10) : enemy.strMod ?? 0;
      const kind = a.kind || (a.rangeNormal && a.rangeNormal > 10 ? "ranged" : "melee");

      return {
        id: `atk_e_${i}_${Math.random().toString(36).slice(2, 6)}`,
        name: a.name || "Удар",
        attackBonus: a.attackBonus ?? ((enemy.strMod ?? 2) + 2),
        damage: [{ dice, mod, type: a.damageType || "slashing" }],
        kind,
        range: { normal: a.rangeNormal || (kind === "ranged" ? 60 : 5), long: a.rangeLong },
        actionCost: "action",
      };
    });
  }

  // Дефолтный скимитар/удар
  const libAtk = ATTACK_LIBRARY.find((a) => a.name === "Скимитар") || ATTACK_LIBRARY[0];
  return [
    {
      id: `atk_e_${Math.random().toString(36).slice(2, 6)}`,
      name: libAtk?.name || "Удар когтями",
      attackBonus: (enemy.strMod ?? 1) + 2,
      damage: [{ dice: "1d6", mod: enemy.strMod ?? 1, type: "slashing" }],
      kind: "melee",
      range: { normal: 5 },
      actionCost: "action",
    },
  ];
}

const CLASS_DEFAULT_SAVING_THROWS: Record<string, string[]> = {
  варвар: ["STR", "CON"],
  barbarian: ["STR", "CON"],
  бард: ["DEX", "CHA"],
  bard: ["DEX", "CHA"],
  жрец: ["WIS", "CHA"],
  cleric: ["WIS", "CHA"],
  друид: ["INT", "WIS"],
  druid: ["INT", "WIS"],
  воин: ["STR", "CON"],
  fighter: ["STR", "CON"],
  монах: ["STR", "DEX"],
  monk: ["STR", "DEX"],
  паладин: ["WIS", "CHA"],
  paladin: ["WIS", "CHA"],
  следопыт: ["STR", "DEX"],
  ranger: ["STR", "DEX"],
  плут: ["DEX", "INT"],
  вор: ["DEX", "INT"],
  rogue: ["DEX", "INT"],
  чародей: ["CON", "CHA"],
  sorcerer: ["CON", "CHA"],
  колдун: ["WIS", "CHA"],
  warlock: ["WIS", "CHA"],
  волшебник: ["INT", "WIS"],
  маг: ["INT", "WIS"],
  wizard: ["INT", "WIS"],
  изобретатель: ["CON", "INT"],
  artificer: ["CON", "INT"],
};

export function resolveSavingThrowProficiencies(
  className: string,
  notes?: string | null
): Record<string, boolean> {
  const result: Record<string, boolean> = {
    STR: false,
    DEX: false,
    CON: false,
    INT: false,
    WIS: false,
    CHA: false,
  };

  if (notes) {
    const match = notes.match(/Спасброски:\s*([^\n\r]+)/i);
    if (match) {
      const ruToEn: Record<string, string> = {
        СИЛ: "STR",
        ЛОВ: "DEX",
        ТЕЛ: "CON",
        ИНТ: "INT",
        МДР: "WIS",
        ХАР: "CHA",
      };
      for (const [ru, en] of Object.entries(ruToEn)) {
        if (match[1].includes(ru) || match[1].includes(en)) {
          result[en] = true;
        }
      }
      if (Object.values(result).some(Boolean)) {
        return result;
      }
    }
  }

  const lowerClass = (className || "").trim().toLowerCase();
  for (const [cls, stats] of Object.entries(CLASS_DEFAULT_SAVING_THROWS)) {
    if (lowerClass.includes(cls)) {
      for (const st of stats) {
        result[st] = true;
      }
      return result;
    }
  }

  return result;
}

export function resolveSpellDataForCombatant(
  char: { class?: string | null; level: number; spells?: string | null; notes?: string | null },
  intMod: number,
  wisMod: number,
  chaMod: number,
  profBonus: number
): string {
  const { spells } = extractSpellsFromCharacter(char, intMod, wisMod, chaMod, profBonus);
  const lowerClass = (char.class || "").trim().toLowerCase();
  const isCaster = /волшеб|маг|wizard|чародей|sorcerer|колдун|warlock|жрец|cleric|друид|druid|бард|bard|паладин|paladin|следопыт|ranger|изобретатель|artificer/i.test(lowerClass);
  if (!isCaster && (!spells.known || spells.known.length === 0) && Object.keys(spells.slots).length === 0) {
    return "{}";
  }
  return JSON.stringify(spells);
}

/**
 * Создаёт полный тактический бой из сюжетного энкаунтера
 */
export async function createTacticalEncounter({
  campaignId,
  name,
  environment = "dungeon",
  gridWidth = 50,
  gridHeight = 50,
  mapDescription,
  customMapElements,
  enemies,
  biome,
  difficulty = "medium",
  storyFaction,
  archetype,
  isActClimax,
  mapPresetId,
}: CreateEncounterParams): Promise<TacticalEncounterResult> {
  // Завершаем старые активные бои в кампании
  if (campaignId) {
    await db.combat.updateMany({
      where: { campaignId, status: "active" },
      data: { status: "ended" },
    });
  }

  // Подтягиваем персонажей игрока и спутников из кампании
  const partyCharacters = campaignId
    ? await db.character.findMany({
        where: { campaignId, isAlive: true, type: { in: ["player", "companion"] } },
        orderBy: [{ type: "asc" }, { createdAt: "asc" }],
      })
    : [];

  const partyMembers: PartyMember[] =
    partyCharacters.length > 0
      ? partyCharacters.map((c) => ({
          id: c.id,
          name: c.name,
          level: c.level || 1,
        }))
      : [
          {
            id: "default-hero",
            name: "Герой",
            level: 3,
          },
        ];

  let effectiveGridWidth = gridWidth;
  let effectiveGridHeight = gridHeight;
  let generatedEncounterResult: GeneratedEncounter | null = null;
  const effectiveBiome = biome || environment || "dungeon";

  const isAutoGenerating = !enemies || enemies.length === 0;

  if (isAutoGenerating) {
    generatedEncounterResult = await generateEncounter({
      party: partyMembers,
      difficulty,
      biome: effectiveBiome as any,
      storyFaction,
      archetype,
      isActClimax,
      mapPresetId: mapPresetId || "",
    });

    if (generatedEncounterResult.mapPreset) {
      effectiveGridWidth = generatedEncounterResult.mapPreset.gridWidth || gridWidth;
      effectiveGridHeight = generatedEncounterResult.mapPreset.gridHeight || gridHeight;
    }
  }

  // Создаём запись боя
  const combat = await db.combat.create({
    data: {
      campaignId: campaignId || null,
      name: name || generatedEncounterResult?.mapPreset?.name || "Тактический бой",
      gridWidth: effectiveGridWidth,
      gridHeight: effectiveGridHeight,
      cellSize: 40,
      backgroundUrl:
        generatedEncounterResult?.mapPreset?.backgroundUrl ||
        resolveBattlemapForNarrative(name + " " + environment).imageUrl,
      status: "active",
      round: 1,
      currentTurnIndex: 0,
      turnOrder: "[]",
      log: JSON.stringify([
        {
          id: `log_start_${Date.now()}`,
          round: 1,
          turnIndex: 0,
          actorId: "system",
          actorName: "Мастер",
          type: "system",
          text: `⚔️ Начало боя: ${name}${mapDescription ? ` (${mapDescription})` : ""}. Бросок инициативы!`,
          timestamp: Date.now(),
        },
      ]),
    },
  });

  // Генерируем элементы карты
  if (customMapElements && customMapElements.length > 0) {
    for (const el of customMapElements) {
      await db.mapElement.create({
        data: {
          combatId: combat.id,
          type: el.type,
          x: el.x,
          y: el.y,
          width: el.width || 1,
          height: el.height || 1,
          properties: JSON.stringify(el.properties || {}),
        },
      });
    }
  } else if (
    generatedEncounterResult?.mapPreset?.elements &&
    generatedEncounterResult.mapPreset.elements.length > 0
  ) {
    for (const el of generatedEncounterResult.mapPreset.elements) {
      await db.mapElement.create({
        data: {
          combatId: combat.id,
          type: el.type,
          x: el.x,
          y: el.y,
          width: el.width || 1,
          height: el.height || 1,
          properties: JSON.stringify(el.properties || {}),
        },
      });
    }
  } else {
    const generatedElements = generateTacticalMap(
      environment,
      effectiveGridWidth,
      effectiveGridHeight
    );
    for (const el of generatedElements) {
      await db.mapElement.create({
        data: {
          combatId: combat.id,
          type: el.type,
          x: el.x,
          y: el.y,
          width: el.width || 1,
          height: el.height || 1,
          properties: JSON.stringify(el.properties || {}),
        },
      });
    }
  }

  const createdCombatantIds: Array<{ id: string; dexMod: number }> = [];

  // Расставляем союзников (слева, со сдвигом от края)
  const allyStartX = Math.max(3, Math.floor(effectiveGridWidth * 0.12));
  const centerY = Math.floor(effectiveGridHeight / 2);
  let allyIndex = 0;

  for (const char of partyCharacters) {
    const dexMod = abilityModifier(char.dex);
    const strMod = abilityModifier(char.str);
    const conMod = abilityModifier(char.con);
    const intMod = abilityModifier(char.int);
    const wisMod = abilityModifier(char.wis);
    const chaMod = abilityModifier(char.cha);

    const charProfBonus = char.profBonus || proficiencyBonus(char.level);
    const abilityMods = { STR: strMod, DEX: dexMod, CON: conMod, INT: intMod, WIS: wisMod, CHA: chaMod };

    // 1. Атаки: строго из карточки персонажа (если есть — никаких навязанных рапир/секир!)
    let charAttacks: Attack[] = extractAttacksFromCharacter(char, dexMod, strMod, charProfBonus);

    // 2. Способности персонажа: из библиотечных правил по классу и уровню
    let charAbilities = extractAbilitiesFromCharacter(char, char.level, charProfBonus, abilityMods);

    // 3. Только если на карточке персонажа нет атак, используем дефолтные пресеты или классовое оружие
    if (charAttacks.length === 0) {
      if (char.name.includes("Добрун")) {
      charAttacks = [
        {
          id: `atk_p_${char.id}_axe`,
          name: "Посеребрённый топор",
          attackBonus: strMod + proficiencyBonus(char.level),
          damage: [{ dice: "1d8", mod: strMod, type: "slashing" }],
          kind: "melee",
          range: { normal: 5 },
          actionCost: "action",
        },
        {
          id: `atk_p_${char.id}_jav`,
          name: "Метательное копьё",
          attackBonus: strMod + proficiencyBonus(char.level),
          damage: [{ dice: "1d6", mod: strMod, type: "piercing" }],
          kind: "ranged",
          range: { normal: 30, long: 120 },
          actionCost: "action",
        },
      ];
      charAbilities = [
        {
          id: `abl_p_${char.id}_surge`,
          name: "Всплеск действий",
          usesMax: 1,
          usesUsed: 0,
          refresh: "short",
          parameters: {
            name: "Всплеск действий",
            type: "ability",
            actionCost: "free",
            range: { type: "self" },
            damage: [],
            selfEffects: [{ condition: "action_surge", durationRounds: 1 }],
            targeting: "self",
            description: "Получить одно дополнительное основное действие в этот ход.",
          },
        },
        {
          id: `abl_p_${char.id}_wind`,
          name: "Второе дыхание",
          usesMax: 1,
          usesUsed: 0,
          refresh: "short",
          parameters: {
            name: "Второе дыхание",
            type: "ability",
            actionCost: "bonus",
            range: { type: "self" },
            damage: [],
            selfHeal: { dice: "1d10", mod: char.level },
            targeting: "self",
            description: "Восстановить 1d10 + уровень воина хитов бонусным действием.",
          },
        },
      ];
    } else if (char.name.includes("Лира")) {
      charAttacks = [
        {
          id: `atk_p_${char.id}_rapier`,
          name: "Изящная рапира",
          attackBonus: dexMod + proficiencyBonus(char.level),
          damage: [{ dice: "1d8", mod: dexMod, type: "piercing" }],
          kind: "melee",
          range: { normal: 5 },
          actionCost: "action",
        },
        {
          id: `atk_p_${char.id}_shortbow`,
          name: "Короткий лук",
          attackBonus: dexMod + proficiencyBonus(char.level),
          damage: [{ dice: "1d6", mod: dexMod, type: "piercing" }],
          kind: "ranged",
          range: { normal: 80, long: 320 },
          actionCost: "action",
        },
      ];
      charAbilities = [
        {
          id: `abl_p_${char.id}_bardic`,
          name: "Бард. вдохновение",
          usesMax: Math.max(1, chaMod),
          usesUsed: 0,
          refresh: "long",
          parameters: {
            name: "Бард. вдохновение",
            type: "spell",
            actionCost: "bonus",
            range: { type: "ranged", value: 60 },
            damage: [],
            targeting: "ally",
            description: "Дать союзнику кость вдохновения (1к6).",
          },
        },
      ];
    } else if (char.name.includes("Найсат")) {
      charAttacks = [
        {
          id: `atk_p_${char.id}_bow`,
          name: "Длинный лук (+Стрельба)",
          attackBonus: dexMod + proficiencyBonus(char.level) + 2,
          damage: [{ dice: "1d8", mod: dexMod, type: "piercing" }],
          kind: "ranged",
          range: { normal: 150, long: 600 },
          actionCost: "action",
        },
        {
          id: `atk_p_${char.id}_sword_single`,
          name: "Удар коротким мечом",
          attackBonus: dexMod + proficiencyBonus(char.level),
          damage: [{ dice: "1d6", mod: dexMod, type: "piercing" }],
          kind: "melee",
          range: { normal: 5 },
          actionCost: "action",
        },
        {
          id: `atk_p_${char.id}_sword_offhand`,
          name: "Второй клинок (бонусное)",
          attackBonus: dexMod + proficiencyBonus(char.level),
          damage: [{ dice: "1d6", mod: 0, type: "piercing" }],
          kind: "melee",
          range: { normal: 5 },
          actionCost: "bonus",
        },
        {
          id: `atk_p_${char.id}_dual`,
          name: "Двойной взмах клинками",
          attackBonus: dexMod + proficiencyBonus(char.level),
          damage: [
            { dice: "1d6", mod: dexMod, type: "piercing" },
            { dice: "1d6", mod: 0, type: "piercing" },
          ],
          kind: "melee",
          range: { normal: 5 },
          actionCost: "action+bonus",
        },
      ];
    } else if (char.name.includes("Токсин")) {
      charAttacks = [
        {
          id: `atk_p_${char.id}_dagger_main`,
          name: "Основной клинок",
          attackBonus: dexMod + proficiencyBonus(char.level),
          damage: [{ dice: "1d6", mod: dexMod, type: "piercing" }],
          kind: "melee",
          range: { normal: 5 },
          actionCost: "action",
        },
        {
          id: `atk_p_${char.id}_dagger_offhand`,
          name: "Второй клинок (бонусное)",
          attackBonus: dexMod + proficiencyBonus(char.level),
          damage: [{ dice: "1d6", mod: 0, type: "piercing" }],
          kind: "melee",
          range: { normal: 5 },
          actionCost: "bonus",
        },
        {
          id: `atk_p_${char.id}_dual_strike`,
          name: "Двойной удар клинками",
          attackBonus: dexMod + proficiencyBonus(char.level),
          damage: [
            { dice: "1d6", mod: dexMod, type: "piercing" },
            { dice: "1d6", mod: 0, type: "piercing" },
          ],
          kind: "melee",
          range: { normal: 5 },
          actionCost: "action+bonus",
        },
        {
          id: `atk_p_${char.id}_dual_sneak`,
          name: "Двойная скрытная атака",
          attackBonus: dexMod + proficiencyBonus(char.level),
          damage: [
            { dice: "1d6", mod: dexMod, type: "piercing" },
            { dice: "1d6", mod: 0, type: "piercing" },
            { dice: "2d6", mod: 0, type: "piercing" }, // Sneak attack 2d6 at lv 3
          ],
          kind: "melee",
          range: { normal: 5 },
          actionCost: "action+bonus",
        },
        {
          id: `atk_p_${char.id}_throw`,
          name: "Бросок кинжала",
          attackBonus: dexMod + proficiencyBonus(char.level),
          damage: [{ dice: "1d4", mod: dexMod, type: "piercing" }],
          kind: "ranged",
          range: { normal: 20, long: 60 },
          actionCost: "action",
        },
      ];
      charAbilities = [
        {
          id: `abl_p_${char.id}_dash`,
          name: "Хитрое действие: Рывок",
          usesMax: 0,
          usesUsed: 0,
          refresh: "none",
          parameters: {
            name: "Хитрое действие: Рывок",
            type: "ability",
            actionCost: "bonus",
            range: { type: "self" },
            damage: [],
            selfEffects: [{ condition: "dashing", durationRounds: 1 }],
            targeting: "self",
            description: "Бонусным действием совершить Рывок (удвоение скорости).",
          },
        },
        {
          id: `abl_p_${char.id}_disengage`,
          name: "Хитрое действие: Отход",
          usesMax: 0,
          usesUsed: 0,
          refresh: "none",
          parameters: {
            name: "Хитрое действие: Отход",
            type: "ability",
            actionCost: "bonus",
            range: { type: "self" },
            damage: [],
            selfEffects: [{ condition: "disengaged", durationRounds: 1 }],
            targeting: "self",
            description: "Бонусным действием совершить Отход (движение не провоцирует атак).",
          },
        },
        {
          id: `abl_p_${char.id}_hide`,
          name: "Хитрое действие: Скрытность",
          usesMax: 0,
          usesUsed: 0,
          refresh: "none",
          parameters: {
            name: "Хитрое действие: Скрытность",
            type: "ability",
            actionCost: "bonus",
            range: { type: "self" },
            damage: [],
            selfEffects: [{ condition: "hidden", durationRounds: 1 }],
            targeting: "self",
            description: "Бонусным действием спрятаться в тенях.",
          },
        },
      ];
    } else {
      const lowerClass = (char.class || "").trim().toLowerCase();
      const prof = char.profBonus || proficiencyBonus(char.level);

      if (/волшеб|маг|wizard|чародей|sorcerer/i.test(lowerClass)) {
        const spellMod = intMod >= chaMod ? intMod : chaMod;
        charAttacks = [
          {
            id: `atk_p_${char.id}_firebolt`,
            name: "Огненный снаряд",
            attackBonus: spellMod + prof,
            damage: [{ dice: char.level >= 5 ? "2d10" : "1d10", mod: 0, type: "fire" }],
            kind: "ranged",
            range: { normal: 120 },
            actionCost: "action",
          },
          {
            id: `atk_p_${char.id}_dagger`,
            name: "Кинжал",
            attackBonus: dexMod + prof,
            damage: [{ dice: "1d4", mod: dexMod, type: "piercing" }],
            kind: "melee",
            range: { normal: 5 },
            actionCost: "action",
          },
        ];
      } else if (/колдун|warlock/i.test(lowerClass)) {
        charAttacks = [
          {
            id: `atk_p_${char.id}_eldritch_blast`,
            name: "Мистический заряд",
            attackBonus: chaMod + prof,
            damage: [{ dice: char.level >= 5 ? "2d10" : "1d10", mod: 0, type: "force" }],
            kind: "ranged",
            range: { normal: 120 },
            actionCost: "action",
          },
          {
            id: `atk_p_${char.id}_dagger`,
            name: "Кинжал",
            attackBonus: dexMod + prof,
            damage: [{ dice: "1d4", mod: dexMod, type: "piercing" }],
            kind: "melee",
            range: { normal: 5 },
            actionCost: "action",
          },
        ];
      } else if (/жрец|cleric|друид|druid/i.test(lowerClass)) {
        charAttacks = [
          {
            id: `atk_p_${char.id}_sacred_flame`,
            name: "Священное пламя",
            attackBonus: wisMod + prof,
            damage: [{ dice: char.level >= 5 ? "2d8" : "1d8", mod: 0, type: "radiant" }],
            kind: "ranged",
            range: { normal: 60 },
            actionCost: "action",
          },
          {
            id: `atk_p_${char.id}_mace`,
            name: "Булава",
            attackBonus: (strMod >= dexMod ? strMod : dexMod) + prof,
            damage: [{ dice: "1d6", mod: strMod >= dexMod ? strMod : dexMod, type: "bludgeoning" }],
            kind: "melee",
            range: { normal: 5 },
            actionCost: "action",
          },
        ];
      } else if (/паладин|paladin/i.test(lowerClass)) {
        charAttacks = [
          {
            id: `atk_p_${char.id}_longsword`,
            name: "Длинный меч",
            attackBonus: strMod + prof,
            damage: [{ dice: "1d8", mod: strMod, type: "slashing" }],
            kind: "melee",
            range: { normal: 5 },
            actionCost: "action",
          },
          {
            id: `atk_p_${char.id}_javelin`,
            name: "Дротик",
            attackBonus: strMod + prof,
            damage: [{ dice: "1d6", mod: strMod, type: "piercing" }],
            kind: "ranged",
            range: { normal: 30, long: 120 },
            actionCost: "action",
          },
        ];
        charAbilities = [
          {
            id: `abl_p_${char.id}_divine_smite`,
            name: "Божественная кара",
            usesMax: 3,
            usesUsed: 0,
            refresh: "long",
            parameters: {
              name: "Божественная кара",
              type: "ability",
              actionCost: "bonus",
              range: { type: "self" },
              damage: [{ dice: "2d8", mod: 0, type: "radiant" }],
              targeting: "self",
              description: "Нанести дополнительный урон излучением при попадании рукопашной атакой.",
            },
          },
        ];
      } else if (/плут|rogue/i.test(lowerClass)) {
        charAttacks = [
          {
            id: `atk_p_${char.id}_rapier`,
            name: "Рапира",
            attackBonus: dexMod + prof,
            damage: [{ dice: "1d8", mod: dexMod, type: "piercing" }],
            kind: "melee",
            range: { normal: 5 },
            actionCost: "action",
          },
          {
            id: `atk_p_${char.id}_shortbow`,
            name: "Короткий лук",
            attackBonus: dexMod + prof,
            damage: [{ dice: "1d6", mod: dexMod, type: "piercing" }],
            kind: "ranged",
            range: { normal: 80, long: 320 },
            actionCost: "action",
          },
        ];
        charAbilities = [
          {
            id: `abl_p_${char.id}_dash`,
            name: "Хитрое действие: Рывок",
            usesMax: 0,
            usesUsed: 0,
            refresh: "none",
            parameters: {
              name: "Хитрое действие: Рывок",
              type: "ability",
              actionCost: "bonus",
              range: { type: "self" },
              damage: [],
              selfEffects: [{ condition: "dashing", durationRounds: 1 }],
              targeting: "self",
              description: "Бонусным действием совершить Рывок.",
            },
          },
          {
            id: `abl_p_${char.id}_disengage`,
            name: "Хитрое действие: Отход",
            usesMax: 0,
            usesUsed: 0,
            refresh: "none",
            parameters: {
              name: "Хитрое действие: Отход",
              type: "ability",
              actionCost: "bonus",
              range: { type: "self" },
              damage: [],
              selfEffects: [{ condition: "disengaged", durationRounds: 1 }],
              targeting: "self",
              description: "Бонусным действием совершить Отход.",
            },
          },
        ];
      } else if (/следопыт|ranger/i.test(lowerClass)) {
        charAttacks = [
          {
            id: `atk_p_${char.id}_longbow`,
            name: "Длинный лук",
            attackBonus: dexMod + prof,
            damage: [{ dice: "1d8", mod: dexMod, type: "piercing" }],
            kind: "ranged",
            range: { normal: 150, long: 600 },
            actionCost: "action",
          },
          {
            id: `atk_p_${char.id}_shortswords`,
            name: "Короткий меч",
            attackBonus: dexMod + prof,
            damage: [{ dice: "1d6", mod: dexMod, type: "piercing" }],
            kind: "melee",
            range: { normal: 5 },
            actionCost: "action",
          },
        ];
      } else if (/варвар|barbarian/i.test(lowerClass)) {
        charAttacks = [
          {
            id: `atk_p_${char.id}_greataxe`,
            name: "Секира",
            attackBonus: strMod + prof,
            damage: [{ dice: "1d12", mod: strMod, type: "slashing" }],
            kind: "melee",
            range: { normal: 5 },
            actionCost: "action",
          },
          {
            id: `atk_p_${char.id}_javelin`,
            name: "Дротик",
            attackBonus: strMod + prof,
            damage: [{ dice: "1d6", mod: strMod, type: "piercing" }],
            kind: "ranged",
            range: { normal: 30, long: 120 },
            actionCost: "action",
          },
        ];
        charAbilities = [
          {
            id: `abl_p_${char.id}_rage`,
            name: "Ярость",
            usesMax: 2,
            usesUsed: 0,
            refresh: "long",
            parameters: {
              name: "Ярость",
              type: "ability",
              actionCost: "bonus",
              range: { type: "self" },
              damage: [],
              selfEffects: [{ condition: "raging", durationRounds: 10 }],
              targeting: "self",
              description: "Впасть в боевую ярость (+2 к урону рукопашным оружием, сопротивление дробящему, колющему и рубящему урону).",
            },
          },
        ];
      } else if (/монах|monk/i.test(lowerClass)) {
        const martialMod = dexMod >= strMod ? dexMod : strMod;
        charAttacks = [
          {
            id: `atk_p_${char.id}_unarmed`,
            name: "Безоружный удар",
            attackBonus: martialMod + prof,
            damage: [{ dice: "1d4", mod: martialMod, type: "bludgeoning" }],
            kind: "melee",
            range: { normal: 5 },
            actionCost: "action",
          },
          {
            id: `atk_p_${char.id}_quarterstaff`,
            name: "Боевой посох",
            attackBonus: martialMod + prof,
            damage: [{ dice: "1d8", mod: martialMod, type: "bludgeoning" }],
            kind: "melee",
            range: { normal: 5 },
            actionCost: "action",
          },
        ];
      } else if (/бард|bard/i.test(lowerClass)) {
        charAttacks = [
          {
            id: `atk_p_${char.id}_vicious_mockery`,
            name: "Злая насмешка",
            attackBonus: chaMod + prof,
            damage: [{ dice: char.level >= 5 ? "2d4" : "1d4", mod: 0, type: "psychic" }],
            kind: "ranged",
            range: { normal: 60 },
            actionCost: "action",
          },
          {
            id: `atk_p_${char.id}_rapier`,
            name: "Рапира",
            attackBonus: dexMod + prof,
            damage: [{ dice: "1d8", mod: dexMod, type: "piercing" }],
            kind: "melee",
            range: { normal: 5 },
            actionCost: "action",
          },
        ];
      } else {
        const useDex = dexMod > strMod;
        const mainMod = useDex ? dexMod : strMod;
        charAttacks = [
          {
            id: `atk_p_${char.id}_weapon_main`,
            name: useDex ? "Короткий меч" : "Боевой топор",
            attackBonus: mainMod + prof,
            damage: [{ dice: useDex ? "1d6" : "1d8", mod: mainMod, type: useDex ? "piercing" : "slashing" }],
            kind: "melee",
            range: { normal: 5 },
            actionCost: "action",
          },
          {
            id: `atk_p_${char.id}_weapon_ranged`,
            name: useDex ? "Короткий лук" : "Дротик",
            attackBonus: (useDex ? dexMod : strMod) + prof,
            damage: [{ dice: "1d6", mod: useDex ? dexMod : strMod, type: "piercing" }],
            kind: "ranged",
            range: { normal: useDex ? 80 : 30, long: useDex ? 320 : 120 },
            actionCost: "action",
          },
        ];
      }
    }
  }

    let posX = allyStartX + Math.floor(allyIndex / 4);
    let posY = Math.max(
      2,
      Math.min(effectiveGridHeight - 3, centerY + ((allyIndex % 4) - 1.5) * 2)
    );

    if (generatedEncounterResult?.combatants) {
      const placed =
        generatedEncounterResult.combatants.find((c) => c.id === char.id) ||
        generatedEncounterResult.combatants.find((c) => c.type === "player" && c.name === char.name);
      if (placed) {
        posX = placed.x;
        posY = placed.y;
      }
    }
    allyIndex++;

    const { spells: extractedSpells, spellHotbar } = extractSpellsFromCharacter(
      char,
      intMod,
      wisMod,
      chaMod,
      charProfBonus
    );

    const seenHotbarIds = new Set<string>();
    const hotbarItems: HotbarItem[] = [
      ...charAttacks.map((a) => ({ id: a.id, type: "attack" as const, name: a.name })),
      ...charAbilities.map((ab) => ({ id: ab.id, type: "ability" as const, name: ab.name })),
      ...spellHotbar,
    ].filter((item) => {
      if (seenHotbarIds.has(item.id)) return false;
      seenHotbarIds.add(item.id);
      return true;
    });

    // Парсим зелья из inventory персонажа
    let parsedPotions: CombatPotion[] = [];
    try {
      if (char.inventory) {
        const rawInv = typeof char.inventory === "string" ? JSON.parse(char.inventory) : char.inventory;
        if (Array.isArray(rawInv)) {
          for (let i = 0; i < rawInv.length; i++) {
            const item = rawInv[i];
            if (!item) continue;
            if (typeof item === "object") {
              const isPotion =
                item.potionType !== undefined ||
                item.category === "potion" ||
                item.type === "potion" ||
                (typeof item.type === "string" && ["heal", "buff", "utility"].includes(item.type) && item.formula) ||
                (typeof item.formula === "string" && item.formula.includes("d"));

              if (isPotion) {
                const pType: "heal" | "buff" | "utility" =
                  item.potionType === "buff" || item.type === "buff"
                    ? "buff"
                    : item.potionType === "utility" || item.type === "utility"
                    ? "utility"
                    : "heal";

                parsedPotions.push({
                  id: item.id || `potion_${char.id}_${i}`,
                  name: item.name || "Зелье",
                  nameEn: item.nameEn,
                  type: pType,
                  quantity: Math.max(1, Number(item.quantity ?? 1)),
                  formula: item.formula || (pType === "heal" ? "2d4+2" : undefined),
                  tempHp: item.tempHp !== undefined ? Number(item.tempHp) : undefined,
                  buffEffect: item.buffEffect || item.condition || item.effect,
                  description: item.description || item.name || "Зелье",
                  rarity: item.rarity,
                  actionCost: "bonus_action",
                });
              }
            }
          }
        }
      }
    } catch {
      // fallback
    }

    const combatPotions: CombatPotion[] =
      parsedPotions.length > 0
        ? parsedPotions
        : char.type === "player"
        ? [
            {
              id: "potion_heal_std",
              name: "Зелье лечения",
              nameEn: "Potion of Healing",
              type: "heal",
              quantity: 2,
              formula: "2d4+2",
              description: "Восстанавливает 2d4+2 хитов",
              actionCost: "bonus_action",
            },
          ]
        : [];

    const profSaves = resolveSavingThrowProficiencies(char.class || "", char.notes);
    const lowerClass = (char.class || "").trim().toLowerCase();
    const isCaster = /волшеб|маг|wizard|чародей|sorcerer|колдун|warlock|жрец|cleric|друид|druid|бард|bard|паладин|paladin|следопыт|ranger|изобретатель|artificer/i.test(lowerClass);
    const resolvedSpells =
      !isCaster && (!extractedSpells.known || extractedSpells.known.length === 0) && Object.keys(extractedSpells.slots).length === 0
        ? "{}"
        : JSON.stringify(extractedSpells);

    const combatant = await db.combatant.create({
      data: {
        combatId: combat.id,
        characterId: char.id,
        name: char.name,
        type: char.type as CombatantType,
        color: char.type === "player" ? "#10b981" : "#3b82f6",
        x: posX,
        y: posY,
        hpMax: char.hpMax,
        hpCurrent: char.hpCurrent,
        hpTemp: 0,
        ac: char.ac,
        speed: char.speed,
        dexMod,
        initiative: 0,
        initiativeTiebreak: Math.floor(Math.random() * 1_000_000),
        className: char.class || "",
        level: char.level,
        size: "medium",
        attacks: JSON.stringify(charAttacks),
        hotbar: JSON.stringify(hotbarItems),
        spells: resolvedSpells,
        abilities: JSON.stringify(charAbilities),
        abilityMods: JSON.stringify({ STR: strMod, DEX: dexMod, CON: conMod, INT: intMod, WIS: wisMod, CHA: chaMod }),
        saves: JSON.stringify({
          STR: { prof: !!profSaves.STR, mod: strMod + (profSaves.STR ? charProfBonus : 0) },
          DEX: { prof: !!profSaves.DEX, mod: dexMod + (profSaves.DEX ? charProfBonus : 0) },
          CON: { prof: !!profSaves.CON, mod: conMod + (profSaves.CON ? charProfBonus : 0) },
          INT: { prof: !!profSaves.INT, mod: intMod + (profSaves.INT ? charProfBonus : 0) },
          WIS: { prof: !!profSaves.WIS, mod: wisMod + (profSaves.WIS ? charProfBonus : 0) },
          CHA: { prof: !!profSaves.CHA, mod: chaMod + (profSaves.CHA ? charProfBonus : 0) },
        }),
        profBonus: charProfBonus,
        isAIControlled: false,
        potions: JSON.stringify(combatPotions),
      },
    });

    createdCombatantIds.push({ id: combatant.id, dexMod });
  }

  // Расставляем врагов
  const enemyNames: string[] = [];
  let awardedXP = 0;
  let xpPerPlayer = 0;

  if (generatedEncounterResult) {
    for (const spawn of generatedEncounterResult.enemies) {
      const c = spawn.combatant;
      if (!c) continue;
      const combatant = await db.combatant.create({
        data: {
          combatId: combat.id,
          name: c.name,
          type: "enemy",
          color: spawn.role === "boss" ? "#dc2626" : "#ef4444",
          x: c.x,
          y: c.y,
          hpMax: c.hpMax,
          hpCurrent: c.hpCurrent,
          hpTemp: 0,
          ac: c.ac,
          speed: c.speed || 30,
          dexMod: c.dexMod || 0,
          initiative: 0,
          initiativeTiebreak: Math.floor(Math.random() * 1_000_000),
          className: c.className || spawn.monster.type || "",
          level: c.level || 1,
          size: c.size || "medium",
          attacks: JSON.stringify(c.attacks || []),
          hotbar: JSON.stringify((c.attacks || []).map((a) => ({ id: a.id, type: "attack", name: a.name }))),
          spells: typeof c.spells === "string" ? c.spells : JSON.stringify(c.spells || {}),
          abilities: JSON.stringify(c.abilities || []),
          abilityMods: JSON.stringify(c.abilityMods || {}),
          saves: JSON.stringify(c.saves || {}),
          profBonus: c.profBonus || 2,
          isAIControlled: true,
        },
      });

      createdCombatantIds.push({ id: combatant.id, dexMod: c.dexMod || 0 });
      enemyNames.push(c.name);
    }

    awardedXP = generatedEncounterResult.actualXP;
    xpPerPlayer = generatedEncounterResult.xpPerPlayer;
  } else if (enemies && enemies.length > 0) {
    const enemyStartX = effectiveGridWidth - 3;
    let enemyIndex = 0;
    let totalMonstersXP = 0;

    for (const e of enemies) {
      const resolved = resolveMonsterCombatant(e);
      const c = resolved.combatantData;

      const dexMod = c.dexMod ?? 0;
      const posX = e.position?.x ?? Math.max(1, enemyStartX - (enemyIndex > 3 ? 2 : 0));
      const posY = e.position?.y ?? Math.max(1, Math.min(effectiveGridHeight - 2, centerY + (enemyIndex % 2 === 0 ? -Math.floor(enemyIndex / 2) : Math.ceil(enemyIndex / 2))));
      enemyIndex++;

      const combatant = await db.combatant.create({
        data: {
          combatId: combat.id,
          name: c.name || e.name,
          type: "enemy",
          color: c.color || e.color || "#ef4444",
          x: posX,
          y: posY,
          hpMax: c.hpMax || 11,
          hpCurrent: c.hpCurrent || c.hpMax || 11,
          hpTemp: 0,
          ac: c.ac || 10,
          speed: c.speed || 30,
          dexMod,
          initiative: 0,
          initiativeTiebreak: Math.floor(Math.random() * 1_000_000),
          className: c.className || "враг",
          level: c.level || 1,
          size: c.size || "medium",
          attacks: JSON.stringify(c.attacks || []),
          hotbar: JSON.stringify(c.hotbar || []),
          spells: JSON.stringify(c.spells || {}),
          abilities: JSON.stringify(c.abilities || []),
          abilityMods: JSON.stringify(c.abilityMods || { STR: 0, DEX: dexMod, CON: 0, INT: 0, WIS: 0, CHA: 0 }),
          saves: JSON.stringify(c.saves || {}),
          profBonus: c.profBonus || 2,
          isAIControlled: true,
        },
      });

      createdCombatantIds.push({ id: combatant.id, dexMod });
      enemyNames.push(c.name || e.name);
      totalMonstersXP += resolved.xp;
    }

    awardedXP = totalMonstersXP;
    xpPerPlayer = Math.floor(awardedXP / Math.max(1, partyCharacters.length || 1));
  }

  // Бросаем инициативу для всех участников
  const initRolls = rollInitiativeForAll(createdCombatantIds);
  for (const roll of initRolls) {
    await db.combatant.update({
      where: { id: roll.id },
      data: { initiative: roll.initiative, initiativeTiebreak: roll.tiebreak },
    });
  }

  // Загружаем всех созданных бойцов и фиксируем порядок ходов
  const allCombatants = await db.combatant.findMany({ where: { combatId: combat.id } });
  const sorted = sortByInitiative(
    allCombatants.map((c) => ({
      id: c.id,
      initiative: c.initiative,
      dexMod: c.dexMod,
      initiativeTiebreak: c.initiativeTiebreak,
    }))
  );
  const turnOrder = sorted.map((c) => c.id);

  await db.combat.update({
    where: { id: combat.id },
    data: { turnOrder: JSON.stringify(turnOrder) },
  });

  return {
    combatId: combat.id,
    name: combat.name,
    environment: effectiveBiome,
    gridWidth: effectiveGridWidth,
    gridHeight: effectiveGridHeight,
    combatantsCount: allCombatants.length,
    turnOrder,
    enemyNames,
    awardedXP,
    xpPerPlayer,
  };
}
