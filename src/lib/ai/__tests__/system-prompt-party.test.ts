import { test } from "vitest";
import assert from "node:assert/strict";
import {
  buildSystemPrompt,
  partyTiesDescriptions,
  type CampaignContext,
  type PlayerSummary,
} from "../system-prompt";

test("partyTiesDescriptions has all 4 canonical relationships", () => {
  assert.ok(partyTiesDescriptions.tight_knit);
  assert.ok(partyTiesDescriptions.strangers);
  assert.ok(partyTiesDescriptions.mercenaries);
  assert.ok(partyTiesDescriptions.friends);
});

test("buildSystemPrompt formats single player with singular address and traits", () => {
  const context: CampaignContext = {
    name: "Хроники Фандалина",
    setting: "Forgotten Realms",
    tone: "heroic",
    partyTies: "tight_knit",
    playerCharacter: "Элиас, Эльф Следопыт 1 ур.",
    partyMembers: [
      {
        name: "Элиас",
        race: "Эльф",
        class: "Следопыт",
        level: 1,
        background: "Чужеземец",
        personality: "Всегда настороже",
        appearance: "Зеленый плащ следопыта",
        bonds: "Родная роща осквернена",
        flaws: "Не доверяет городским жителям",
        notes: "Любит чай из можжевельника",
      },
    ],
  };

  const prompt = buildSystemPrompt(context);
  assert.match(prompt, /Элиас/);
  assert.match(prompt, /Чужеземец/);
  assert.match(prompt, /Всегда настороже/);
  assert.match(prompt, /Не доверяет городским жителям/);
  assert.match(prompt, /ОДНОГО игрока/);
  assert.match(prompt, /Ты видишь/);
  assert.match(prompt, /досье героев/i);
});

test("buildSystemPrompt formats multi-player party with plural address, backgrounds, and party ties", () => {
  const party: PlayerSummary[] = [
    {
      name: "Торин",
      race: "Дварф",
      class: "Воин",
      level: 2,
      background: "Солдат",
      personality: "Прямолинеен и груб",
      appearance: "Борода с серебряными кольцами",
      bonds: "Старый щит отца",
      flaws: "Вспыльчив, когда оскорбляют клан",
      notes: "Хромает на левую ногу",
    },
    {
      name: "Лира",
      race: "Полуэльф",
      class: "Плут",
      level: 2,
      background: "Беспризорник",
      personality: "Прячет эмоции за улыбкой",
      appearance: "Темный плащ с капюшоном",
      bonds: "Долг гильдии воров",
      flaws: "Не может пройти мимо блестящих безделушек",
    },
  ];

  const context: CampaignContext = {
    name: "Врата Балдура",
    setting: "Forgotten Realms",
    tone: "dark",
    partyTies: "strangers",
    partyMembers: party,
  };

  const prompt = buildSystemPrompt(context);
  assert.match(prompt, /ОТРЯДА ИЗ 2 ГЕРОЕВ/);
  assert.match(prompt, /Вы видите/);
  assert.match(prompt, /Что вы делаете|Что будете делать/);
  assert.match(prompt, /Торин/);
  assert.match(prompt, /Солдат/);
  assert.match(prompt, /Лира/);
  assert.match(prompt, /Беспризорник/);
  assert.match(prompt, /Незнакомцы/);
  assert.match(prompt, /ДИНАМИКА И ОТНОШЕНИЯ В ОТРЯДЕ/);
  assert.match(prompt, /Co-Master Worker/);
});
