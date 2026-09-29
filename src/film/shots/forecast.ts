// Shot "Forecast":
// a calm, near-frontal look at the revenue chart.
// The cursor clicks the Forecast toggle in the top right,
// and the projection grows out of today's point in the same frame.
// Focus starts on the toggle (the cause)
// and racks to the end of the forecast (the effect).

import { M, txt, micro, hline, toggle, ripple, cursor, TOG, monotonePath, polyline, lerp, inv, pulse, smoothstep, ease, type Ctx, type CursorState } from '../../kit/index.js';
import type { CameraKeys, Shot, ShotState } from '../../engine/types.js';
import { revenue, REVENUE_N, revenueForecast, dayLabel, dateAfter } from '../data.js';

// on: the toggle, 0..1; draw: how much of the forecast is drawn; label: the projected value fading in.
interface ForecastState extends ShotState {
  cursor: CursorState;
  hover: number;
  press: number;
  on: number;
  ripple: number;
  draw: number;
  label: number;
}

const W = 1400, H = 800;
const PLOT = { x: 90, y: 352, w: 1150, h: 330 };
const TOGGLE_AT = { x: 1236, y: 150 };
const TS = 1.4;                            // the toggle at display scale
const TW = TOG.w * TS, TH = TOG.h * TS;
const HORIZON = 30;
const LAST = REVENUE_N - 1;
const CLICK = 0.6;

const FC = revenueForecast(HORIZON);
const Y_MIN = 2.7e6;
const Y_MAX = Math.max(...revenue.values, FC[FC.length - 1].hi) * 1.02;

function state(t: number): ForecastState {
  // from the chart up to the toggle, a click, then a small settle off the knob
  const tc = { x: TOGGLE_AT.x + TW / 2 + 8, y: TOGGLE_AT.y + TH / 2 + 10 };
  const start = { x: 1010, y: 610 };
  const k = ease.inOut(inv(0.0, 0.52, t));
  const bend = Math.sin(Math.PI * k) * 40;
  let cx = lerp(start.x, tc.x, k) - bend * 0.35, cy = lerp(start.y, tc.y, k) + bend * 0.2;
  cx += t - 0.52 > 0 && t - 0.52 < 0.5 ? Math.sin((t - 0.52) * 24) * Math.exp(-(t - 0.52) * 9) * 1.6 : 0;
  const drift = ease.inOut(inv(1.1, 2.4, t));
  cx += drift * -26;
  cy += drift * 30;
  const hover = 1 - smoothstep(24, 70, Math.hypot(cx - tc.x, cy - tc.y));
  const press = pulse(t, CLICK - 0.06, CLICK + 0.14, 0.05, 0.08);
  const rack = ease.sine(inv(0.85, 1.5, t));
  const a = [TOGGLE_AT.x + TW / 2, TOGGLE_AT.y + TH / 2];
  const b = [PLOT.x + PLOT.w * 0.86, PLOT.y + PLOT.h * 0.42];
  return {
    cursor: { x: cx, y: cy, kind: hover > 0.35 ? 'hand' : 'arrow', press },
    hover, press,
    on: ease.out(inv(CLICK, CLICK + 0.3, t)),
    ripple: t > CLICK ? (t - CLICK) / 0.8 : 0,
    draw: ease.sine(inv(0.72, 1.85, t)),
    label: smoothstep(1.55, 2.0, t),
    focus: [lerp(a[0], b[0], rack), lerp(a[1], b[1], rack)],
  };
}

const camera: CameraKeys = [
  [0.0, { look: [1060, 300], distance: 9.4, azimuth: -17, elevation: 41, roll: -3, fov: 26, aperture: 0.42 }],
  [2.5, { look: [1092, 311], distance: 8.7, azimuth: -14, elevation: 42, roll: -2.4, fov: 26, aperture: 0.42 }],
];

