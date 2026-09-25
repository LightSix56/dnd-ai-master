import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ code: "tavern-777" }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock DnDApp to verify prop forwarding
vi.mock("@/components/dnd/DnDApp", () => ({
  DnDApp: ({ initialRoomCode }: { initialRoomCode?: string }) => (
    <div data-testid="dnd-app" data-room-code={initialRoomCode}>
      DnDApp Room: {initialRoomCode}
    </div>
  ),
}));

import RoomPage from "../[code]/page";

describe("RoomPage /room/[code]", () => {
  it("forwards params.code (uppercased) to DnDApp as initialRoomCode", () => {
    const html = renderToStaticMarkup(<RoomPage />);
    expect(html).toContain("DnDApp Room: TAVERN-777");
  });
});
