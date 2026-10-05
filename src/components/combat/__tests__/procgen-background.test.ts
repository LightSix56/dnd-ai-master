import { describe, it, expect } from "vitest";
import { resolveBackgroundHref } from "../useProcgenBackground";

describe("resolveBackgroundHref", () => {
  it("процедурная пещера рисуется по зерну", () => {
    expect(resolveBackgroundHref("procgen:cave?seed=3&v=1")).toEqual({ kind: "procgen", seed: 3 });
  });

  it("обычная картинка отдаётся как есть", () => {
    expect(resolveBackgroundHref("/maps/x.jpg")).toEqual({ kind: "image", href: "/maps/x.jpg" });
  });

  it("битая ссылка procgen и пустой фон — без картинки", () => {
    for (const url of ["procgen:cave?v=1", "procgen:forest?seed=1&v=1", "", undefined, null]) {
      expect(resolveBackgroundHref(url)).toEqual({ kind: "none" });
    }
  });
});