function draw(ctx: Ctx, w: number, h: number, _t: number, s: ForecastState): void {
  ctx.fillStyle = M.page;
  ctx.fillRect(0, 0, w, h);

  // header
  micro(ctx, 'Net revenue · daily', 90, 108);
  txt(ctx, '$4.28M', 84, 214, { size: 104, weight: 600, spacing: -3 });
  const dw = txt(ctx, '+12.4%', 90, 258, { size: 20, weight: 500, fam: 'mono' });
  txt(ctx, '  vs $3.81M same day, prior period', 90 + dw, 258, { size: 18, color: M.ink3 });

  // the control: the cause
  txt(ctx, 'Forecast', TOGGLE_AT.x - 26, TOGGLE_AT.y + 32, { size: 28, weight: 500, align: 'right', color: s.on > 0.5 ? M.ink : M.ink2 });
  micro(ctx, `80% band · ${HORIZON} days`, TOGGLE_AT.x + TW, TOGGLE_AT.y + TH + 40, { align: 'right', color: s.on > 0.5 ? M.ink2 : M.ink4 });
  toggle(ctx, TOGGLE_AT.x, TOGGLE_AT.y, s.on, s.hover, s.press, TS);
  ripple(ctx, TOGGLE_AT.x + TW / 2, TOGGLE_AT.y + TH / 2, s.ripple);

  hline(ctx, 60, w - 60, 300);

  // the chart: the x-domain grows as the forecast draws, so history compresses a little
  const ext = HORIZON * s.draw;
  const X = (i: number): number => PLOT.x + (i / (LAST + ext)) * PLOT.w;
  const Y = (v: number): number => PLOT.y + PLOT.h - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT.h;
  for (let r = 0; r <= 4; r++) {
    const y = PLOT.y + (PLOT.h * r) / 4;
    hline(ctx, PLOT.x, PLOT.x + PLOT.w, y, 'rgba(255,255,255,0.055)');
    txt(ctx, `$${(lerp(Y_MAX, Y_MIN, r / 4) / 1e6).toFixed(1)}M`, w - 60, y + 5, { size: 13, fam: 'mono', color: M.ink3, align: 'right' });
  }
  for (let i = LAST % 28; i <= LAST; i += 28) {
    // today's tick hands its place to the TODAY marker once the forecast appears
    const a = i === LAST ? 1 - smoothstep(0, 0.2, s.draw) : 1;
    txt(ctx, dayLabel(i, REVENUE_N), X(i), PLOT.y + PLOT.h + 40, { size: 13, fam: 'mono', color: M.ink3, align: 'center', alpha: a });
  }

  const pts = revenue.values.map((v, i) => [X(i), Y(v)]);
  const prev = revenue.prev.map((v, i) => [X(i), Y(v)]);
  ctx.save();
  ctx.beginPath();
  monotonePath(ctx, prev);
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();
  const g = ctx.createLinearGradient(0, PLOT.y, 0, PLOT.y + PLOT.h);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  monotonePath(ctx, pts);
  ctx.lineTo(pts[LAST][0], PLOT.y + PLOT.h);
  ctx.lineTo(pts[0][0], PLOT.y + PLOT.h);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  monotonePath(ctx, pts);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // the forecast: the effect
  const today = pts[LAST];
  if (s.draw > 0.001) {
    ctx.save();
    ctx.globalAlpha = smoothstep(0, 0.2, s.draw);
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(today[0]) + 0.5, PLOT.y - 8);
    ctx.lineTo(Math.round(today[0]) + 0.5, PLOT.y + PLOT.h);
    ctx.stroke();
    ctx.setLineDash([]);
    micro(ctx, 'Today', today[0], PLOT.y + PLOT.h + 40, { align: 'center', color: M.ink });
    ctx.restore();

    const fl = Math.floor(ext), fr = ext - fl;
    const base = FC[fl], tail = FC[Math.min(FC.length - 1, fl + 1)];
    const end = { i: LAST + ext, mid: lerp(base.mid, tail.mid, fr), lo: lerp(base.lo, tail.lo, fr), hi: lerp(base.hi, tail.hi, fr) };
    const seq = [...FC.slice(0, fl + 1), end];
    ctx.beginPath();
    polyline(ctx, seq.map((p) => [X(p.i), Y(p.hi)]));
    for (let j = seq.length - 1; j >= 0; j--) ctx.lineTo(X(seq[j].i), Y(seq[j].lo));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); polyline(ctx, seq.map((p) => [X(p.i), Y(p.hi)])); ctx.stroke();
    ctx.beginPath(); polyline(ctx, seq.map((p) => [X(p.i), Y(p.lo)])); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.strokeStyle = M.ink;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    polyline(ctx, seq.map((p) => [X(p.i), Y(p.mid)]));
    ctx.stroke();
    ctx.restore();
    const ex = X(end.i), ey = Y(end.mid);
    ctx.beginPath();
    ctx.arc(ex, ey, 5, 0, Math.PI * 2);
    ctx.fillStyle = M.page;
    ctx.fill();
    ctx.strokeStyle = M.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (s.label > 0.001) {
      const up = (1 - ease.out(s.label)) * 10;
      micro(ctx, `${dateAfter(HORIZON)} · projected`, ex - 16, ey - 92 + up, { align: 'right', color: M.ink2, alpha: s.label });
      txt(ctx, `$${(FC[FC.length - 1].mid / 1e6).toFixed(2)}M`, ex - 12, ey - 28 + up, { size: 58, weight: 600, align: 'right', spacing: -1.5, alpha: s.label });
    }
  }

  // today's point
  ctx.beginPath();
  ctx.arc(today[0], today[1], 6, 0, Math.PI * 2);
  ctx.fillStyle = M.page;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(today[0], today[1], 4, 0, Math.PI * 2);
  ctx.fillStyle = M.ink;
  ctx.fill();

  hline(ctx, 60, w - 60, 770);
  cursor(ctx, s.cursor.x, s.cursor.y, s.cursor);
}

export default { id: 'forecast', duration: 2.5, size: { w: W, h: H }, camera, state, draw } satisfies Shot<ForecastState>;
