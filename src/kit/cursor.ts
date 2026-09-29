// The cursor is drawn into the page canvas, like a screen recording:
// it lies on the plane with the interface
// and takes the same perspective and the same blur.
// (x, y) is the hotspot.
// At scale 1 the arrow is 26 px tall.

import { roundRect, type Ctx } from './draw.js';

const ARROW: [number, number][] = [[0, 0], [0, 0.78], [0.19, 0.615], [0.325, 0.905], [0.455, 0.845], [0.325, 0.56], [0.575, 0.56]];

// The pointing hand as rounded parts: index finger, three folded fingers, palm.
// Each part is [x, y, width, height, radius].
const HAND: [number, number, number, number, number][] = [
  [5, 0, 3.6, 12.5, 1.8], [8.6, 6.4, 3.3, 7.6, 1.6], [11.9, 7.2, 3.3, 7.2, 1.6],
  [15.2, 8.4, 3.1, 6.4, 1.5], [5, 10.6, 13.3, 10.6, 3.4],
];

export interface CursorOpts {
  kind?: 'arrow' | 'hand';
  // 0..1, how far the button is pressed
  press?: number;
  alpha?: number;
  scale?: number;
}

// What a shot's state keeps about its cursor.
export interface CursorState extends CursorOpts {
  x: number;
  y: number;
}

export function cursor(ctx: Ctx, x: number, y: number, { kind = 'arrow', press = 0, alpha = 1, scale = 1 }: CursorOpts = {}): void {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const s = scale * (1 - 0.1 * press);        // a press shrinks the pointer a little
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  if (kind === 'arrow') {
    const H = 26;
    ctx.beginPath();
    ARROW.forEach(([px, py], i) => (i ? ctx.lineTo(px * H, py * H) : ctx.moveTo(px * H, py * H)));
    ctx.closePath();
    ctx.strokeStyle = '#050505';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#f4f4f4';
    ctx.fill();
  } else {
    // hotspot at the index fingertip
    ctx.translate(-6.8, -0.6);
    ctx.scale(1.25, 1.25);
    const thumb = (g: Ctx, pad: number) => {
      g.save();
      g.translate(5.8, 14.2);
      g.rotate(-0.8);
      roundRect(g, -1.7 + pad, -1.7 + pad, 7.4 - 2 * pad, 3.5 - 2 * pad, Math.max(0.5, 1.75 - pad));
      g.fill();
      if (!pad) g.stroke();
      g.restore();
    };
    // a black silhouette first, then a white body inset into it
    ctx.strokeStyle = '#050505';
    ctx.lineWidth = 2.2;
    ctx.fillStyle = '#050505';
    for (const [a, b, c, d, e] of HAND) { roundRect(ctx, a, b, c, d, e); ctx.fill(); ctx.stroke(); }
    thumb(ctx, 0);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#f4f4f4';
    for (const [a, b, c, d, e] of HAND) { roundRect(ctx, a + 0.7, b + 0.7, c - 1.4, d - 1.4, Math.max(0.5, e - 0.7)); ctx.fill(); }
    thumb(ctx, 0.7);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 0.7;
    for (const cx of [8.6, 11.9, 15.2]) {
      ctx.beginPath();
      ctx.moveTo(cx, 10.8);
      ctx.lineTo(cx, 13.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}
