import { describe, it, expect } from "vitest";
import { calculateCostRub } from "@/lib/ai/cost";
import { FEATURED_MODELS } from "@/lib/ai/models";

describe("Cost & Prompt Caching Savings Verification", () => {
  const modelId = "deepseek/deepseek-v4.1-flash";
  const modelInfo = FEATURED_MODELS.find((m) => m.id === modelId);

  it("confirms pricing exists for DeepSeek V4.1 Flash with cache discount", () => {
    expect(modelInfo).toBeDefined();
    expect(modelInfo?.promptRubPerMillion).toBe(16.47);
    expect(modelInfo?.cacheReadRubPerMillion).toBe(0.49);
    // Скидка за кэш составляет ~33.6x
    expect(modelInfo!.promptRubPerMillion / modelInfo!.cacheReadRubPerMillion).toBeCloseTo(33.6, 1);
  });

  it("calculates dramatic cost reduction on a 25,000-token turn with 97% cache hit rate", () => {
    const inputTokens = 25000;
    const outputTokens = 800;

    // Сценарий 1: Старый ИИ мастер без кэша (0% Cache Hit)
    const costWithoutCache = calculateCostRub(modelId, {
      inputTokens,
      outputTokens,
      cachedTokens: 0,
      totalTokens: inputTokens + outputTokens,
    });

    // Сценарий 2: Новый ИИ мастер по стандартам DeepSeek Harness (97% Cache Hit)
    const cachedTokens = Math.floor(inputTokens * 0.97); // 24,250 токенов из кэша
    const costWithDeepSeekHarnessCache = calculateCostRub(modelId, {
      inputTokens,
      outputTokens,
      cachedTokens,
      totalTokens: inputTokens + outputTokens,
    });

    // Без кэша: (25000 * 16.47 + 800 * 49.42) / 1_000_000 = 0.41175 + 0.039536 = ~0.4513 ₽
    expect(costWithoutCache).toBeGreaterThan(0.44);

    // С кэшем 97%:
    // Кэш: (24250 * 0.49) / 1_000_000 = 0.01188 ₽
    // Не кэш вход: (750 * 16.47) / 1_000_000 = 0.01235 ₽
    // Выход: (800 * 49.42) / 1_000_000 = 0.03954 ₽
    // Итого: ~0.0638 ₽
    expect(costWithDeepSeekHarnessCache).toBeLessThan(0.07);

    // Экономия составляет более чем в 6.5 раз с учётом генерации ответа!
    const savingsRatio = costWithoutCache / costWithDeepSeekHarnessCache;
    expect(savingsRatio).toBeGreaterThan(6.5);

    // А если рассматривать чисто стоимость входного контекста:
    const inputCostWithoutCache = (inputTokens * 16.47) / 1_000_000;
    const inputCostWithCache =
      ((inputTokens - cachedTokens) * 16.47 + cachedTokens * 0.49) / 1_000_000;
    const inputSavingsRatio = inputCostWithoutCache / inputCostWithCache;

    // Входной контекст удешевляется почти в 17 раз!
    expect(inputSavingsRatio).toBeGreaterThan(16.5);
  });

  it("handles long sessions with 100,000 tokens context window efficiently", () => {
    const inputTokens = 100000;
    const outputTokens = 1000;
    const cachedTokens = 97000; // 97% кэш

    const totalCost = calculateCostRub(modelId, {
      inputTokens,
      outputTokens,
      cachedTokens,
      totalTokens: inputTokens + outputTokens,
    });

    const unCachedTotalCost = calculateCostRub(modelId, {
      inputTokens,
      outputTokens,
      cachedTokens: 0,
      totalTokens: inputTokens + outputTokens,
    });

    // На 100К токенах разница колоссальная: ~0.146 ₽ вместо ~1.696 ₽ за один ход!
    expect(totalCost).toBeLessThan(0.16);
    expect(unCachedTotalCost).toBeGreaterThan(1.65);
    expect(unCachedTotalCost / totalCost).toBeGreaterThan(10);
  });
});
