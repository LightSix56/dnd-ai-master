// Отрисовка процедурной карты на canvas в браузере. Освещение, рельеф и маски считаются
// на субклеточных полях плана и растягиваются со сглаживанием; детализацию дают текстуры,
// объекты рисуются векторно. Это единственный файл procgen, которому нужен DOM.

import { Field, SUB, blurField, valueNoise } from "./field";
import { createRng, type Rng } from "./rng";
import type { Decor, ProcgenLayout } from "./layout";
import { PALETTES, type Palette, type TextureKey } from "./palettes";

export type MapTextures = Record<TextureKey, CanvasImageSource>;

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

// ---------- объекты ----------

function polygon(ctx: CanvasRenderingContext2D, pts: number[][], dx = 0, dy = 0) {
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x + dx, y + dy) : ctx.lineTo(x + dx, y + dy)));
  ctx.closePath();
  ctx.fill();
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha = 0.4) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.3, y + ry * 0.35, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function stone(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, r: number, base: number) {
  const pts = Array.from({ length: 10 }, (_, k) => {
    const a = (k / 10) * Math.PI * 2;
    const rr = r * (0.75 + 0.35 * rng.next());
    return [x + rr * Math.cos(a), y + rr * Math.sin(a)];
  });
  const shade = base + Math.floor(rng.next() * 35);
  ctx.fillStyle = "rgba(0,0,0,0.43)";
  polygon(ctx, pts, r * 0.25, r * 0.3);
  ctx.fillStyle = `rgb(${shade},${shade - 6},${shade - 14})`;
  polygon(ctx, pts);
  ctx.fillStyle = `rgb(${shade + 30},${shade + 24},${shade + 14})`;
  polygon(ctx, [...pts.slice(6), ...pts.slice(0, 2)], -r * 0.12, -r * 0.12);
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer: string) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function canopy(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, r: number, light: string, dark: string) {
  shadow(ctx, x, y, r * 1.1, r, 0.35);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rng.next();
    blob(ctx, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.7, light, dark);
  }
  blob(ctx, x, y, r * 0.75, light, dark);
}

function rectDecor(ctx: CanvasRenderingContext2D, d: Decor, cellPx: number, fill: string, edge: string) {
  const inset = cellPx * 0.12;
  const x = d.x * cellPx + inset;
  const y = d.y * cellPx + inset;
  const w = (d.w ?? 1) * cellPx - inset * 2;
  const h = (d.h ?? 1) * cellPx - inset * 2;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + cellPx * 0.08, y + cellPx * 0.1, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  return { x, y, w, h };
}

function drawDecor(ctx: CanvasRenderingContext2D, rng: Rng, d: Decor, cellPx: number) {
  const x = d.x * cellPx;
  const y = d.y * cellPx;
  const r = d.r * cellPx;
  switch (d.kind) {
    case "boulder":
    case "rubble":
      return stone(ctx, rng, x, y, r, 95);
    case "rock":
      return stone(ctx, rng, x, y, r, 80);
    case "stalagmite":
    case "column":
      shadow(ctx, x, y, r, r * 0.8);
      return blob(ctx, x, y, r, d.kind === "column" ? "rgb(175,170,160)" : "rgb(150,140,125)", "rgb(60,55,50)");
    case "tree":
      return canopy(ctx, rng, x, y, r * 1.6, "rgb(92,140,62)", "rgb(30,62,28)");
    case "pine":
      return canopy(ctx, rng, x, y, r * 1.4, "rgb(60,104,78)", "rgb(18,46,36)");
    case "bush":
      for (let k = 0; k < 3; k++) blob(ctx, x + (rng.next() - 0.5) * r, y + (rng.next() - 0.5) * r, r * 0.6, "rgb(110,150,70)", "rgb(40,70,30)");
      return;
    case "reed":
      ctx.strokeStyle = "rgba(170,180,80,0.95)";
      ctx.lineWidth = 2.5;
      for (let k = 0; k < 10; k++) {
        const bx = x + (rng.next() - 0.5) * r * 1.6;
        const by = y + (rng.next() - 0.5) * r * 1.6;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (rng.next() - 0.5) * r * 0.6, by - r * (0.6 + rng.next() * 0.5));
        ctx.stroke();
      }
      return;
    case "cactus": {
      const r = d.r * cellPx * 1.4;
      shadow(ctx, x, y, r, r * 0.6);
      ctx.fillStyle = "rgb(70,120,60)";
      ctx.fillRect(x - r * 0.3, y - r, r * 0.6, r * 2);
      ctx.fillRect(x - r, y - r * 0.2, r * 0.7, r * 0.35);
      ctx.fillRect(x + r * 0.3, y - r * 0.5, r * 0.7, r * 0.35);
      return;
    }
    case "dune": {
      const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r * 1.4);
      g.addColorStop(0, "rgba(255,240,200,0.55)");
      g.addColorStop(0.6, "rgba(220,190,130,0.2)");
      g.addColorStop(1, "rgba(150,110,60,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.5, r, 0.3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "ice":
      ctx.fillStyle = "rgba(170,210,240,0.55)";
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.3, r * 0.9, rng.next() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      return;
    case "crate": {
      const b = rectDecor(ctx, { ...d, x: d.x - 0.5, y: d.y - 0.5 }, cellPx, "rgb(140,98,52)", "rgb(70,45,20)");
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.moveTo(b.x + b.w, b.y);
      ctx.lineTo(b.x, b.y + b.h);
      ctx.stroke();
      return;
    }
    case "barrel":
      shadow(ctx, x, y, r, r * 0.8);
      blob(ctx, x, y, r, "rgb(150,100,55)", "rgb(80,50,25)");
      ctx.strokeStyle = "rgba(40,30,20,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.65, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case "table": {
      const b = rectDecor(ctx, d, cellPx, "rgb(176,128,78)", "rgb(48,28,12)");
      ctx.fillStyle = "rgba(255,230,190,0.25)";
      ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h * 0.35);
      return;
    }
    case "counter":
      rectDecor(ctx, d, cellPx, "rgb(96,60,30)", "rgb(50,30,12)");
      return;
    case "cart": {
      const b = rectDecor(ctx, d, cellPx, "rgb(120,86,50)", "rgb(60,40,20)");
      ctx.fillStyle = "rgb(40,30,20)";
      for (const wx of [b.x + b.w * 0.2, b.x + b.w * 0.8]) {
        ctx.fillRect(wx - 4, b.y - 4, 8, 6);
        ctx.fillRect(wx - 4, b.y + b.h - 2, 8, 6);
      }
      return;
    }
    case "stall": {
      const b = rectDecor(ctx, d, cellPx, "rgb(200,190,170)", "rgb(90,70,50)");
      const stripes = 6;
      for (let k = 0; k < stripes; k += 2) {
        ctx.fillStyle = "rgba(170,40,40,0.85)";
        ctx.fillRect(b.x + (b.w / stripes) * k, b.y, b.w / stripes, b.h);
      }
      return;
    }
    case "well":
      shadow(ctx, x, y, r * 1.2, r);
      blob(ctx, x, y, r * 1.2, "rgb(170,165,155)", "rgb(80,75,70)");
      blob(ctx, x, y, r * 0.7, "rgb(30,50,70)", "rgb(10,15,25)");
      return;
  }
}

