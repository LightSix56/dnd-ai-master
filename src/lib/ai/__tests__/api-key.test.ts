import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../client";
import { MISSING_API_KEY_MESSAGE, resolveApiKey } from "../api-key";

describe("ключ ИИ только из настроек пользователя", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("серверный AI_API_KEY не подставляется", () => {
    vi.stubEnv("AI_API_KEY", "server-secret-key");
    expect(resolveApiKey(undefined)).toBe("");
    expect(resolveApiKey("   ")).toBe("");
    expect(() => createClient(undefined)).toThrow(MISSING_API_KEY_MESSAGE);
  });

  it("ключ пользователя обрезается и принимается", () => {
    expect(resolveApiKey("  sk-abc \n")).toBe("sk-abc");
    expect(() => createClient("sk-abc")).not.toThrow();
  });
});
