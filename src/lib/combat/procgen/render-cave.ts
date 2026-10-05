// Отрисовка пещеры на canvas в браузере. Освещение, рельеф и маски считаются на
// субклеточных полях плана и растягиваются со сглаживанием; детализацию дают текстуры.
// Это единственный файл procgen, которому нужен DOM.

import type { CaveLayout } from "./cave";
import { Field, SUB, blurField, valueNoise } from "./field";
import { createRng } from "./rng";

export interface CaveTextures {
  floorA: CanvasImageSource;
  floorB: CanvasImageSource;
  rock: CanvasImageSource;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Маленький canvas из поля: цвет каждого отсчёта задаёт `paint` */
function fieldCanvas(w: number, h: number, paint: (i: number) => [number, number, number, number]): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b, a] = paint(i);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function stretch(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, w: number, h: number, op: GlobalCompositeOperation) {
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  ctx.restore();
}

function fillPattern(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number) {
  ctx.fillStyle = ctx.createPattern(img, "repeat")!;
  ctx.fillRect(0, 0, w, h);
}

const gray = (v: number): [number, number, number, number] => {
  const g = Math.round(clamp01(v) * 255);
  return [g, g, g, 255];
};

export function renderCaveToCanvas(layout: CaveLayout, textures: CaveTextures, cellPx: number): HTMLCanvasElement {
  const W = layout.width * cellPx;
  const H = layout.height * cellPx;
  const fw = layout.floor.w;
  const fh = layout.floor.h;
  const F = layout.floor.data;
  // Отдельный поток случайностей для оформления: план от него не зависит
  const rng = createRng((layout.seed ^ 0x9e3779b9) >>> 0);

  // ---- поля освещения в субклеточном разрешении ----
  const rock = new Field(fw, fh);
  for (let i = 0; i < F.length; i++) rock.data[i] = 1 - F[i];
  const relief = blurField(rock, 1);
  const bumps = valueNoise(rng, fw, fh, 40, 3);
  for (let i = 0; i < F.length; i++) relief.data[i] += bumps.data[i] * 0.25;
  const depth = blurField(rock, (30 / cellPx) * SUB);
  const nearWall = blurField(rock, (16 / cellPx) * SUB);
  const edgeSoft = blurField(layout.floor, 1);
  const light = valueNoise(rng, fw, fh, 14, 4);
  const patches = valueNoise(rng, fw, fh, 6, 4);
  const patchMask = new Field(fw, fh);
  for (let i = 0; i < F.length; i++) patchMask.data[i] = patches.data[i] > 0.55 ? 1 : 0;
  const mix = blurField(patchMask, 3);
  const waterTint = valueNoise(rng, fw, fh, 30, 3);

  const rockShade = fieldCanvas(fw, fh, (i) => {
    const x = i % fw;
    const y = (i - x) / fw;
    const gx = relief.get(Math.min(fw - 1, x + 1), y) - relief.get(Math.max(0, x - 1), y);
    const gy = relief.get(x, Math.min(fh - 1, y + 1)) - relief.get(x, Math.max(0, y - 1));
    const lit = Math.max(0.35, Math.min(1.3, 0.75 + (-gx - gy) * 2.5)); // свет сверху-слева
    return gray(0.62 * lit * (1 - depth.data[i] * 0.55));
  });
  const groundShade = fieldCanvas(fw, fh, (i) => {
    const ao = 1 - Math.min(0.75, nearWall.data[i] * 1.6); // тень у основания стен
    const rim = clamp01(F[i] - edgeSoft.data[i]) * 3; // тёмная кромка обрыва
    return gray((0.82 + 0.3 * light.data[i]) * ao * (1 - Math.min(0.9, rim)));
  });
  const floorMask = fieldCanvas(fw, fh, (i) => [0, 0, 0, Math.round(F[i] * 255)]);
  const mixMask = fieldCanvas(fw, fh, (i) => [0, 0, 0, Math.round(mix.data[i] * 0.7 * 255)]);
  const water = fieldCanvas(fw, fh, (i) => [
    30,
    Math.round(70 + waterTint.data[i] * 40),
    Math.round(95 + waterTint.data[i] * 50),
    Math.round(layout.water.data[i] * 205),
  ]);

  // ---- скала ----
  const out = makeCanvas(W, H);
  const ctx = out.getContext("2d")!;
  fillPattern(ctx, textures.rock, W, H);
  stretch(ctx, rockShade, W, H, "multiply");

  // ---- пол: две текстуры земли, свет и тени, затем вырезается по маске пола ----
  const ground = makeCanvas(W, H);
  const g = ground.getContext("2d")!;
  fillPattern(g, textures.floorA, W, H);
  const patch = makeCanvas(W, H);
  const p = patch.getContext("2d")!;
  fillPattern(p, textures.floorB, W, H);
  stretch(p, mixMask, W, H, "destination-in");
  g.drawImage(patch, 0, 0);
  stretch(g, groundShade, W, H, "multiply");
  stretch(g, floorMask, W, H, "destination-in");
  ctx.drawImage(ground, 0, 0);

  // ---- вода ----
  stretch(ctx, water, W, H, "source-over");

  // ---- декор ----
  const toPx = (v: number) => v * cellPx;
  for (const d of layout.decor) {
    const x = toPx(d.x);
    const y = toPx(d.y);
    const r = toPx(d.r);
    if (d.kind === "stalagmite") {
      const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      grad.addColorStop(0, "rgb(150,140,125)");
      grad.addColorStop(1, "rgb(60,55,50)");
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(x + r * 0.35, y + r * 0.4, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const pts = Array.from({ length: 10 }, (_, k) => {
      const a = (k / 10) * Math.PI * 2;
      const rr = r * (0.75 + 0.35 * rng.next());
      return [x + rr * Math.cos(a), y + rr * Math.sin(a)];
    });
    const poly = (dx: number, dy: number, list = pts) => {
      ctx.beginPath();
      list.forEach(([px, py], k) => (k === 0 ? ctx.moveTo(px + dx, py + dy) : ctx.lineTo(px + dx, py + dy)));
      ctx.closePath();
      ctx.fill();
    };
    const shade = 95 + Math.floor(rng.next() * 35);
    ctx.fillStyle = "rgba(0,0,0,0.43)";
    poly(r * 0.25, r * 0.3);
    ctx.fillStyle = `rgb(${shade},${shade - 6},${shade - 14})`;
    poly(0, 0);
    ctx.fillStyle = `rgb(${shade + 30},${shade + 24},${shade + 14})`;
    poly(-r * 0.12, -r * 0.12, [...pts.slice(6), ...pts.slice(0, 2)]);
  }

  // ---- виньетка ----
  const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) / 2);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  return out;
}
