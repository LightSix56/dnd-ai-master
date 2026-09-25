import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

import { HomeHubView } from "../HomeHubView";

describe("HomeHubView Component", () => {
  it("renders main dashboard action cards, settings, and login buttons", () => {
    const html = renderToStaticMarkup(<HomeHubView />);
    expect(html).toContain("Присоединиться к столу");
    expect(html).toContain("Создать сетевой стол");
    expect(html).toContain("Кампании");
    expect(html).toContain("TAVERN-612");

    // Header buttons
    expect(html).toContain("Настройки");
    expect(html).toContain("Войти в аккаунт");
  });
});
