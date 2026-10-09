import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignSetupForm } from "../CampaignSetupForm";
import { defaultCampaignSetup, prepareCampaignSubmit } from "@/lib/campaign/setup-params";

const baseProps = (mode: "solo" | "network") => ({
  mode,
  initialTitle: "Встреча",
  initialValues: defaultCampaignSetup(1),
  startingLevel: 1,
  isGenerating: false,
  error: null,
  onSubmit: () => {},
  onCancel: () => {},
});

describe("CampaignSetupForm: одинаковый набор полей в обоих режимах", () => {
  for (const mode of ["solo", "network"] as const) {
    it(`renders every setup label and the same options in ${mode} mode`, () => {
      const html = renderToStaticMarkup(<CampaignSetupForm {...baseProps(mode)} />);
      for (const label of ["Тон", "Сложность", "Стиль мастера", "Отношения в отряде", "Завязка", "Финальный уровень", "Пожелания"]) {
        expect(html).toContain(label);
      }
      expect(html).toContain("Смертоносная (хардкор)");
      expect(html).toContain("Сотворить Акт 1 приключения");
      expect(html).toContain(`data-mode="${mode}"`);
    });
  }
});

describe("prepareCampaignSubmit: проверка и значения перед отправкой", () => {
  it("refuses an empty setting and explains why", () => {
    const res = prepareCampaignSubmit({ ...defaultCampaignSetup(1), title: "Т", setting: "  " }, 1);
    expect(res).toEqual({ ok: false, error: "Укажите сеттинг или жанр приключения" });
  });

  it("returns normalized values: deadly becomes brutal, levelTo is kept", () => {
    const res = prepareCampaignSubmit(
      { ...defaultCampaignSetup(1), title: "Т", difficulty: "deadly" as any, levelTo: 10 },
      1
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.values.difficulty).toBe("brutal");
      expect(res.values.levelTo).toBe(10);
    }
  });
});
