import { describe, it, expect } from "vitest";
import { addPromptCacheMarkers, isClaudeModel } from "../client";

const body = (model: string, messages: unknown[]) => JSON.stringify({ model, messages, stream: true });

describe("метки кэша промпта для Claude", () => {
  it("ставит метку на системный промпт и на предпоследнее сообщение", () => {
    const out = JSON.parse(
      addPromptCacheMarkers(
        body("anthropic/claude-haiku-5.5", [
          { role: "system", content: "Правила и лор" },
          { role: "user", content: "Привет" },
          { role: "assistant", content: "Ответ мастера" },
          { role: "user", content: "Иду в таверну [срез сцены]" },
        ])
      )
    );

    expect(out.messages[0].content).toEqual([
      { type: "text", text: "Правила и лор", cache_control: { type: "ephemeral" } },
    ]);
    expect(out.messages[2].content).toEqual([
      { type: "text", text: "Ответ мастера", cache_control: { type: "ephemeral" } },
    ]);
    // изменчивый хвост и остальная история без меток
    expect(out.messages[1].content).toBe("Привет");
    expect(out.messages[3].content).toBe("Иду в таверну [срез сцены]");
    expect(out.stream).toBe(true);
  });

  it("в сообщении из нескольких блоков метка — на последнем текстовом", () => {
    const out = JSON.parse(
      addPromptCacheMarkers(
        body("anthropic/claude-sonnet-5", [
          { role: "system", content: "S" },
          { role: "user", content: [{ type: "text", text: "a" }, { type: "text", text: "b" }, { type: "image_url", image_url: { url: "x" } }] },
          { role: "user", content: "последнее" },
        ])
      )
    );
    expect(out.messages[1].content[1]).toEqual({ type: "text", text: "b", cache_control: { type: "ephemeral" } });
    expect(out.messages[1].content[0]).toEqual({ type: "text", text: "a" });
  });

  it("ответ ассистента с вызовом инструмента без текста не ломается", () => {
    const msgs = [
      { role: "system", content: "S" },
      { role: "assistant", content: null, tool_calls: [{ id: "1" }] },
      { role: "tool", tool_call_id: "1", content: "результат" },
    ];
    const out = JSON.parse(addPromptCacheMarkers(body("anthropic/claude-haiku-5.5", msgs)));
    expect(out.messages[1]).toEqual(msgs[1]);
  });

  it("другие модели не трогает", () => {
    const raw = body("deepseek/deepseek-v4.1-flash", [
      { role: "system", content: "S" },
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ]);
    expect(addPromptCacheMarkers(raw)).toBe(raw);
    expect(addPromptCacheMarkers("not json")).toBe("not json");
  });

  it("узнаёт Claude по имени модели", () => {
    expect(isClaudeModel("anthropic/claude-haiku-5.5")).toBe(true);
    expect(isClaudeModel("claude-opus-5-5")).toBe(true);
    expect(isClaudeModel("deepseek/deepseek-v4-flash")).toBe(false);
    expect(isClaudeModel(undefined)).toBe(false);
  });
});
