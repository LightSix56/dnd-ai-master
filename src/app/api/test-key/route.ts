// API: проверка валидности API-ключа через простой запрос к claudehub.fun

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const {
      apiKey,
      model,
      baseURL,
      authMode = "bearer",
    }: {
      apiKey?: string;
      model?: string;
      baseURL?: string;
      authMode?: "bearer" | "x-api-key" | "raw";
    } = await req.json();

    if (!apiKey || typeof apiKey !== "string") {
      return Response.json(
        { valid: false, error: "API ключ не указан" },
        { status: 400 }
      );
    }

    // Триммим ключ — частая причина проблем!
    const cleanKey = apiKey.trim();

    // Базовая проверка формата
    if (cleanKey.length < 10) {
      return Response.json({
        valid: false,
        error: "Ключ слишком короткий. Проверьте, что скопировали полностью.",
      });
    }

    const selectedModel = (model || process.env.AI_MODEL || "deepseek/deepseek-v4.1-flash").trim();
    const selectedBaseURL = (baseURL || process.env.AI_BASE_URL || "https://polza.ai/api/v1")
      .trim()
      .replace(/\/+$/, "");

    // Формируем заголовок авторизации в зависимости от режима
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authMode === "bearer") {
      headers["Authorization"] = `Bearer ${cleanKey}`;
    } else if (authMode === "x-api-key") {
      headers["x-api-key"] = cleanKey;
    } else if (authMode === "raw") {
      // Ключ отправляется как есть, без префикса — некоторые провайдеры так требуют
      headers["Authorization"] = cleanKey;
    }

    // Делаем минимальный тестовый запрос напрямую,
    // чтобы получить точный код ответа и сообщение
    const testRes = await fetch(`${selectedBaseURL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (testRes.ok) {
      return Response.json({
        valid: true,
        message: `✅ Ключ валиден! Модель "${selectedModel}" работает. Режим авторизации: ${authMode}.`,
        model: selectedModel,
        authMode,
      });
    }

    // Не OK — анализируем ошибку
    const errText = await testRes.text();
    let errMessage = errText;
    try {
      const parsed = JSON.parse(errText);
      errMessage = parsed?.error?.message || parsed?.message || errText;
    } catch {
      // не JSON — оставляем как есть
    }

    if (testRes.status === 401) {
      return Response.json({
        valid: false,
        error: `Неверный API ключ (401) при режиме "${authMode}". ${errMessage}. Попробуйте другой режим авторизации в настройках.`,
        statusCode: 401,
      });
    }
    if (testRes.status === 403) {
      return Response.json({
        valid: false,
        error: `Доступ запрещён (403). ${errMessage}`,
        statusCode: 403,
      });
    }
    if (testRes.status === 404) {
      return Response.json({
        valid: false,
        error: `Модель "${selectedModel}" не найдена (404). Попробуйте: gpt-4o-mini, claude-3-5-sonnet, claude-3-5-haiku. ${errMessage}`,
        statusCode: 404,
      });
    }
    if (testRes.status === 429) {
      return Response.json({
        valid: false,
        error: `Превышен лимит запросов (429). ${errMessage}`,
        statusCode: 429,
      });
    }
    return Response.json({
      valid: false,
      error: `Ошибка ${testRes.status}: ${errMessage}`,
      statusCode: testRes.status,
    });
  } catch (error: any) {
    console.error("[test-key] error:", error);
    const msg = error?.message || String(error);
    if (msg.includes("timeout") || msg.includes("abort")) {
      return Response.json({
        valid: false,
        error: "Таймаут запроса. Проверьте интернет и baseURL.",
      });
    }
    return Response.json({
      valid: false,
      error: `Сетевая ошибка: ${msg}`,
    });
  }
}
