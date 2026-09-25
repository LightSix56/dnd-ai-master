import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "camp-test-123" }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock DnDApp to verify prop forwarding
vi.mock("@/components/dnd/DnDApp", () => ({
  DnDApp: ({ initialCampaignId }: { initialCampaignId?: string }) => (
    <div data-testid="dnd-app" data-campaign-id={initialCampaignId}>
      DnDApp Campaign: {initialCampaignId}
    </div>
  ),
}));

import CampaignPage from "../[id]/page";

describe("CampaignPage /campaign/[id]", () => {
  it("forwards params.id to DnDApp as initialCampaignId", () => {
    const html = renderToStaticMarkup(<CampaignPage />);
    expect(html).toContain("DnDApp Campaign: camp-test-123");
  });
});
