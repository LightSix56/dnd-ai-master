import { describe, it, expect } from "vitest";
import { sheetsForRoomPicker } from "../picker";
import type { SheetRow } from "@/lib/dnd/sheet-store";

const row = (id: string, patch: Partial<SheetRow> = {}): SheetRow => ({
  id, userId: "u1", name: id, sheet: { name: id, level: 1 }, portraitUrl: null, revision: 0,
  campaignId: null, campaignName: null, sourceCharacterId: null, ...patch,
});

describe("sheetsForRoomPicker", () => {
  const toxin = row("toxin");
  const fang = row("fang");
  const toxinHere = row("toxin-here", { campaignId: "camp-1", campaignName: "Встреча", sourceCharacterId: "toxin" });
  const toxinElsewhere = row("toxin-else", { campaignId: "camp-2", campaignName: "Яма", sourceCharacterId: "toxin" });
  const quick = row("quick", { campaignId: "camp-1", campaignName: "Встреча" });

  it("shows this campaign's versions first and hides originals that already have one", () => {
    const ids = sheetsForRoomPicker([toxin, fang, toxinHere, toxinElsewhere, quick], "camp-1").map((r) => r.id);
    expect(ids).toEqual(["toxin-here", "quick", "fang"]);
  });

  it("versions of other campaigns are never offered", () => {
    const ids = sheetsForRoomPicker([toxin, toxinElsewhere], "camp-1").map((r) => r.id);
    expect(ids).toEqual(["toxin"]);
  });

  it("a room without a campaign offers only originals", () => {
    const ids = sheetsForRoomPicker([toxin, fang, toxinHere, quick], null).map((r) => r.id);
    expect(ids).toEqual(["toxin", "fang"]);
  });
});
