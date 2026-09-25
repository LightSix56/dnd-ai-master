import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ code: "taver612" }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock DnDApp to verify prop forwarding
vi.mock("@/components/dnd/DnDApp", () => ({
  DnDApp: ({
    initialRoomCode,
    initialCombatOpen,
  }: {
    initialRoomCode?: string;
    initialCombatOpen?: boolean;
  }) => (
    <div
      data-testid="dnd-app"
      data-room-code={initialRoomCode}
      data-combat-open={String(initialCombatOpen)}
    >
      DnDApp Room: {initialRoomCode} (Combat: {String(initialCombatOpen)})
    </div>
  ),
}));

import RoomBattlePage from "../[code]/battle/page";

describe("RoomBattlePage /room/[code]/battle", () => {
  it("forwards params.code (uppercased) and initialCombatOpen=true to DnDApp", () => {
    const html = renderToStaticMarkup(<RoomBattlePage />);
    expect(html).toContain("DnDApp Room: TAVER612");
    expect(html).toContain("Combat: true");
  });
});
