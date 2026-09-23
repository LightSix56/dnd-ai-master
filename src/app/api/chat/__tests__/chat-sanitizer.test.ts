import { test } from "vitest";
import assert from "node:assert/strict";
import { cleanAssistantNarrative } from "../route";

test("cleanAssistantNarrative keeps legitimate narrative untouched", () => {
  const story = "Позади слышен скрип — дверь таверны приоткрылась. Что вы делаете?";
  assert.equal(cleanAssistantNarrative(story), story);
});

test("cleanAssistantNarrative strips bookkeeper report leak", () => {
  const leaked = "Позади слышен скрип — дверь таверны «Треснувший Ковш» приоткрылась, и оттуда выглядывает женщина-трактирщица, бледная, с нервно сжатыми губами. Она машет тебе рукой — зайти. Видимо, новости о чужаках здесь расходятся быстро.\n\nЧто будешь делать — расспросить старика, направиться к трактирщице или осмотреть кристаллы на домах?Вступительная сцена развёрнута, ключевые NPC созданы, детали локации и завязка записаны в память кампании.\n\nЖду твоего решения, мастер.";
  const cleaned = cleanAssistantNarrative(leaked);

  assert.equal(
    cleaned,
    "Позади слышен скрип — дверь таверны «Треснувший Ковш» приоткрылась, и оттуда выглядывает женщина-трактирщица, бледная, с нервно сжатыми губами. Она машет тебе рукой — зайти. Видимо, новости о чужаках здесь расходятся быстро.\n\nЧто будешь делать — расспросить старика, направиться к трактирщице или осмотреть кристаллы на домах?"
  );
  assert.ok(!cleaned.includes("Вступительная сцена развёрнута"));
  assert.ok(!cleaned.includes("Жду твоего решения, мастер"));
});
