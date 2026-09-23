import { describe, it, expect } from "vitest";
import { validatePlayerAction, canSubmitPlayerTurn } from "../CoopTurnBar";
import { formatTypingMessage } from "../LiveTypingIndicator";

describe("CoopTurnBar & LiveTypingIndicator logic", () => {
  describe("validatePlayerAction", () => {
    it("rejects empty or whitespace-only action", () => {
      expect(validatePlayerAction("").isValid).toBe(false);
      expect(validatePlayerAction("   ").isValid).toBe(false);
      expect(validatePlayerAction("").error).toContain("пустым");
    });

    it("rejects action exceeding 2000 characters", () => {
      const longText = "a".repeat(2001);
      const res = validatePlayerAction(longText);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("длинное");
    });

    it("accepts valid action text", () => {
      const res = validatePlayerAction("Атакую длинным мечом ближнего гоблина");
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });
  });

  describe("canSubmitPlayerTurn", () => {
    it("prevents submission if already submitting", () => {
      expect(canSubmitPlayerTurn("waiting", true)).toBe(false);
    });

    it("prevents submission if turn is resolving or completed", () => {
      expect(canSubmitPlayerTurn("resolving", false)).toBe(false);
      expect(canSubmitPlayerTurn("completed", false)).toBe(false);
    });

    it("allows submission when waiting or undefined and not submitting", () => {
      expect(canSubmitPlayerTurn("waiting", false)).toBe(true);
      expect(canSubmitPlayerTurn(undefined, false)).toBe(true);
    });
  });

  describe("formatTypingMessage", () => {
    it("returns null for empty object", () => {
      expect(formatTypingMessage({})).toBeNull();
    });

    it("formats message for single player", () => {
      const msg = formatTypingMessage({
        u1: { characterName: "Торин", timestamp: 1000 },
      });
      expect(msg).toBe("Торин обдумывает действие...");
    });

    it("formats message for two players", () => {
      const msg = formatTypingMessage({
        u1: { characterName: "Торин", timestamp: 1000 },
        u2: { characterName: "Гэндальф", timestamp: 1001 },
      });
      expect(msg).toBe("Торин и Гэндальф обдумывают действия...");
    });

    it("formats message for three or more players", () => {
      const msg = formatTypingMessage({
        u1: { characterName: "Торин", timestamp: 1000 },
        u2: { characterName: "Гэндальф", timestamp: 1001 },
        u3: { characterName: "Леголас", timestamp: 1002 },
      });
      expect(msg).toBe("Торин, Гэндальф и ещё 1 пишут действия...");
    });
  });
});
