// Monochrome controls at display scale.
// Each one takes its animated state as numbers in 0..1
// (on, hover, press),
// so the same control can be drawn at any moment of a shot.

import { clamp, lerp, ease } from './math.js';
import { M, txt, measureTxt, roundRect, grey, type Ctx } from './draw.js';

export const TOG = { w: 58, h: 32 };

// Toggle switch.
// (x, y) is the top-left corner; scale enlarges it around that corner.
export function toggle(ctx: Ctx, x: number, y: number, on: number, hover = 0, press = 0, scale = 1): void {
  const { w, h } = TOG;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (hover > 0.001) {
    roundRect(ctx, -6, -6, w + 12, h + 12, (h + 12) / 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.28 * hover})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, h / 2);
  ctx.fillStyle = grey(on, 0x1a, 0xec);
  ctx.fill();
  ctx.strokeStyle = on > 0.5 ? 'rgba(255,255,255,0)' : `rgba(255,255,255,${0.2 + 0.15 * hover})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  // the knob stretches while pressed, the way a finger squashes it
  const kr = h / 2 - 4, stretch = 8 * press;
  const kx = lerp(4 + kr, w - 4 - kr - stretch, ease.inOut(on));
  roundRect(ctx, kx - kr, 4, kr * 2 + stretch, kr * 2, kr);
  ctx.fillStyle = grey(on, 0x8c, 0x0c);
  ctx.fill();
  ctx.restore();
}

export interface SliderOpts {
  // greyed out, for a control that is not the point of the shot
  dim?: boolean;
  // track thickness
  weight?: number;
  // thumb radius
  r?: number;
}

// Slider: a thin track, the filled part in ink, a ring thumb.
// v is the position in 0..1.
export function slider(ctx: Ctx, x0: number, x1: number, y: number, v: number, hover = 0, press = 0, { dim = false, weight = 2, r: R = 11 }: SliderOpts = {}): void {
  ctx.save();
  const x = lerp(x0, x1, v);
  ctx.fillStyle = M.track;
  ctx.fillRect(x0, y - weight / 2, x1 - x0, weight);
  ctx.fillStyle = dim ? '#6a6a6a' : M.ink;
  ctx.fillRect(x0, y - weight / 2, x - x0, weight);
  const act = Math.max(hover, press);
  if (act > 0.001) {
    ctx.beginPath();
    ctx.arc(x, y, R + 7 + 5 * press, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.25 * act})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const r = R * (1 + 0.12 * press);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = M.page;
  ctx.fill();
  ctx.strokeStyle = dim ? '#7a7a7a' : M.ink;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, R * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = dim ? '#7a7a7a' : M.ink;
  ctx.fill();
  ctx.restore();
}

export interface TabItem {
  label: string;
  // left edge of the label
  x: number;
}

// Tabs with a sliding underline.
// items: the labels and their positions, a: the active position as a fractional index, y: baseline.
export function tabs(ctx: Ctx, items: TabItem[], a: number, y: number, { size = 17 }: { size?: number } = {}): void {
  const ws = items.map((it) => measureTxt(ctx, it.label, { size, weight: 500 }));
  items.forEach((it, i) => {
    const k = 1 - clamp(Math.abs(a - i));
    txt(ctx, it.label, it.x, y, { size, weight: 500, color: grey(k, 0x6a, 0xec) });
  });
  const i0 = Math.floor(clamp(a, 0, items.length - 1));
  const i1 = Math.min(items.length - 1, i0 + 1), f = a - i0;
  ctx.fillStyle = M.ink;
  ctx.fillRect(lerp(items[i0].x, items[i1].x, f), y + 14, lerp(ws[i0], ws[i1], f), 2);
}

// Click ring.
// k is the progress since the press, 0..1.
export function ripple(ctx: Ctx, x: number, y: number, k: number): void {
  if (k <= 0 || k >= 1) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 10 + 44 * ease.out(k), 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - k)})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
