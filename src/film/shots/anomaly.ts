// Shot "Anomaly":
// a calm frontal chart of the last 60 days.
// The hand switches the view from Line to Points;
// the curve turns into its data points drawn as nodes,
// a band of ±2.5σ sweeps in,
// and the outlier is ringed and named.
// The Solid → Vector letter of a type specimen, translated into data.
//
// The outliers are computed here, not asserted,
// and the detector does not know where they were planted:
// a day's expected value is the median of its three neighbours on each side,
// sigma is the median absolute deviation of the residuals, scaled to a normal σ,
// and an outlier is any day outside the band.
// Medians are barely moved by the outliers they are meant to find.

import { M, txt, micro, hline, cursor, ripple, roundRect, monotonePath, polyline, grey, clamp, lerp, inv, pulse, smoothstep, ease, type Ctx, type CursorState, type Vec2 } from '../../kit/index.js';
import type { CameraKeys, Shot, ShotState } from '../../engine/types.js';
import { revenue, dayLabel, REVENUE_N } from '../data.js';

// seg: the Line | Points switch, morph: line into nodes, band: the ±σ ribbon sweeping in,
// ring: the outliers being ringed, label: the hero's label.
interface AnomalyState extends ShotState {
  cursor: CursorState;
  hover: number;
  ripple: number;
  seg: number;
  morph: number;
  band: number;
  ring: number;
  label: number;
}

// z is the distance from the expected value, in sigmas.
interface Outlier {
  i: number;
  z: number;
}

const W = 1400, H = 900;
const PLOT = { x: 170, y: 270, w: 1080, h: 400 };
const I0 = 60, I1 = REVENUE_N - 1;         // the last 60 days
const SIG_K = 2.5;
const CLICK = 0.62;
const SEG = { x: 560, y: 118, w: 150, h: 48 };  // two segments: Line | Points

const V = revenue.values, NN = V.length;
const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const EXPECTED = V.map((_, i) => {
  const near: number[] = [];
  for (let j = i - 3; j <= i + 3; j++) if (j !== i && j >= 0 && j < NN) near.push(V[j]);
  return median(near);
});
const RESID = V.map((x, i) => x - EXPECTED[i]);
const SD = 1.4826 * median(RESID.map((r) => Math.abs(r - median(RESID))));
const OUTLIERS: Outlier[] = [];
for (let i = I0; i <= I1; i++) {
  const z = (V[i] - EXPECTED[i]) / SD;
  if (Math.abs(z) > SIG_K) OUTLIERS.push({ i, z });
}
const IS_OUT = new Set(OUTLIERS.map((o) => o.i));
// the outlier with the largest z
const HERO = OUTLIERS.reduce((a, o) => (o.z > a.z ? o : a), OUTLIERS[0]);
if (!HERO) throw new Error('The anomaly shot needs at least one outlier in the last 60 days of the data.');

const Y_MIN = Math.min(...V.slice(I0)) - 0.12e6;
const Y_MAX = Math.max(...V.slice(I0)) + 0.12e6;
const X = (i: number): number => PLOT.x + ((i - I0) / (I1 - I0)) * PLOT.w;
const Y = (v: number): number => PLOT.y + PLOT.h - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT.h;

function state(t: number): AnomalyState {
  const target: Vec2 = [SEG.x + SEG.w * 1.5 + 14, SEG.y + SEG.h / 2 + 12];
  const k = ease.inOut(inv(0.0, 0.5, t));
  const drift = ease.inOut(inv(1.0, 2.4, t));
  const cx = lerp(930, target[0], k) + drift * 40, cy = lerp(470, target[1], k) + drift * 26;
  const hover = 1 - smoothstep(20, 70, Math.hypot(cx - target[0], cy - target[1]));
  const rack = ease.inOut(inv(0.85, 1.45, t));
  const hero: Vec2 = [X(HERO.i), Y(V[HERO.i])];
  return {
    cursor: { x: cx, y: cy, press: pulse(t, CLICK - 0.06, CLICK + 0.14, 0.05, 0.08), kind: hover > 0.3 ? 'hand' : 'arrow' },
    hover,
    ripple: t > CLICK ? (t - CLICK) / 0.7 : 0,
    seg: ease.inOut(inv(CLICK, CLICK + 0.22, t)),
    morph: ease.inOut(inv(0.66, 1.3, t)),
    band: ease.inOut(inv(0.75, 1.35, t)),
    ring: clamp((t - 1.3) / 0.3),
    label: smoothstep(1.45, 1.85, t),
    // focus: the switch (the cause), then the outlier (the effect)
    focus: [lerp(SEG.x + SEG.w, hero[0], rack), lerp(SEG.y + SEG.h / 2, hero[1], rack)],
  };
}

