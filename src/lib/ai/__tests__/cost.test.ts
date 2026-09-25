import { describe, it, expect } from "vitest";
import { extractCachedTokens, extractTokenUsage, calculateCostRub } from "@/lib/ai/cost";

describe("Token Usage and Prompt Cache Extraction", () => {
  describe("extractCachedTokens", () => {
    it("returns 0 for null, undefined or empty input", () => {
      expect(extractCachedTokens(null)).toBe(0);
      expect(extractCachedTokens(undefined)).toBe(0);
      expect(extractCachedTokens({})).toBe(0);
      expect(extractCachedTokens("not-an-object")).toBe(0);
    });

    it("extracts from AI SDK inputTokenDetails.cacheReadTokens", () => {
      const usage = {
        inputTokens: 1500,
        outputTokens: 200,
        inputTokenDetails: { cacheReadTokens: 1200 },
      };
      expect(extractCachedTokens(usage)).toBe(1200);
    });

    it("extracts from OpenAI camelCase promptTokensDetails.cachedTokens", () => {
      const usage = {
        promptTokens: 2000,
        completionTokens: 300,
        promptTokensDetails: { cachedTokens: 1800 },
      };
      expect(extractCachedTokens(usage)).toBe(1800);
    });

    it("extracts from OpenAI snake_case prompt_tokens_details.cached_tokens", () => {
      const usage = {
        prompt_tokens: 3500,
        completion_tokens: 400,
        prompt_tokens_details: { cached_tokens: 3000 },
      };
      expect(extractCachedTokens(usage)).toBe(3000);
    });

    it("extracts from direct cachedTokens or cached_tokens", () => {
      expect(extractCachedTokens({ cachedTokens: 750 })).toBe(750);
      expect(extractCachedTokens({ cached_tokens: 950 })).toBe(950);
    });
  });

  describe("extractTokenUsage", () => {
    it("handles AI SDK usage object format", () => {
      const usage = {
        inputTokens: 1000,
        outputTokens: 250,
        totalTokens: 1250,
        inputTokenDetails: { cacheReadTokens: 800 },
      };
      const extracted = extractTokenUsage(usage);
      expect(extracted).toEqual({
        inputTokens: 1000,
        outputTokens: 250,
        cachedTokens: 800,
        totalTokens: 1250,
      });
    });

    it("handles OpenAI snake_case usage object format and calculates total if omitted", () => {
      const usage = {
        prompt_tokens: 2500,
        completion_tokens: 350,
        prompt_tokens_details: { cached_tokens: 2000 },
      };
      const extracted = extractTokenUsage(usage);
      expect(extracted).toEqual({
        inputTokens: 2500,
        outputTokens: 350,
        cachedTokens: 2000,
        totalTokens: 2850,
      });
    });

    it("safely handles null/undefined with zeroed defaults", () => {
      expect(extractTokenUsage(undefined)).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
      });
    });
  });
});
