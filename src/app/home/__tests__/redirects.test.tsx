import { describe, it, expect, vi } from "vitest";

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

import HomePage from "../page";
import RoomsCodePage from "../../rooms/[code]/page";

describe("Route Aliases and Redirects", () => {
  it("/home redirects to /", () => {
    mockRedirect.mockClear();
    try {
      HomePage();
    } catch {}
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("/rooms/[code] redirects to /room/[code]", () => {
    mockRedirect.mockClear();
    try {
      RoomsCodePage({ params: { code: "TAVERN-612" } });
    } catch {}
    expect(mockRedirect).toHaveBeenCalledWith("/room/TAVERN-612");
  });
});
