// Drawing primitives for the page canvas.
// The interface is drawn at display scale:
// 100 canvas px equal one world unit on the plane,
// and type is set large enough to survive a macro lens.
// Neutrals are strictly grey, with no hue.

import { lerp } from './math.js';

// The context every shot draws with.
export type Ctx = CanvasRenderingContext2D;

export const M = {
  page: '#0c0c0c',       // the page and the void around it
  ink: '#ececec',        // primary text, active controls
  ink2: '#a0a0a0',
  ink3: '#6a6a6a',
  ink4: '#3c3c3c',
  line: 'rgba(255,255,255,0.10)',
  line2: 'rgba(255,255,255,0.18)',
  track: '#262626',
} as const;

// Both families ship in fonts/.
// Plex Mono has no Greek, so its σ comes from Plex Sans,
// never from whatever monospace font the system has.
export const FONT = {
  sans: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
  mono: '"IBM Plex Mono", "IBM Plex Sans", ui-monospace, monospace',
} as const;

export interface TextStyle {
  size?: number;
  weight?: number;
  fam?: keyof typeof FONT;
  spacing?: number;
}

export interface TxtOpts extends TextStyle {
  color?: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  alpha?: number;
}

// Draws a string and returns its width.
export function txt(ctx: Ctx, s: string, x: number, y: number, {
  size = 16, weight = 400, fam = 'sans', color = M.ink,
  align = 'left', base = 'alphabetic', spacing = 0, alpha = 1,
}: TxtOpts = {}): number {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${FONT[fam]}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(s, x, y);
  const w = ctx.measureText(s).width;
  ctx.restore();
  return w;
}

export function measureTxt(ctx: Ctx, s: string, { size = 16, weight = 400, fam = 'sans', spacing = 0 }: TextStyle = {}): number {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT[fam]}`;
  ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(s).width;
  ctx.restore();
  return w;
}

// Small tracked label in capitals.
// Sigma stays lowercase:
// 'σ'.toUpperCase() is 'Σ', which reads as a sum.
export const micro = (ctx: Ctx, s: string, x: number, y: number, opts: TxtOpts = {}): number =>
  txt(ctx, s.toUpperCase().replace(/Σ/g, 'σ'), x, y, {
    size: 14, weight: 500, fam: 'mono', color: M.ink3, spacing: 1.6, ...opts,
  });

export function hline(ctx: Ctx, x0: number, x1: number, y: number, color: string = M.line): void {
  ctx.fillStyle = color;
  ctx.fillRect(x0, Math.round(y), x1 - x0, 1);
}

export function vline(ctx: Ctx, x: number, y0: number, y1: number, color: string = M.line): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), y0, 1, y1 - y0);
}

// Path of a rounded rectangle; fill or stroke it yourself.
export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Monotone cubic path through points (Fritsch–Carlson).
// It never overshoots the data,
// so a smooth line still tells the truth about its peaks.
export function monotonePath(ctx: Ctx, pts: number[][], move = true): void {
  const n = pts.length;
  if (n < 2) return;
  const dx: number[] = [], dy: number[] = [], m: number[] = [], tan: number[] = new Array(n);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    dy[i] = pts[i + 1][1] - pts[i][1];
    m[i] = dx[i] === 0 ? 0 : dy[i] / dx[i];
  }
  tan[0] = m[0];
  tan[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) tan[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
      tan[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
    }
  }
  if (move) ctx.moveTo(pts[0][0], pts[0][1]);
  else ctx.lineTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    ctx.bezierCurveTo(
      pts[i][0] + h, pts[i][1] + tan[i] * h,
      pts[i + 1][0] - h, pts[i + 1][1] - tan[i + 1] * h,
      pts[i + 1][0], pts[i + 1][1],
    );
  }
}

// Straight polyline through points.
export function polyline(ctx: Ctx, pts: number[][]): void {
  pts.forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
}

// A grey from 0 (page black) to 1 (ink white), as an rgb() string.
export const grey = (k: number, from = 0x0c, to = 0xec): string => {
  const c = Math.round(lerp(from, to, k));
  return `rgb(${c},${c},${c})`;
};
