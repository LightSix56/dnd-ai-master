// API: получить список доступных моделей с Polza.ai (или другого OpenAI-compatible провайдера)
import { FEATURED_MODELS } from "@/lib/ai/models";

export const maxDuration = 15;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paramBaseURL = searchParams.get("baseURL");
  const paramApiKey = searchParams.get("apiKey");

  const baseURL = (paramBaseURL || process.env.AI_BASE_URL || "https://polza.ai/api/v1")
    .trim()
    .replace(/\/+$/, "");
  const apiKey = (paramApiKey || process.env.AI_API_KEY || "").trim();

  try {
    const url = baseURL.includes("polza.ai")
      ? `${baseURL}/models?type=chat`
      : `${baseURL}/models`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "AI-DND-Master/1.0",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return Response.json({
        models: FEATURED_MODELS.map((m) => ({
          id: m.id,
          name: m.name,
          context_length: m.contextLength,
          pricing: {
            input: m.promptRubPerMillion,
            output: m.completionRubPerMillion,
            cache_read: m.cacheReadRubPerMillion,
            prompt: `${m.promptRubPerMillion} ₽/1M`,
            completion: `${m.completionRubPerMillion} ₽/1M`,
            cache: `${m.cacheReadRubPerMillion} ₽/1M`,
          },
          supports_tools: true,
        })),
        count: FEATURED_MODELS.length,
        baseURL,
        fallback: true,
      });
    }

    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data.data || [];

    const models = rawList.map((m: any) => {
      const topProv = m.top_provider || {};
      const pricing = topProv.pricing || {};
      const params = topProv.supported_parameters || m.supported_parameters || [];
      const supportsTools =
        params.includes("tools") ||
        m.supports_tools ||
        m.supportsTools ||
        false;

      const promptNum = pricing.prompt_per_million ? parseFloat(pricing.prompt_per_million) : undefined;
      const compNum = pricing.completion_per_million ? parseFloat(pricing.completion_per_million) : undefined;
      const cacheNum = pricing.cache_read_per_million ? parseFloat(pricing.cache_read_per_million) : undefined;
      const promptPrice = promptNum != null ? `${promptNum.toFixed(2)} ₽` : null;
      const compPrice = compNum != null ? `${compNum.toFixed(2)} ₽` : null;
      const cachePrice = cacheNum != null ? `${cacheNum.toFixed(2)} ₽` : null;

      return {
        id: m.id,
        name: m.name || m.display_name || m.id,
        context_length: topProv.context_length || m.context_length || 128000,
        pricing:
          promptNum != null && compNum != null
            ? {
                input: promptNum,
                output: compNum,
                cache_read: cacheNum,
                prompt: promptPrice,
                completion: compPrice,
                cache: cachePrice,
              }
            : undefined,
        supports_tools: supportsTools,
        supports_vision:
          m.architecture?.input_modalities?.includes("image") ||
          m.supports_vision ||
          false,
      };
    });

    // Сортировка:
    // 1. DeepSeek V4.1 Flash (Основной ДМ)
    // 2. DeepSeek V4 Flash (Служебный)
    // 3. Остальные Flash модели
    // 4. Claude 3.5 Sonnet
    // 5. Остальные по алфавиту
    models.sort((a: any, b: any) => {
      if (a.id === "deepseek/deepseek-v4.1-flash") return -1;
      if (b.id === "deepseek/deepseek-v4.1-flash") return 1;
      if (a.id === "deepseek/deepseek-v4-flash") return -1;
      if (b.id === "deepseek/deepseek-v4-flash") return 1;

      const aIsFlash = /flash/i.test(a.id);
      const bIsFlash = /flash/i.test(b.id);
      if (aIsFlash && !bIsFlash) return -1;
      if (!aIsFlash && bIsFlash) return 1;

      const aIsClaude = a.id.includes("claude");
      const bIsClaude = b.id.includes("claude");
      if (aIsClaude && !bIsClaude) return -1;
      if (!aIsClaude && bIsClaude) return 1;

      return a.name.localeCompare(b.name);
    });

    return Response.json({
      models,
      count: models.length,
      baseURL,
    });
  } catch (error: any) {
    console.error("[models] error:", error);
    return Response.json({
      models: FEATURED_MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        context_length: m.contextLength,
        pricing: {
          input: m.promptRubPerMillion,
          output: m.completionRubPerMillion,
          cache_read: m.cacheReadRubPerMillion,
          prompt: `${m.promptRubPerMillion} ₽/1M`,
          completion: `${m.completionRubPerMillion} ₽/1M`,
          cache: `${m.cacheReadRubPerMillion} ₽/1M`,
        },
        supports_tools: true,
      })),
      count: FEATURED_MODELS.length,
      baseURL,
      fallback: true,
    });
  }
}
