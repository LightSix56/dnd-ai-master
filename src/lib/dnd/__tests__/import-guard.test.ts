import { describe, it, expect } from "vitest";
import { importTargetDecision } from "../import-guard";

describe("importTargetDecision", () => {
  it("no hero with that name — create", () => {
    expect(importTargetDecision(null)).toBe("create");
    expect(importTargetDecision(undefined)).toBe("create");
  });

  it("a hero kept only in the campaign is updated", () => {
    expect(importTargetDecision({ sheetCharacterId: null })).toBe("update-unlinked");
    expect(importTargetDecision({})).toBe("update-unlinked");
  });

  it("a hero with a sheet is never overwritten by an import", () => {
    expect(importTargetDecision({ sheetCharacterId: "11111111-1111-4111-8111-111111111111" })).toBe("refuse-linked");
  });
});
