// Kinetic type.

import { smoothstep } from './math.js';
import { M, FONT, type Ctx } from './draw.js';

export interface OdometerOpts {
  size?: number;
  weight?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  color?: string;
  spacing?: number;
}

// A number whose digits roll like a mechanical counter.
// The lowest digit rolls continuously;
// each higher digit turns over only while the one below it passes from 9 to 0.
// Returns the drawn width.
export function odometer(ctx: Ctx, value: number, x: number, y: number, {
  size = 220, weight = 600, prefix = '$', suffix = 'M',
  decimals = 2, color = M.ink, spacing = -6,
}: OdometerOpts = {}): number {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT.sans}`;
  ctx.letterSpacing = `${spacing}px`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  const cell = ctx.measureText('0').width + spacing;
  const lh = size * 0.98;
  let cx = x;
  ctx.fillText(prefix, cx, y);
  cx += ctx.measureText(prefix).width + spacing;
  const intDigits = Math.max(1, Math.floor(Math.log10(Math.max(1, value))) + 1);
  const low = 10 ** -decimals;
  const reel = (p: number): number => {
    const r = value / p;
    if (p === low) return r;
    // A digit turns over only while the digits below it pass from 9 to 0,
    // which takes one step of the lowest digit;
    // as a fraction of this digit's range that is low / p.
    const w = low / p;
    return Math.floor(r) + smoothstep(1 - w, 1, r - Math.floor(r));
  };
  const drawReel = (p: number): void => {
    const pos = reel(p), d0 = ((Math.floor(pos) % 10) + 10) % 10, f = pos - Math.floor(pos);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 2, y - lh * 0.8, cell + 4, lh);
    ctx.clip();
    ctx.textAlign = 'center';
    ctx.fillText(String(d0), cx + cell / 2, y - f * lh);
    if (f > 0.001) ctx.fillText(String((d0 + 1) % 10), cx + cell / 2, y + (1 - f) * lh);
    ctx.restore();
    cx += cell;
  };
  for (let i = intDigits - 1; i >= 0; i--) drawReel(10 ** i);
  if (decimals > 0) {
    ctx.fillText('.', cx, y);
    cx += ctx.measureText('.').width + spacing;
    for (let i = 1; i <= decimals; i++) drawReel(10 ** -i);
  }
  ctx.fillText(suffix, cx, y);
  cx += ctx.measureText(suffix).width;
  ctx.restore();
  return cx - x;
}