// ---------- карта ----------

export function renderMapToCanvas(layout: ProcgenLayout, textures: MapTextures, cellPx: number): HTMLCanvasElement {
  const palette: Palette = PALETTES[layout.biome];
  const W = layout.width * cellPx;
  const H = layout.height * cellPx;
  const fw = layout.ground.w;
  const fh = layout.ground.h;
  const G = layout.ground.data;
  // Отдельный поток случайностей для оформления: план от него не зависит
  const rng = createRng((layout.seed ^ 0x9e3779b9) >>> 0);

  // ---- поля освещения в субклеточном разрешении ----
  const solid = new Field(fw, fh);
  for (let i = 0; i < G.length; i++) solid.data[i] = 1 - G[i];
  const relief = blurField(solid, 1);
  const bumps = valueNoise(rng, fw, fh, 40, 3);
  for (let i = 0; i < G.length; i++) relief.data[i] += bumps.data[i] * 0.25;
  const depth = blurField(solid, (30 / cellPx) * SUB);
  const nearWall = blurField(solid, (16 / cellPx) * SUB);
  const edgeSoft = blurField(layout.ground, 1);
  const light = valueNoise(rng, fw, fh, 14, 4);
  const patches = valueNoise(rng, fw, fh, 6, 4);
  const patchMask = new Field(fw, fh);
  for (let i = 0; i < G.length; i++) patchMask.data[i] = patches.data[i] > 0.55 ? 1 : 0;
  const mix = blurField(patchMask, 3);
  const liquidTint = valueNoise(rng, fw, fh, 30, 3);

  const solidShade = fieldCanvas(fw, fh, (i) => {
    if (palette.solid !== "rock") return gray(palette.solid === "brick" ? 0.62 * (1 - depth.data[i] * 0.4) : 0.85);
    const x = i % fw;
    const y = (i - x) / fw;
    const gx = relief.get(Math.min(fw - 1, x + 1), y) - relief.get(Math.max(0, x - 1), y);
    const gy = relief.get(x, Math.min(fh - 1, y + 1)) - relief.get(x, Math.max(0, y - 1));
    const lit = Math.max(0.35, Math.min(1.3, 0.75 + (-gx - gy) * 2.5)); // свет сверху-слева
    return gray(0.62 * (palette.solidLight ?? 1) * lit * (1 - depth.data[i] * 0.55));
  });
  const groundShade = fieldCanvas(fw, fh, (i) => {
    const ao = 1 - Math.min(0.75, nearWall.data[i] * 1.6 * palette.ambientOcclusion);
    const rim = clamp01(G[i] - edgeSoft.data[i]) * 3 * palette.ambientOcclusion;
    return gray((0.82 + 0.3 * light.data[i]) * ao * (1 - Math.min(0.9, rim)));
  });
  const groundMask = fieldCanvas(fw, fh, (i) => [0, 0, 0, Math.round(G[i] * 255)]);
  const mixMask = fieldCanvas(fw, fh, (i) => [0, 0, 0, Math.round(mix.data[i] * palette.groundMix * 255)]);
  const L = layout.liquid.data;
  const depthOfLiquid = blurField(layout.liquid, 4);
  const liquidColor = (i: number): [number, number, number, number] => {
    const t = liquidTint.data[i];
    const a = L[i];
    switch (palette.liquid) {
      case "lava":
        return [Math.round(220 + t * 35), Math.round(70 + t * 110), Math.round(10 + t * 30), Math.round(a * 245)];
      case "swamp":
        // Мутная стоячая вода: бурая у берега, тёмно-зелёная на глубине
        {
          const deep = clamp01((depthOfLiquid.data[i] - 0.4) * 2);
          const sheen = clamp01((t - 0.62) * 4) * 26; // тусклые блики на поверхности
          return [Math.round(58 - deep * 30 + sheen), Math.round(74 - deep * 26 + sheen * 1.1), Math.round(50 - deep * 12 + sheen * 0.9), Math.round(a * (225 + deep * 28))];
        }
      case "sea": {
        const deep = clamp01((depthOfLiquid.data[i] - 0.3) * 2);
        return [Math.round(30 - deep * 15), Math.round(95 + t * 30 - deep * 40), Math.round(140 + t * 40 - deep * 30), Math.round(a * 235)];
      }
      default:
        return [30, Math.round(70 + t * 40), Math.round(95 + t * 50), Math.round(a * 205)];
    }
  };
  const liquidCanvas = fieldCanvas(fw, fh, liquidColor);

  const out = makeCanvas(W, H);
  const ctx = out.getContext("2d")!;

  // ---- сплошное: скала, кладка или подложка под крыши ----
  fillPattern(ctx, textures[palette.solidTexture], W, H);
  stretch(ctx, solidShade, W, H, "multiply");

  // ---- земля: две текстуры, дороги, тонировка, свет и тени, вырезается по маске ----
  const ground = makeCanvas(W, H);
  const g = ground.getContext("2d")!;
  fillPattern(g, textures[palette.groundA], W, H);
  if (palette.groundMix > 0) {
    const patch = makeCanvas(W, H);
    const p = patch.getContext("2d")!;
    fillPattern(p, textures[palette.groundB], W, H);
    stretch(p, mixMask, W, H, "destination-in");
    g.drawImage(patch, 0, 0);
  }
  if (palette.groundTint) {
    g.fillStyle = palette.groundTint;
    g.fillRect(0, 0, W, H);
  }
  if (palette.road) {
    g.save();
    g.strokeStyle = g.createPattern(textures[palette.road.texture], "repeat")!;
    g.lineWidth = palette.road.width * cellPx;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.globalAlpha = 0.85;
    g.filter = "blur(2px)";
    for (const path of layout.paths) {
      g.beginPath();
      path.forEach((pt, k) => (k === 0 ? g.moveTo(pt.x * cellPx, pt.y * cellPx) : g.lineTo(pt.x * cellPx, pt.y * cellPx)));
      g.stroke();
      if (palette.road.tint) {
        g.strokeStyle = palette.road.tint;
        g.stroke();
        g.strokeStyle = g.createPattern(textures[palette.road.texture], "repeat")!;
      }
    }
    g.restore();
  }
  stretch(g, groundShade, W, H, "multiply");
  stretch(g, groundMask, W, H, "destination-in");
  ctx.drawImage(ground, 0, 0);

  // ---- жидкость; лава светится ----
  stretch(ctx, liquidCanvas, W, H, "source-over");
  if (palette.liquid === "lava") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = `blur(${Math.round(cellPx * 0.6)}px)`;
    ctx.globalAlpha = 0.85;
    stretch(ctx, liquidCanvas, W, H, "lighter");
    ctx.restore();
  }

  // ---- крыши домов с тенью ----
  if (palette.solid === "roof") {
    for (const s of layout.structures) {
      const x = s.x * cellPx;
      const y = s.y * cellPx;
      const w = s.w * cellPx;
      const h = s.h * cellPx;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x + cellPx * 0.25, y + cellPx * 0.3, w, h);
      ctx.fillStyle = ctx.createPattern(textures.roof, "repeat")!;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(150,55,35,0.45)";
      ctx.fillRect(x, y, w, h);
      const shade = ctx.createLinearGradient(x, y, x + w, y + h);
      shade.addColorStop(0, "rgba(255,230,200,0.15)");
      shade.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(40,20,15,0.9)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.beginPath();
      if (w >= h) {
        ctx.moveTo(x + h / 2, y + h / 2);
        ctx.lineTo(x + w - h / 2, y + h / 2);
      } else {
        ctx.moveTo(x + w / 2, y + w / 2);
        ctx.lineTo(x + w / 2, y + h - w / 2);
      }
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(60,25,15,0.85)";
      ctx.stroke();
    }
  }

  // ---- объекты ----
  for (const d of layout.decor) drawDecor(ctx, rng, d, cellPx);

  // ---- виньетка ----
  const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) / 2);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, `rgba(0,0,0,${palette.vignette})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  return out;
}
