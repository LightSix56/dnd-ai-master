// Расчёт и форматирование стоимости использования моделей (в рублях)
// с учётом тарифов Polza.ai и скидок на кеширование промпта.

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
}

export interface ModelPricing {
  inputRubPerMillion: number;
  outputRubPerMillion: number;
  cacheReadRubPerMillion?: number;
}

export interface CampaignAiStats {
  totalCostRub: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  turnsCount: number;
}

// Базовые тарифы популярных моделей на Polza.ai (рублей за 1 миллион токенов)
export const KNOWN_MODEL_PRICING: Record<string, ModelPricing> = {
  "deepseek/deepseek-v4.1-flash": {
    inputRubPerMillion: 16.47,
    outputRubPerMillion: 49.42,
    cacheReadRubPerMillion: 0.49,
  },
  "deepseek/deepseek-v4-flash": {
    inputRubPerMillion: 4.18,
    outputRubPerMillion: 8.37,
    cacheReadRubPerMillion: 0.83,
  },
  "google/gemini-2.5-flash-lite": {
    inputRubPerMillion: 5.88,
    outputRubPerMillion: 23.53,
    cacheReadRubPerMillion: 0.58,
  },
  "google/gemini-2.5-flash": {
    inputRubPerMillion: 14.71,
    outputRubPerMillion: 58.84,
    cacheReadRubPerMillion: 1.47,
  },
  "anthropic/claude-3-5-sonnet": {
    inputRubPerMillion: 295.0,
    outputRubPerMillion: 1475.0,
    cacheReadRubPerMillion: 29.5,
  },
  "anthropic/claude-3-5-haiku": {
    inputRubPerMillion: 98.0,
    outputRubPerMillion: 490.0,
    cacheReadRubPerMillion: 9.8,
  },
  "openai/gpt-4o-mini": {
    inputRubPerMillion: 14.7,
    outputRubPerMillion: 58.8,
    cacheReadRubPerMillion: 7.35,
  },
  "openai/gpt-4o": {
    inputRubPerMillion: 245.0,
    outputRubPerMillion: 980.0,
    cacheReadRubPerMillion: 122.5,
  },
};

/**
 * Рассчитывает стоимость запроса в рублях на основе тарифа модели и использованных токенов.
 * Учитывает кеширование: на Polza.ai кешированные токены промпта тарифицируются
 * со скидкой до 97% (например, 0.49 ₽/1M вместо 16.47 ₽/1M).
 */
export function calculateCostRub(
  modelId: string,
  usage?: TokenUsage,
  customPricing?: { input?: number; output?: number; cache_read?: number }
): number {
  if (!usage) return 0;

  const pricing: ModelPricing =
    customPricing && customPricing.input != null && customPricing.output != null
      ? {
          inputRubPerMillion: customPricing.input,
          outputRubPerMillion: customPricing.output,
          cacheReadRubPerMillion:
            customPricing.cache_read ?? customPricing.input * 0.1,
        }
      : KNOWN_MODEL_PRICING[modelId] || {
          // Дефолтный усреднённый тариф Flash-моделей
          inputRubPerMillion: 15.0,
          outputRubPerMillion: 45.0,
          cacheReadRubPerMillion: 1.5,
        };

  const input = Math.max(0, usage.inputTokens ?? 0);
  const output = Math.max(0, usage.outputTokens ?? 0);
  const cached = Math.min(input, Math.max(0, usage.cachedTokens ?? 0));

  const uncachedInput = Math.max(0, input - cached);
  const cachePrice = pricing.cacheReadRubPerMillion ?? pricing.inputRubPerMillion * 0.1;

  const cacheCost = (cached * cachePrice) / 1_000_000;
  const inputCost = (uncachedInput * pricing.inputRubPerMillion) / 1_000_000;
  const outputCost = (output * pricing.outputRubPerMillion) / 1_000_000;

  const total = cacheCost + inputCost + outputCost;
  return Math.max(0, Number(total.toFixed(4)));
}

/**
 * Форматирует рубли для компактного и понятного отображения в интерфейсе.
 * Примеры: "0.00 ₽", "< 0.01 ₽", "0.14 ₽", "12.50 ₽".
 */
export function formatRubles(cost: number): string {
  if (!cost || cost <= 0) return "0.00 ₽";
  if (cost < 0.01) return "< 0.01 ₽";
  return `${cost.toFixed(2)} ₽`;
}

/**
 * Форматирует количество токенов в компактную строку (например "1.2k", "35k", "1.1M").
 */
export function formatTokens(count: number): string {
  if (!count || count <= 0) return "0";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toLocaleString("ru-RU");
}
