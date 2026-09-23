import { describe, it, expect } from "vitest";
import { validateCampaignSetupInput } from "../RoomCampaignSetupModal";

describe("RoomCampaignSetupModal - validateCampaignSetupInput", () => {
  it("rejects empty title or setting", () => {
    const res1 = validateCampaignSetupInput({
      title: "",
      setting: "Тёмное фэнтези",
      difficulty: "normal",
      startingSituation: "strangers",
    });
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain("название");

    const res2 = validateCampaignSetupInput({
      title: "Падение замка",
      setting: "   ",
      difficulty: "normal",
      startingSituation: "strangers",
    });
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain("сеттинг");
  });

  it("accepts valid input and enforces level bounds", () => {
    const res = validateCampaignSetupInput({
      title: "Падение замка",
      setting: "Тёмное фэнтези",
      difficulty: "hard",
      startingSituation: "captives_or_survivors",
      levelTo: 10,
    });
    expect(res.isValid).toBe(true);
    expect(res.error).toBeUndefined();
  });
});
