"use client";

// Фон боя: обычная картинка — как есть; ссылка procgen: — карту биома браузер рисует сам
// по зерну. У всех игроков комнаты зерно одно, значит и карта одна.

import { useEffect, useState } from "react";
import { layoutForUrl, parseProcgenUrl } from "@/lib/combat/procgen";
import { renderMapToCanvas, type MapTextures } from "@/lib/combat/procgen/render-map";
import { TEXTURE_FILES, type TextureKey } from "@/lib/combat/procgen/palettes";

const CELL_PX = 70;

export type BackgroundSource = { kind: "procgen"; url: string } | { kind: "image"; href: string } | { kind: "none" };

export function resolveBackgroundHref(url: string | null | undefined): BackgroundSource {
  if (!url) return { kind: "none" };
  if (url.startsWith("procgen:")) return parseProcgenUrl(url) ? { kind: "procgen", url } : { kind: "none" };
  // Готовые карты перенесены в archive/maps: у старых боёв фон пустой, без запроса в 404
  if (url.startsWith("/maps/")) return { kind: "none" };
  return { kind: "image", href: url };
}

let texturesPromise: Promise<MapTextures> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Не загрузилась текстура ${src}`));
    img.src = src;
  });
}

function loadTextures(): Promise<MapTextures> {
  const entries = Object.entries(TEXTURE_FILES) as [TextureKey, string][];
  texturesPromise ??= Promise.all(entries.map(([, src]) => loadImage(src))).then(
    (images) => Object.fromEntries(entries.map(([key], i) => [key, images[i]])) as MapTextures
  );
  // Неудачную загрузку не кэшируем: при следующем бое попробуем снова
  texturesPromise.catch(() => (texturesPromise = null));
  return texturesPromise;
}

/** Готовые картинки по ссылке procgen: — живут, пока открыта страница; повторное открытие боя мгновенно */
const rendered = new Map<string, Promise<string>>();

function renderUrl(url: string): Promise<string> {
  let job = rendered.get(url);
  if (!job) {
    job = loadTextures().then(
      (textures) =>
        new Promise<string>((resolve, reject) => {
          const layout = layoutForUrl(url);
          if (!layout) return reject(new Error(`Неизвестная карта ${url}`));
          renderMapToCanvas(layout, textures, CELL_PX).toBlob((blob) => {
            if (blob) resolve(URL.createObjectURL(blob));
            else reject(new Error("Не удалось сохранить картинку карты"));
          }, "image/png");
        })
    );
    job.catch(() => rendered.delete(url));
    rendered.set(url, job);
  }
  return job;
}

/** Ссылка для `<image href>` или null, пока процедурная карта рисуется (и для пустого фона) */
export function useProcgenBackground(backgroundUrl: string | null | undefined): string | null {
  const source = resolveBackgroundHref(backgroundUrl);
  const procgenUrl = source.kind === "procgen" ? source.url : null;
  const [result, setResult] = useState<{ url: string; href: string } | null>(null);

  useEffect(() => {
    if (!procgenUrl) return;
    let cancelled = false;
    renderUrl(procgenUrl)
      .then((href) => {
        if (!cancelled) setResult({ url: procgenUrl, href });
      })
      .catch((e) => console.error("[procgen] не удалось нарисовать карту:", e));
    return () => {
      cancelled = true;
    };
  }, [procgenUrl]);

  if (source.kind === "image") return source.href;
  if (source.kind === "procgen" && result?.url === source.url) return result.href;
  return null;
}
