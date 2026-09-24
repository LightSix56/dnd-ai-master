import { describe, it, expect } from "vitest";
import { generateRoomCode, normalizeRoomCode, isValidRoomCode } from "../code-gen";

describe("Room Code Generator (Phase 1)", () => {
  it("generates a valid, readable uppercase room code with prefix and digits", () => {
    const code = generateRoomCode();
    expect(typeof code).toBe("string");
    expect(code).toMatch(/^[A-Z]+-\d{2,4}$/);
    expect(isValidRoomCode(code)).toBe(true);
  });

  it("normalizes user inputs (lowercases, extra spaces, mixed dashes, URLs)", () => {
    expect(normalizeRoomCode(" dragon-42 ")).toBe("DRAGON-42");
    expect(normalizeRoomCode("dragon 42")).toBe("DRAGON-42");
    expect(normalizeRoomCode("hydra--77")).toBe("HYDRA-77");
    expect(normalizeRoomCode("http://localhost:3000/room/DRAGON-42")).toBe("DRAGON-42");
    expect(normalizeRoomCode("https://dnd.example.com/room/paladin-99")).toBe("PALADIN-99");
    expect(normalizeRoomCode("/room/KOBOLD-12")).toBe("KOBOLD-12");
  });

  it("validates room codes correctly", () => {
    expect(isValidRoomCode("DRAGON-42")).toBe(true);
    expect(isValidRoomCode("HYDRA-105")).toBe(true);
    expect(isValidRoomCode("DUNGEON-MASTER-99")).toBe(true);

    expect(isValidRoomCode("")).toBe(false);
    expect(isValidRoomCode("123")).toBe(false);
    expect(isValidRoomCode("DRAGON")).toBe(false); // must have separator and suffix
    expect(isValidRoomCode("DRAGON 42")).toBe(false); // must be normalized first
    expect(isValidRoomCode("INVALID$%^")).toBe(false);
  });

  it("generates unique codes with minimal collision risk across 200 samples", () => {
    const samples = new Set<string>();
    for (let i = 0; i < 200; i++) {
      samples.add(generateRoomCode());
    }
    // Across 200 runs, collisions should be very low (at least 195 unique)
    expect(samples.size).toBeGreaterThanOrEqual(195);
  });
});
