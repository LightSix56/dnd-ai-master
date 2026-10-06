import { describe, it, expect } from "vitest";
import { resolveBackgroundHref } from "../useProcgenBackground";

describe("resolveBackgroundHref", () => {
  it("процедурная пещера рисуется по зерну", () => {
    expect(resolveBackgroundHref("procgen:cave?seed=3&v=1")).toEqual({ kind: "procgen", seed: 3 });
  });

  it("обычная картинка отдаётся как есть", () => {
    expect(resolveBackgroundHref("https://example.com/map.jpg")).toEqual({ kind: "image", href: "https://example.com/map.jpg" });
  });

  it("старые карты из архива не запрашиваются — тёмный фон без 404", () => {
    expect(resolveBackgroundHref("/maps/dungeon.png")).toEqual({ kind: "none" });
    expect(resolveBackgroundHref("/maps/forest.jpg")).toEqual({ kind: "none" });
  });

  it("битая ссылка procgen и пустой фон — без картинки", () => {
    for (const url of ["procgen:cave?v=1", "procgen:volcano?seed=1&v=1", "", undefined, null]) {
      expect(resolveBackgroundHref(url)).toEqual({ kind: "none" });
    }
  });
});
