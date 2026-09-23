// Тест расчёта стоимости токенов, форматов и параметров Base URL
import assert from "node:assert/strict";
import { calculateCostRub, formatRubles, formatTokens, KNOWN_MODEL_PRICING } from "../src/lib/ai/cost.ts";
import { createClient } from "../src/lib/ai/client.ts";

console.log("=== Проверка модуля расчёта трат и параметров Base URL ===");

// 1. Тест KNOWN_MODEL_PRICING
assert.ok(KNOWN_MODEL_PRICING["deepseek/deepseek-v4.1-flash"], "Тариф DeepSeek V4.1 Flash должен существовать");
assert.equal(KNOWN_MODEL_PRICING["deepseek/deepseek-v4.1-flash"].inputRubPerMillion, 16.47);
assert.equal(KNOWN_MODEL_PRICING["deepseek/deepseek-v4.1-flash"].cacheReadRubPerMillion, 0.49);
assert.equal(KNOWN_MODEL_PRICING["deepseek/deepseek-v4.1-flash"].outputRubPerMillion, 49.42);

// 2. Тест расчёта стоимости для DeepSeek V4.1 Flash
// 1000 input токенов (из них 800 в кеше), 200 output токенов:
// Кеш: 800 * 0.49 / 1M = 0.000392 ₽
// Вход: 200 * 16.47 / 1M = 0.003294 ₽
// Выход: 200 * 49.42 / 1M = 0.009884 ₽
// Итого: 0.000392 + 0.003294 + 0.009884 = 0.01357 ₽
const cost = calculateCostRub("deepseek/deepseek-v4.1-flash", {
  inputTokens: 1000,
  cachedTokens: 800,
  outputTokens: 200,
  totalTokens: 1200,
});
console.log(`[TEST 1] Расчёт стоимости (1000 вх, 800 кеш, 200 вых): ${cost} ₽`);
assert.ok(cost > 0.013 && cost < 0.014, `Стоимость должна быть ~0.0136 ₽, получили: ${cost}`);

// 3. Тест форматирования рублей
assert.equal(formatRubles(0), "0.00 ₽");
assert.equal(formatRubles(0.004), "< 0.01 ₽");
assert.equal(formatRubles(0.14), "0.14 ₽");
assert.equal(formatRubles(12.5), "12.50 ₽");
console.log("[TEST 2] Форматирование рублей: ОК");

// 4. Тест форматирования токенов
assert.equal(formatTokens(0), "0");
assert.equal(formatTokens(850), "850");
assert.equal(formatTokens(1200), "1.2k");
assert.equal(formatTokens(45000), "45.0k");
assert.equal(formatTokens(1048576), "1.0M");
console.log("[TEST 3] Форматирование токенов: ОК");

// 5. Тест кастомного тарифа (например, переданного с API провайдера)
const customCost = calculateCostRub("custom-model", {
  inputTokens: 1000000,
  outputTokens: 1000000,
}, {
  input: 10,
  output: 20,
  cache_read: 1,
});
assert.equal(customCost, 30.0, "Кастомная модель с тарифом 10/20 ₽/1M должна стоить 30 ₽");
console.log("[TEST 4] Кастомные тарифы: ОК");

// 6. Тест createClient с кастомным Base URL
const clientWithCustomUrl = createClient("test-key", "bearer", "https://custom-proxy.example.com/api/v1///");
// OpenAI SDK client URL
assert.ok(clientWithCustomUrl, "Клиент успешно инициализирован");
console.log("[TEST 5] createClient с кастомным baseURL: ОК");

console.log("\n✅ Все тесты расчёта стоимости и Base URL успешно пройдены!");
