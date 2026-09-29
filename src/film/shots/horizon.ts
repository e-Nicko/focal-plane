// Shot "Horizon":
// a steep diagonal.
// The cursor drags the forecast horizon from 30 to 90 days.
// Below and to the right of the slider, nearer to the lens,
// the projected revenue rolls like a mechanical counter,
// and the forecast line stretches in the chart behind.
// The horizon itself, in huge light digits, sits nearest of all
// and melts into a soft foreground mass.

import { M, txt, micro, hline, vline, slider, tabs, cursor, odometer, monotonePath, polyline, clamp, lerp, inv, pulse, smoothstep, ease, type Ctx, type CursorState } from '../../kit/index.js';
import type { CameraKeys, Shot, ShotState } from '../../engine/types.js';
import { revenue, REVENUE_N, revenueForecast, dateAfter, type ForecastPoint } from '../data.js';

// v: the slider's position in 0..1, horizon: days, value: the projected revenue at that horizon.
interface HorizonState extends ShotState {
  v: number;
  horizon: number;
  value: number;
  cursor: CursorState;
  hover: number;
  press: number;
}

const W = 1600, H = 1000;
const SL = { x0: 190, x1: 700, y: 262 };
const CONF = { y: 372, v: (80 - 50) / 49 };
const CHART = { x: 960, y: 120, w: 540, h: 200 };
const LAST = REVENUE_N - 1;
const MAX_H = 120;
const days = (v: number): number => 7 + v * 113;          // the slider maps 0..1 to 7..120 days
const V0 = (30 - 7) / 113, V1 = (90 - 7) / 113;

const FC_MAX = revenueForecast(MAX_H);
const Y_MIN = 2.8e6, Y_MAX = Math.max(...revenue.values, FC_MAX[FC_MAX.length - 1].hi) * 1.02;
function forecastAt(d: number): ForecastPoint {
  const f = Math.floor(d), r = d - f;
  const a = FC_MAX[Math.min(MAX_H, f)], b = FC_MAX[Math.min(MAX_H, f + 1)];
  return { i: LAST + d, mid: lerp(a.mid, b.mid, r), lo: lerp(a.lo, b.lo, r), hi: lerp(a.hi, b.hi, r) };
}

// A hand-like drag:
// a quick start, the fastest point a third of the way,
// a small overshoot that settles on 90 days.
const DRAG_A = 0.45, DRAG_B = 2.0;
function sliderV(t: number): number {
  const k = inv(DRAG_A, DRAG_B, t);
  const e = 1 - Math.pow(1 - k, 3) * (1 + 3 * k) + 0.04 * Math.sin(Math.PI * clamp((k - 0.55) / 0.45));
  return lerp(V0, V1, e);
}

function state(t: number): HorizonState {
  const v = sliderV(t);
  const tx = lerp(SL.x0, SL.x1, v), ty = SL.y;
  // approach the thumb, grab it, drag, let go and lift off a little
  const a = ease.inOut(inv(0.0, 0.38, t));
  const lift = ease.out(inv(2.1, 2.4, t));
  const cx = lerp(560, tx + 5, a) + lift * 18, cy = lerp(380, ty + 7, a) + lift * 22;
  const press = pulse(t, 0.4, 2.08, 0.06, 0.08);
  const hover = 1 - smoothstep(16, 48, Math.hypot(cx - tx, cy - ty));
  // focus rides the thumb while it is held, then racks to the number as it settles
  const rack = ease.inOut(inv(1.25, 1.9, t));
  return {
    v, horizon: days(v), value: forecastAt(days(v)).mid,
    cursor: { x: cx, y: cy, kind: hover > 0.3 || press > 0.1 ? 'hand' : 'arrow', press },
    hover, press,
    focus: [lerp(tx, 900, rack), lerp(ty, 560, rack)],
  };
}

const camera: CameraKeys = [
  [0.0, { look: [700, 360], distance: 12.2, azimuth: -46, elevation: 25, roll: 8, fov: 30, aperture: 0.3 }],
  [2.3, { look: [766, 371], distance: 11.35, azimuth: -44, elevation: 24, roll: 7, fov: 30, aperture: 0.3 }],
];

