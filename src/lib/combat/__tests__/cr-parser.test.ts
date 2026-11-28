import { describe, it, expect } from "vitest";
import { parseChallengeRating } from "../cr-parser";

describe("parseChallengeRating", () => {
  it("parses numeric and fractional CR strings safely", () => {
    expect(parseChallengeRating("0")).toBe(0);
    expect(parseChallengeRating("1/8")).toBe(0.125);
    expect(parseChallengeRating("1/4")).toBe(0.25);
    expect(parseChallengeRating("1/2")).toBe(0.5);
    expect(parseChallengeRating("5")).toBe(5);
    expect(parseChallengeRating("21")).toBe(21);
  });

  it("rejects arbitrary expressions without evaluating code", () => {
    expect(Number.isNaN(parseChallengeRating("alert(1)"))).toBe(true);
    expect(Number.isNaN(parseChallengeRating("1+1"))).toBe(true);
    expect(Number.isNaN(parseChallengeRating("1/0"))).toBe(true);
    expect(Number.isNaN(parseChallengeRating(""))).toBe(true);
  });
});
