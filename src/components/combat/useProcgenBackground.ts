"use client";

// Фон боя: обычная картинка — как есть; ссылка procgen: — пещера, которую браузер
// рисует сам по зерну. У всех игроков комнаты зерно одно, значит и карта одна.

import { useEffect, useState } from "react";
import { parseProcgenUrl } from "@/lib/combat/procgen";
import { generateCaveLayout } from "@/lib/combat/procgen/cave";
import { renderCaveToCanvas, type CaveTextures } from "@/lib/combat/procgen/render-cave";

const CELL_PX = 70;

export type BackgroundSource = { kind: "procgen"; seed: number } | { kind: "image"; href: string } | { kind: "none" };

export function resolveBackgroundHref(url: string | null | undefined): BackgroundSource {
  if (!url) return { kind: "none" };
  if (url.startsWith("procgen:")) {
    const parsed = parseProcgenUrl(url);
    return parsed ? { kind: "procgen", seed: parsed.seed } : { kind: "none" };
  }
  // Готовые карты перенесены в archive/maps: у старых боёв фон пустой, без запроса в 404
  if (url.startsWith("/maps/")) return { kind: "none" };
  return { kind: "image", href: url };
}

let texturesPromise: Promise<CaveTextures> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Не загрузилась текстура ${src}`));
    img.src = src;
  });
}

function loadTextures(): Promise<CaveTextures> {
  texturesPromise ??= Promise.all([
    loadImage("/textures/cc0/cave-floor-a.png"),
    loadImage("/textures/cc0/cave-floor-b.png"),
    loadImage("/textures/cc0/cave-rock.png"),
  ]).then(([floorA, floorB, rock]) => ({ floorA, floorB, rock }));
  // Неудачную загрузку не кэшируем: при следующем бое попробуем снова
  texturesPromise.catch(() => (texturesPromise = null));
  return texturesPromise;
}

/** Ссылка для `<image href>` или null, пока процедурная карта рисуется (и для пустого фона) */
export function useProcgenBackground(backgroundUrl: string | null | undefined): string | null {
  const source = resolveBackgroundHref(backgroundUrl);
  const seed = source.kind === "procgen" ? source.seed : null;
  const [rendered, setRendered] = useState<{ seed: number; href: string } | null>(null);

  useEffect(() => {
    if (seed === null) return;
    let cancelled = false;
    let href: string | null = null;
    loadTextures()
      .then((textures) => {
        if (cancelled) return;
        const canvas = renderCaveToCanvas(generateCaveLayout(seed), textures, CELL_PX);
        canvas.toBlob((blob) => {
          if (!blob || cancelled) return;
          href = URL.createObjectURL(blob);
          setRendered({ seed, href });
        }, "image/png");
      })
      .catch((e) => console.error("[procgen] не удалось нарисовать карту:", e));
    return () => {
      cancelled = true;
      if (href) URL.revokeObjectURL(href);
    };
  }, [seed]);

  if (source.kind === "image") return source.href;
  if (source.kind === "procgen" && rendered?.seed === source.seed) return rendered.href;
  return null;
}
