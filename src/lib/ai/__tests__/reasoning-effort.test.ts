import { describe, it, expect } from "vitest";
import { addReasoningEffort } from "../client";

const bodyFor = (model: string) => JSON.stringify({ model, messages: [{ role: "user", content: "привет" }] });

describe("addReasoningEffort", () => {
  it("не меняет тело, если уровень не задан", () => {
    const body = bodyFor("anthropic/claude-haiku-5.5");
    expect(addReasoningEffort(body, {})).toBe(body);
    expect(addReasoningEffort(body, { effort: "  " })).toBe(body);
  });

  it("для Claude передаёт адаптивный режим с effort_level", () => {
    const out = JSON.parse(addReasoningEffort(bodyFor("anthropic/claude-haiku-5.5"), { effort: "high" }));
    expect(out.reasoning).toEqual({ type: "adaptive", effort_level: "high" });
  });

  it("для остальных моделей передаёт объект effort", () => {
    const out = JSON.parse(addReasoningEffort(bodyFor("deepseek/deepseek-v4.1-flash"), { effort: "medium" }));
    expect(out.reasoning).toEqual({ effort: "medium" });
  });

  it("не трогает запросы другой модели, если задана forModel", () => {
    const other = bodyFor("deepseek/deepseek-v4-flash");
    expect(addReasoningEffort(other, { effort: "high", forModel: "anthropic/claude-haiku-5.5" })).toBe(other);

    const main = JSON.parse(
      addReasoningEffort(bodyFor("anthropic/claude-haiku-5.5"), { effort: "high", forModel: "anthropic/claude-haiku-5.5" })
    );
    expect(main.reasoning).toEqual({ type: "adaptive", effort_level: "high" });
  });

  it("не падает на некорректном JSON", () => {
    expect(addReasoningEffort("not json", { effort: "high" })).toBe("not json");
  });
});
