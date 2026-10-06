import { describe, it, expect } from "vitest";
import { resolveBackgroundHref } from "../useProcgenBackground";

describe("resolveBackgroundHref", () => {
  it("процедурная карта любого биома рисуется по своей ссылке", () => {
    expect(resolveBackgroundHref("procgen:forest?seed=1&v=1")).toEqual({ kind: "procgen", url: "procgen:forest?seed=1&v=1" });
    expect(resolveBackgroundHref("procgen:urban?seed=-4&v=1")).toEqual({ kind: "procgen", url: "procgen:urban?seed=-4&v=1" });
  });

  it("старые бои с пещерой рисуются как раньше", () => {
    expect(resolveBackgroundHref("procgen:cave?seed=3&v=1")).toEqual({ kind: "procgen", url: "procgen:cave?seed=3&v=1" });
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