function draw(ctx: Ctx, w: number, h: number, _t: number, s: HorizonState): void {
  ctx.fillStyle = M.page;
  ctx.fillRect(0, 0, w, h);

  // the controls, upper left: the cause
  tabs(ctx, [{ label: 'Revenue', x: 190 }, { label: 'Users', x: 318 }, { label: 'ARR', x: 420 }], 0, 118, { size: 20 });
  hline(ctx, 160, 860, 152);
  micro(ctx, 'Forecast horizon', SL.x0, 212, { size: 15, color: M.ink2 });
  txt(ctx, `${Math.round(s.horizon)} days`, SL.x1, 216, { size: 28, weight: 500, fam: 'mono', align: 'right' });
  slider(ctx, SL.x0, SL.x1, SL.y, s.v, s.hover, s.press, { weight: 3, r: 14 });
  micro(ctx, 'Confidence', SL.x0, 330, { size: 15 });
  txt(ctx, '80%', SL.x1, 332, { size: 24, weight: 500, fam: 'mono', align: 'right', color: M.ink2 });
  slider(ctx, SL.x0, SL.x1, CONF.y, CONF.v, 0, 0, { dim: true });
  vline(ctx, 900, 60, 360);

  // the forecast, upper right, far from the lens
  micro(ctx, 'Net revenue · 120 d + forecast', CHART.x, 96);
  const X = (i: number) => CHART.x + (i / (LAST + MAX_H)) * CHART.w;
  const Y = (v: number) => CHART.y + CHART.h - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * CHART.h;
  hline(ctx, CHART.x, CHART.x + CHART.w, CHART.y + CHART.h, M.line);
  ctx.save();
  ctx.beginPath();
  monotonePath(ctx, revenue.values.map((v, i) => [X(i), Y(v)]));
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  const seq: ForecastPoint[] = [];
  for (let d = 0; d <= Math.floor(s.horizon); d++) seq.push(FC_MAX[d]);
  seq.push(forecastAt(s.horizon));
  ctx.beginPath();
  polyline(ctx, seq.map((p) => [X(p.i), Y(p.hi)]));
  for (let j = seq.length - 1; j >= 0; j--) ctx.lineTo(X(seq[j].i), Y(seq[j].lo));
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = M.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  polyline(ctx, seq.map((p) => [X(p.i), Y(p.mid)]));
  ctx.stroke();
  ctx.restore();
  const e = seq[seq.length - 1];
  ctx.beginPath();
  ctx.arc(X(e.i), Y(e.mid), 5, 0, Math.PI * 2);
  ctx.fillStyle = M.page;
  ctx.fill();
  ctx.strokeStyle = M.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  vline(ctx, X(LAST), CHART.y - 6, CHART.y + CHART.h, 'rgba(255,255,255,0.25)');

  // the projection, big: the effect
  const GX = 560;
  micro(ctx, 'Projected net revenue', GX + 6, 432);
  txt(ctx, `by ${dateAfter(s.horizon, true)}`, GX + 6, 466, { size: 20, color: M.ink2 });
  odometer(ctx, s.value / 1e6, GX, 650, { size: 210, weight: 600, spacing: -7 });
  txt(ctx, `+${((s.value / revenue.headline - 1) * 100).toFixed(1)}%`, GX + 6, 712, { size: 28, weight: 500, fam: 'mono' });
  micro(ctx, 'vs today $4.28M', GX + 140, 710);
  hline(ctx, GX, w - 60, 742);

  // the foreground: the horizon itself, nearest to the lens
  odometer(ctx, s.horizon, 470, 985, { size: 330, weight: 400, prefix: '', suffix: ' d', decimals: 0, color: '#3a3a3a', spacing: -10 });

  cursor(ctx, s.cursor.x, s.cursor.y, s.cursor);
}

export default { id: 'horizon', duration: 2.3, size: { w: W, h: H }, camera, state, draw } satisfies Shot<HorizonState>;
