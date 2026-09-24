import { test } from "vitest";
import assert from "node:assert/strict";
import {
  extractJson,
  sceneUpdateSchema,
  applyStatusToNotes,
  extractStatusFromNotes,
} from "./scene-synchronizer";

test("extractJson strips markdown fences and extracts JSON", () => {
  const input = "```json\n{\"currentLocation\": \"Подвал\", \"updates\": []}\n```";
  assert.equal(extractJson(input), "{\"currentLocation\": \"Подвал\", \"updates\": []}");

  const raw = "Текст до {\"currentLocation\": \"Таверна\", \"updates\": []} текст после";
  assert.equal(extractJson(raw), "{\"currentLocation\": \"Таверна\", \"updates\": []}");
});

test("sceneUpdateSchema validates valid scene updates", () => {
  const sample = {
    currentLocation: "Подвалы Док-Уорда",
    updates: [
      {
        id: "char-1",
        inScene: true,
        status: "Без сознания на полу, пергамент в руке",
        location: "Подвал",
        hpDelta: 0,
      },
      {
        id: "char-2",
        inScene: false,
        status: "Остался в зале таверны",
        location: "Таверна",
        hpDelta: 0,
        relationDelta: 15,
      },
    ],
    newNpc: null,
  };

  const parsed = sceneUpdateSchema.safeParse(sample);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.updates.length, 2);
    assert.equal(parsed.data.updates[0].inScene, true);
    assert.equal(parsed.data.updates[0].relationDelta, 0); // default value
    assert.equal(parsed.data.updates[1].inScene, false);
    assert.equal(parsed.data.updates[1].relationDelta, 15);
  }
});

test("applyStatusToNotes replaces existing status tag or adds new one cleanly", () => {
  const initial = "Трактирщик средних лет.\n[Статус: наливает эль]";
  const updated = applyStatusToNotes(initial, "замер в оцепенении");
  assert.equal(updated, "[Статус: замер в оцепенении]\nТрактирщик средних лет.");

  const noStatus = "Молчаливый наёмник культа.";
  const added = applyStatusToNotes(noStatus, "заперся за дверью");
  assert.equal(added, "[Статус: заперся за дверью]\nМолчаливый наёмник культа.");

  const empty = null;
  const fromEmpty = applyStatusToNotes(empty, "спит");
  assert.equal(fromEmpty, "[Статус: спит]");
});

test("extractStatusFromNotes extracts status string correctly", () => {
  assert.equal(extractStatusFromNotes("[Статус: без сознания]\nЗаметки"), "без сознания");
  assert.equal(extractStatusFromNotes("[Состояние: тяжело ранен]"), "тяжело ранен");
  assert.equal(extractStatusFromNotes("Просто текст"), null);
  assert.equal(extractStatusFromNotes(null), null);
});

test("sceneUpdateSchema supports characterInsight and characterMemory", () => {
  const sample = {
    currentLocation: "Таверна",
    updates: [
      {
        id: "char-1",
        inScene: true,
        status: "Задумчиво смотрит на огонь",
        characterInsight: "Боится магии огня",
      },
    ],
    characterMemory: {
      characterName: "Торин",
      insight: "Раскрыл, что потерял отряд в подземном походе",
      importance: 9,
    },
  };

  const parsed = sceneUpdateSchema.safeParse(sample);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.updates[0].characterInsight, "Боится магии огня");
    assert.equal(parsed.data.characterMemory?.characterName, "Торин");
    assert.equal(parsed.data.characterMemory?.importance, 9);
  }
});

test("sceneUpdateSchema supports null characterInsight, null status, and array of newNpc", () => {
  const sample = {
    currentLocation: "Доки Южного района",
    updates: [
      {
        id: "char-1",
        inScene: true,
        status: null,
        characterInsight: null,
      },
    ],
    newNpc: [
      {
        name: "Гуннар Каменный Кулак",
        type: "companion",
        race: "Человек (северянин)",
        class: "Воин",
        location: "Доки",
        status: "прикрывает левый фланг",
      },
      {
        name: "Каэлин",
        type: "companion",
        race: "Полуэльф",
        class: "Следопыт",
        location: "Доки",
        status: "лук наготове",
      },
    ],
  };

  const parsed = sceneUpdateSchema.safeParse(sample);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(Array.isArray(parsed.data.newNpc), true);
    assert.equal((parsed.data.newNpc as any[])?.length, 2);
  }
});

test("sceneUpdateSchema supports newNpcs array with companions", () => {
  const sample = {
    currentLocation: "Доки",
    updates: [],
    newNpcs: [
      {
        name: "Гуннар",
        type: "companion",
      },
    ],
  };

  const parsed = sceneUpdateSchema.safeParse(sample);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.newNpcs?.length, 1);
    assert.equal(parsed.data.newNpcs?.[0].name, "Гуннар");
  }
});

