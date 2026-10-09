import { describe, it, expect } from "vitest";
import {
  normalizeCampaignSetup,
  normalizeCampaignSetupPatch,
  defaultCampaignSetup,
  validateCampaignSetupInput,
} from "../setup-params";

describe("normalizeCampaignSetup", () => {
  it("maps legacy Russian tone labels to keys", () => {
    expect(normalizeCampaignSetup({ tone: "Мрачный и напряженный" }, 1).tone).toBe("dark");
    expect(normalizeCampaignSetup({ tone: "Классический D&D" }, 1).tone).toBe("classic");
  });

  it("maps deadly to brutal", () => {
    expect(normalizeCampaignSetup({ difficulty: "deadly" }, 1).difficulty).toBe("brutal");
  });

  it("falls back to defaults for unknown enum values instead of throwing", () => {
    const v = normalizeCampaignSetup({ difficulty: "ultra", tone: "что-то", startingSituation: "x", dmStyle: "y", partyTies: "z" }, 1);
    expect(v.difficulty).toBe("normal");
    expect(v.tone).toBe(defaultCampaignSetup(1).tone);
    expect(v.startingSituation).toBe("strangers");
    expect(v.dmStyle).toBe("balanced");
    expect(v.partyTies).toBe("tight_knit");
  });

  it("clamps levelTo to 1..20 and not below the starting level", () => {
    expect(normalizeCampaignSetup({ levelTo: 99 }, 3).levelTo).toBe(20);
    expect(normalizeCampaignSetup({ levelTo: 1 }, 3).levelTo).toBe(3);
  });

  it("replaces an empty setting with the default on the server side", () => {
    expect(normalizeCampaignSetup({ setting: "   " }, 1).setting).toBe("Тёмное фэнтези");
  });

  it("trims custom notes and turns blank notes into null", () => {
    expect(normalizeCampaignSetup({ customDmNotes: "  склеп  " }, 1).customDmNotes).toBe("склеп");
    expect(normalizeCampaignSetup({ customDmNotes: "   " }, 1).customDmNotes).toBeNull();
  });
});

describe("normalizeCampaignSetupPatch", () => {
  it("returns only keys present in the input", () => {
    expect(normalizeCampaignSetupPatch({ tone: "heroic" }, 1)).toEqual({ tone: "heroic" });
  });
});

describe("validateCampaignSetupInput", () => {
  it("rejects an empty setting", () => {
    expect(validateCampaignSetupInput({ title: "Т", setting: "  " }).isValid).toBe(false);
  });
});
