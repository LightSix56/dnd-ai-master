import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CreateCampaignModal } from "../CreateCampaignModal";
import { CampaignSetupPanel, partySetupDescription } from "../CampaignSetupPanel";
import { defaultCampaignSetup } from "@/lib/campaign/setup-params";
import { buildStarterSheet } from "@/lib/dnd/starter-sheet";
import { isSheetCharacter, mapSheetToCharacter } from "@/lib/dnd/import-character";

const modalProps = (mode: "solo" | "network") => ({
  mode,
  name: "",
  startingLevel: 1,
  creating: false,
  onName: () => {},
  onStartingLevel: () => {},
  onCreate: () => {},
  onClose: () => {},
});

// Убирает пояснение под заголовком — единственное, чем окна могут отличаться
const stripDescription = (html: string) => html.replace(/<div[^>]*data-slot="card-description"[^>]*>.*?<\/div>/g, "");

describe("Окно «Новая кампания» одно для соло и сети", () => {
  it("shows the same title, fields and buttons in both modes", () => {
    const solo = renderToStaticMarkup(<CreateCampaignModal {...modalProps("solo")} />);
    const network = renderToStaticMarkup(<CreateCampaignModal {...modalProps("network")} />);
    for (const html of [solo, network]) {
      expect(html).toContain("Новая кампания");
      expect(html).toContain("Название кампании *");
      expect(html).toContain("Стартовый уровень (1–20)");
      expect(html).toContain("Создать кампанию");
    }
    expect(stripDescription(solo).replace(/data-mode="\w+"/, "")).toBe(
      stripDescription(network).replace(/data-mode="\w+"/, "")
    );
  });
});

describe("Карточка «Параметры сюжета и мира» одна для соло и сети", () => {
  it("renders the same header and fields in both modes", () => {
    const props = {
      description: partySetupDescription(2),
      initialTitle: "Т",
      initialValues: defaultCampaignSetup(1),
      startingLevel: 1,
      isGenerating: false,
      error: null,
      onSubmit: () => {},
      onCancel: () => {},
    };
    const solo = renderToStaticMarkup(<CampaignSetupPanel mode="solo" {...props} />);
    const network = renderToStaticMarkup(<CampaignSetupPanel mode="network" {...props} />);
    expect(solo).toContain("Параметры сюжета и мира");
    expect(solo.replace(/data-mode="\w+"/g, "")).toBe(network.replace(/data-mode="\w+"/g, ""));
  });

  it("declines the hero count in Russian", () => {
    expect(partySetupDescription(1)).toContain("1 герой");
    expect(partySetupDescription(3)).toContain("3 героя");
    expect(partySetupDescription(5)).toContain("5 героев");
    expect(partySetupDescription(11)).toContain("11 героев");
  });
});

describe("Герой, созданный в соло, получает тот же стартовый лист, что в комнате", () => {
  it("is accepted by the solo importer and keeps the requested level", () => {
    const sheet = buildStarterSheet({ name: "Торин", race: "Дварф", className: "Воин", level: 3 });
    expect(isSheetCharacter(sheet as any)).toBe(true);
    const mapped = mapSheetToCharacter(sheet as any, "player");
    expect(mapped.name).toBe("Торин");
    expect(mapped.level).toBe(3);
    expect(mapped.hpMax).toBeGreaterThan(0);
  });
});