const camera: CameraKeys = [
  [0.0, { look: [720, 430], distance: 12.6, azimuth: -7, elevation: 55, roll: -1.5, fov: 28, aperture: 0.42 }],
  [2.6, { look: [760, 445], distance: 11.6, azimuth: -5, elevation: 57, roll: -1.0, fov: 28, aperture: 0.42 }],
];

function draw(ctx: Ctx, w: number, h: number, _t: number, s: AnomalyState): void {
  ctx.fillStyle = M.page;
  ctx.fillRect(0, 0, w, h);

  // the segmented control
  roundRect(ctx, SEG.x - 4.5, SEG.y - 4.5, SEG.w * 2 + 9, SEG.h + 9, 14);
  ctx.strokeStyle = M.line2;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (s.hover > 0.001) {
    roundRect(ctx, SEG.x - 10.5, SEG.y - 10.5, SEG.w * 2 + 21, SEG.h + 21, 19);
    ctx.strokeStyle = `rgba(255,255,255,${0.2 * s.hover})`;
    ctx.stroke();
  }
  roundRect(ctx, lerp(SEG.x, SEG.x + SEG.w, s.seg), SEG.y, SEG.w, SEG.h, 10);
  ctx.fillStyle = M.ink;
  ctx.fill();
  ['Line', 'Points'].forEach((lb, i) => {
    const on = i === 0 ? 1 - s.seg : s.seg;
    txt(ctx, lb, SEG.x + SEG.w * (i + 0.5), SEG.y + SEG.h / 2 + 7, { size: 20, weight: 500, align: 'center', color: grey(on, 0x9a, 0x0c) });
  });
  micro(ctx, 'View', SEG.x - 34, SEG.y + SEG.h / 2 + 5, { size: 14, align: 'right' });

  // the expected range, as a soft ribbon with dashed edges
  const bandAt = (i: number, k: number): number => Y(EXPECTED[i] + k * SIG_K * SD);
  if (s.band > 0.001) {
    const iEnd = Math.max(I0 + 1, Math.round(lerp(I0, I1, s.band)));
    const path = (k: number): Vec2[] => { const p: Vec2[] = []; for (let i = I0; i <= iEnd; i++) p.push([X(i), bandAt(i, k)]); return p; };
    const hi = path(1), lo = path(-1);
    ctx.beginPath();
    monotonePath(ctx, hi);
    for (let j = lo.length - 1; j >= 0; j--) ctx.lineTo(lo[j][0], lo[j][1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fill();
    const lines: [Vec2[], number[], number][] = [[hi, [4, 6], 0.3], [lo, [4, 6], 0.3], [path(0), [], 0.22]];
    for (const [p, dash, a] of lines) {
      ctx.save();
      ctx.setLineDash(dash);
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      monotonePath(ctx, p);
      ctx.stroke();
      ctx.restore();
    }
    const la = smoothstep(0.3, 0.8, s.band);
    micro(ctx, `+${SIG_K}σ`, PLOT.x - 16, bandAt(I0, 1) + 4, { size: 13, align: 'right', alpha: la });
    micro(ctx, 'Expected', PLOT.x - 16, bandAt(I0, 0) + 4, { size: 13, align: 'right', alpha: la });
    micro(ctx, `−${SIG_K}σ`, PLOT.x - 16, bandAt(I0, -1) + 4, { size: 13, align: 'right', alpha: la });
  }

  // the series: the line morphs into nodes
  const pts: Vec2[] = [];
  for (let i = I0; i <= I1; i++) pts.push([X(i), Y(V[i])]);
  if (s.morph < 0.999) {
    const g = ctx.createLinearGradient(0, PLOT.y, 0, PLOT.y + PLOT.h);
    g.addColorStop(0, `rgba(255,255,255,${0.1 * (1 - s.morph)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    monotonePath(ctx, pts);
    ctx.lineTo(pts[pts.length - 1][0], PLOT.y + PLOT.h);
    ctx.lineTo(pts[0][0], PLOT.y + PLOT.h);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.save();
  ctx.beginPath();
  if (s.morph > 0.5) polyline(ctx, pts);
  else monotonePath(ctx, pts);
  ctx.strokeStyle = `rgba(236,236,236,${lerp(1, 0.28, s.morph)})`;
  ctx.lineWidth = lerp(3, 1.1, s.morph);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
  pts.forEach((p, j) => {
    const appear = clamp((s.morph * 1.25 - j / pts.length) * 6);
    if (appear <= 0) return;
    const out = IS_OUT.has(I0 + j);
    const sz = (out ? 9 : 6.5) * ease.outBack(appear);
    ctx.fillStyle = out ? M.ink : M.page;
    ctx.fillRect(p[0] - sz / 2, p[1] - sz / 2, sz, sz);
    ctx.strokeStyle = M.ink;
    ctx.lineWidth = 1.3;
    ctx.strokeRect(p[0] - sz / 2, p[1] - sz / 2, sz, sz);
  });

  // the outliers, ringed and named
  for (const o of OUTLIERS) {
    const px = X(o.i), py = Y(V[o.i]);
    const hero = o === HERO;
    const k = hero ? s.ring : clamp(s.ring * 1.2 - 0.2);
    if (k <= 0) continue;
    ctx.beginPath();
    ctx.arc(px, py, (hero ? 22 : 15) * ease.outBack(k), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * k})`;
    ctx.lineWidth = hero ? 1.8 : 1.2;
    ctx.stroke();
    if (!hero) micro(ctx, `${o.z > 0 ? '+' : '−'}${Math.abs(o.z).toFixed(1)}σ`, px, py + 42, { size: 14, align: 'center', alpha: k, color: M.ink2 });
  }
  if (s.label > 0.001) {
    const px = X(HERO.i), py = Y(V[HERO.i]);
    const up = (1 - ease.out(s.label)) * 12;
    txt(ctx, `+${HERO.z.toFixed(1)}σ`, px - 40, py - 44 + up, { size: 64, weight: 600, align: 'right', spacing: -2, alpha: s.label });
    micro(ctx, `${dayLabel(HERO.i, REVENUE_N)} · above expected`, px - 42, py - 118 + up, { size: 15, align: 'right', alpha: s.label, color: M.ink2 });
  }

  // the frame
  hline(ctx, 80, w - 80, PLOT.y + PLOT.h + 46);
  micro(ctx, `Outliers · ${OUTLIERS.length} of 60 days`, PLOT.x, PLOT.y + PLOT.h + 86, { size: 14 });
  micro(ctx, `Sensitivity ${SIG_K}σ`, PLOT.x + PLOT.w, PLOT.y + PLOT.h + 86, { size: 14, align: 'right' });
  txt(ctx, dayLabel(I0, REVENUE_N), PLOT.x, PLOT.y + PLOT.h + 26, { size: 13, fam: 'mono', color: M.ink3 });
  txt(ctx, dayLabel(I1, REVENUE_N), PLOT.x + PLOT.w, PLOT.y + PLOT.h + 26, { size: 13, fam: 'mono', color: M.ink3, align: 'right' });

  ripple(ctx, SEG.x + SEG.w * 1.5, SEG.y + SEG.h / 2, s.ripple);
  cursor(ctx, s.cursor.x, s.cursor.y, s.cursor);
}

export default { id: 'anomaly', duration: 2.6, size: { w: W, h: H }, camera, state, draw } satisfies Shot<AnomalyState>;
