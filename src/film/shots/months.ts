// Shot "Months":
// a grid of monthly run-rates, seen from the right.
// The hand clicks through the projected months,
// the selected cell inverts,
// and a giant readout nearest to the lens rolls to the new month like a drum.
// The glyph grid of a type specimen, translated into data.

import { M, txt, micro, hline, cursor, ripple, roundRect, clamp, lerp, inv, pulse, ease, type Ctx, type CursorState, type Vec2 } from '../../kit/index.js';
import type { CameraKeys, Shot, ShotState } from '../../engine/types.js';
import { revenue, revenueForecast } from '../data.js';

// sel: the selected month, prev: the one selected before it, since: seconds since the last click.
interface MonthsState extends ShotState {
  sel: number;
  prev: number;
  since: number;
  cursor: CursorState;
  ripple: number;
}

interface Month {
  m: string;
  v: number;
  note: string;
  i: number;
  projected: boolean;
}

const W = 1500, H = 900;
const CELL = { w: 128, h: 118, gap: 10 }, G0 = { x: 100, y: 262 };

// Run-rate (daily net revenue) at each month's end.
// Jan–May come before the 120-day series and follow its trend back;
// Jun–Sep come from the series;
// Oct–Dec are the 90-day forecast.
const FC = revenueForecast(90);
const MONTHS: Month[] = ([
  ['Jan', 2.71e6, 'Jan · actual'], ['Feb', 2.78e6, 'Feb · actual'], ['Mar', 2.86e6, 'Mar · actual'],
  ['Apr', 2.97e6, 'Apr · actual'], ['May', 3.12e6, 'May · actual'], ['Jun', revenue.values[31], 'Jun · actual'],
  ['Jul', revenue.values[62], 'Jul · actual'], ['Aug', revenue.values[93], 'Aug · actual'],
  ['Sep', revenue.values[119], 'Sep 26 · today'], ['Oct', FC[35].mid, 'Oct 31 · projected'],
  ['Nov', FC[65].mid, 'Nov 30 · projected'], ['Dec', FC[90].mid, 'Dec 25 · projected'],
] as [string, number, string][]).map(([m, v, note], i) => ({ m, v, note, i, projected: i >= 9 }));

const cellXY = (i: number) => ({ x: G0.x + (i % 4) * (CELL.w + CELL.gap), y: G0.y + Math.floor(i / 4) * (CELL.h + CELL.gap) });
const CLICKS: [number, number][] = [[0.35, 9], [0.95, 10], [1.55, 11]];
// aim low and right in a cell, so its month label stays visible beside the hand
const aim = (i: number): Vec2 => { const c = cellXY(i); return [c.x + CELL.w * 0.62, c.y + CELL.h * 0.7]; };
const PATH: [number, Vec2][] = [[0, [540, 700]], [0.3, aim(9)], [0.9, aim(10)], [1.5, aim(11)], [2.4, [aim(11)[0] + 30, aim(11)[1] + 40]]];

function state(t: number): MonthsState {
  let sel = 8, prev = 8, since = 99;
  for (const [tc, i] of CLICKS) if (t >= tc) { prev = sel; sel = i; since = t - tc; }
  let j = 0;
  while (j < PATH.length - 2 && t > PATH[j + 1][0]) j++;
  const [ta, pa] = PATH[j], [tb, pb] = PATH[j + 1];
  const k = ease.inOut(inv(ta, j === 0 ? tb : tb - 0.08, t));
  const press = CLICKS.reduce((a, [tc]) => a + pulse(t, tc - 0.05, tc + 0.12, 0.04, 0.07), 0);
  const c = cellXY(sel);
  return {
    sel, prev, since,
    cursor: { x: lerp(pa[0], pb[0], k), y: lerp(pa[1], pb[1], k), press: clamp(press) },
    ripple: since < 0.7 ? since / 0.7 : 0,
    focus: [c.x + CELL.w / 2, c.y + CELL.h / 2],
  };
}

const camera: CameraKeys = [
  [0.0, { look: [640, 470], distance: 10.6, azimuth: 36, elevation: 28, roll: -7, fov: 30, aperture: 0.4 }],
  [2.4, { look: [680, 480], distance: 9.9, azimuth: 33, elevation: 29, roll: -6, fov: 30, aperture: 0.4 }],
];

function draw(ctx: Ctx, w: number, h: number, _t: number, s: MonthsState): void {
  ctx.fillStyle = M.page;
  ctx.fillRect(0, 0, w, h);
  micro(ctx, 'Run-rate by month · 2026', G0.x, 214, { size: 16, color: M.ink2 });
  hline(ctx, 60, 680, 238);

  for (const mo of MONTHS) {
    const { x, y } = cellXY(mo.i);
    const selected = mo.i === s.sel;
    const sc = selected && s.since < 0.25 ? lerp(0.94, 1, ease.outBack(clamp(s.since / 0.25))) : 1;
    ctx.save();
    ctx.translate(x + CELL.w / 2, y + CELL.h / 2);
    ctx.scale(sc, sc);
    ctx.translate(-CELL.w / 2, -CELL.h / 2);
    roundRect(ctx, 0.5, 0.5, CELL.w - 1, CELL.h - 1, 10);
    if (selected) { ctx.fillStyle = M.ink; ctx.fill(); }
    else if (mo.projected) { ctx.setLineDash([5, 5]); ctx.strokeStyle = M.line2; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.fillStyle = '#151515'; ctx.fill(); }
    txt(ctx, mo.m.toUpperCase(), 16, 34, { size: 17, weight: 500, fam: 'mono', spacing: 1.5, color: selected ? M.page : M.ink3 });
    const fg = selected ? M.page : mo.projected ? M.ink2 : M.ink;
    txt(ctx, `${mo.projected ? '≈' : ''}$${(mo.v / 1e6).toFixed(2)}`, 14, CELL.h - 22, { size: 30, weight: 600, color: fg, spacing: -0.8 });
    ctx.restore();
  }
  micro(ctx, 'Filled · actual     Dashed · projected', G0.x, 690, { size: 13 });

  // the giant readout rolls inside a fixed window:
  // the old month leaves upward, the new one enters from below
  const inK = ease.inOut(clamp(s.since / 0.28));
  const rolling = s.prev !== s.sel && inK < 1;
  const readout = (mo: Month, dy: number): void => {
    micro(ctx, mo.note, 770, 330, { size: 18, color: M.ink2, alpha: rolling ? (dy === 0 ? 1 : 0) : 1 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(740, 350, w - 740, 280);
    ctx.clip();
    txt(ctx, mo.m, 756, 600 + dy, { size: 310, weight: 600, spacing: -12 });
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(740, 640, w - 740, 110);
    ctx.clip();
    txt(ctx, `$${(mo.v / 1e6).toFixed(2)}M`, 770, 730 + dy * 0.4, { size: 96, weight: 500, fam: 'mono', spacing: -3, color: '#d0d0d0' });
    ctx.restore();
  };
  if (rolling) { readout(MONTHS[s.prev], -280 * inK); readout(MONTHS[s.sel], 280 * (1 - inK)); }
  else readout(MONTHS[s.sel], 0);
  hline(ctx, 740, w - 60, 790);

  ripple(ctx, s.cursor.x - 4, s.cursor.y - 6, s.ripple);
  cursor(ctx, s.cursor.x, s.cursor.y, { kind: 'hand', press: s.cursor.press });
}

export default { id: 'months', duration: 2.4, size: { w: W, h: H }, camera, state, draw } satisfies Shot<MonthsState>;
