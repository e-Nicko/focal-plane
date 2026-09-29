// Shots "Overview" (the opening) and "Outro" (the close):
// the whole dashboard page at an angle.
// The opening finds the headline out of the blur, then lets the eye travel to the chart.
// The outro pulls back over the same page after the story has happened —
// forecast on, a 90-day horizon, the outliers ringed —
// and the film fades out.

import { M, txt, micro, hline, vline, tabs, monotonePath, polyline, grey, lerp, inv, ease, type Ctx } from '../../kit/index.js';
import type { CameraKeys, Shot, ShotState } from '../../engine/types.js';
import { revenue, REVENUE_N, revenueForecast, kpis, heatmap, allocation, risk } from '../data.js';

// What moves in this shot, besides the focus.
// tab: the active navigation tab as a fractional index.
// forecast, anomaly: 0..1, how far the story has switched them on.
interface OverviewState extends ShotState {
  tab: number;
  forecast: number;
  anomaly: number;
}

const W = 1600, H = 1000;
const LAST = REVENUE_N - 1;
const CHART = { x: 800, y: 180, w: 700, h: 220 };
const FC90 = revenueForecast(90);

export const NAV = [
  { label: 'Overview', x: 330 }, { label: 'Revenue', x: 470 }, { label: 'Forecast', x: 604 },
  { label: 'Risk', x: 744 }, { label: 'Reports', x: 826 },
];

function spark(ctx: Ctx, series: number[], x: number, y: number, w: number, h: number): void {
  let lo = Infinity, hi = -Infinity;
  for (const v of series) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const pts = series.map((v, i) => [x + (i / (series.length - 1)) * w, y + h - ((v - lo) / (hi - lo)) * h]);
  ctx.save();
  ctx.beginPath();
  monotonePath(ctx, pts);
  ctx.strokeStyle = '#d8d8d8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  const e = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(e[0], e[1], 4, 0, Math.PI * 2);
  ctx.fillStyle = M.ink;
  ctx.fill();
}

function draw(ctx: Ctx, w: number, h: number, _t: number, s: OverviewState): void {
  ctx.fillStyle = M.page;
  ctx.fillRect(0, 0, w, h);

  // nav
  micro(ctx, 'Focal', 90, 80, { size: 15, color: M.ink, spacing: 3 });
  tabs(ctx, NAV, s.tab, 80, { size: 18 });
  micro(ctx, 'Q3 2026', w - 150, 80, { size: 14, color: M.ink2 });
  ctx.beginPath();
  ctx.arc(w - 96, 74, 13, 0, Math.PI * 2);
  ctx.strokeStyle = M.line2;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  hline(ctx, 60, w - 60, 116);

  // headline
  micro(ctx, 'Net revenue · daily · Q3 2026', 90, 200, { size: 14 });
  txt(ctx, '$4.28M', 82, 350, { size: 168, weight: 600, spacing: -6 });
  const dw = txt(ctx, '+12.4%', 90, 408, { size: 26, weight: 500, fam: 'mono' });
  txt(ctx, '  vs $3.81M same day, prior period', 90 + dw, 408, { size: 20, color: M.ink3 });

  // chart: 120 days, and the 90-day forecast once the story has switched it on
  const ext = 90 * s.forecast;
  const domain = LAST + 90;
  const yMin = 2.7e6, yMax = FC90[FC90.length - 1].hi * 1.02;
  const cx = (i: number) => CHART.x + (i / domain) * CHART.w;
  const cy = (v: number) => CHART.y + CHART.h - ((v - yMin) / (yMax - yMin)) * CHART.h;
  for (let r = 0; r <= 3; r++) hline(ctx, CHART.x, CHART.x + CHART.w, CHART.y + (CHART.h * r) / 3, 'rgba(255,255,255,0.05)');
  const pts = revenue.values.map((v, i) => [cx(i), cy(v)]);
  const g = ctx.createLinearGradient(0, CHART.y, 0, CHART.y + CHART.h);
  g.addColorStop(0, 'rgba(255,255,255,0.09)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  monotonePath(ctx, pts);
  ctx.lineTo(pts[LAST][0], CHART.y + CHART.h);
  ctx.lineTo(pts[0][0], CHART.y + CHART.h);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  monotonePath(ctx, pts);
  ctx.strokeStyle = '#e4e4e4';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.restore();
  if (ext > 0.5) {
    const seq = FC90.slice(0, Math.floor(ext) + 1);
    ctx.beginPath();
    polyline(ctx, seq.map((p) => [cx(p.i), cy(p.hi)]));
    for (let j = seq.length - 1; j >= 0; j--) ctx.lineTo(cx(seq[j].i), cy(seq[j].lo));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.save();
    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = M.ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    polyline(ctx, seq.map((p) => [cx(p.i), cy(p.mid)]));
    ctx.stroke();
    ctx.restore();
    const e = seq[seq.length - 1];
    txt(ctx, `$${(e.mid / 1e6).toFixed(2)}M`, cx(e.i) - 6, cy(e.mid) - 20, { size: 22, weight: 500, fam: 'mono', align: 'right', alpha: s.forecast });
  }
  if (s.anomaly > 0) {
    for (const a of revenue.anomalies) {
      ctx.beginPath();
      ctx.arc(pts[a.i][0], pts[a.i][1], 9, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * s.anomaly})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }
  micro(ctx, 'Last 120 days', CHART.x, CHART.y + CHART.h + 32, { size: 13 });

  hline(ctx, 60, w - 60, 462);

  // KPI row
  const tiles = [...kpis, { label: 'Risk score', value: `${risk.score}/100`, delta: risk.label, series: null }];
  const tw = (w - 120) / 4;
  tiles.forEach((tile, i) => {
    const x0 = 60 + i * tw + 30;
    if (i) vline(ctx, 60 + i * tw, 480, 720);
    micro(ctx, tile.label, x0, 520, { size: 14 });
    txt(ctx, tile.value, x0 - 3, 600, { size: 60, weight: 600, spacing: -2 });
    txt(ctx, tile.delta, x0, 640, { size: 18, weight: 500, fam: 'mono', color: M.ink2 });
    if (tile.series) spark(ctx, tile.series, x0 + 150, 622, tw - 210, 60);
    else {
      // risk as a thin segmented scale
      for (let k = 0; k < 20; k++) {
        ctx.fillStyle = k / 20 < risk.score / 100 ? M.ink : M.track;
        ctx.fillRect(x0 + 150 + k * 9, 650, 6, 22);
      }
    }
  });

  hline(ctx, 60, w - 60, 740);

  // bottom row: allocation, sessions by hour, the model
  micro(ctx, 'Allocation', 90, 790, { size: 14 });
  let ax = 90;
  const shades = ['#ececec', '#a8a8a8', '#747474', '#4a4a4a', '#2e2e2e'];
  allocation.segments.forEach((sg, i) => {
    const bw = 460 * sg.v;
    ctx.fillStyle = shades[i];
    ctx.fillRect(ax, 812, bw - 4, 26);
    if (sg.v > 0.14) txt(ctx, `${Math.round(sg.v * 100)}%`, ax, 870, { size: 16, fam: 'mono', color: M.ink2 });
    ax += bw;
  });
  micro(ctx, 'Sessions by hour', 640, 790, { size: 14 });
  heatmap.cells.forEach((row, d) => row.forEach((v, hh) => {
    ctx.fillStyle = grey(Math.pow(v, 1.6), 0x16, 0xe8);
    ctx.fillRect(640 + hh * 18, 808 + d * 18, 15, 15);
  }));
  micro(ctx, 'Model', 1120, 790, { size: 14 });
  txt(ctx, 'Forecast engine v4.2', 1120, 838, { size: 22, weight: 500 });
  txt(ctx, 'Retrained 3 h ago · MAPE 2.1%', 1120, 872, { size: 16, fam: 'mono', color: M.ink3 });

  hline(ctx, 60, w - 60, 940);
}

export function makeOverview({ id, duration, outro = false }: { id: string; duration: number; outro?: boolean }): Shot<OverviewState> {
  const camera: CameraKeys = outro
    ? [
        [0.0, { look: [820, 470], distance: 13.6, azimuth: -24, elevation: 36, roll: -3, fov: 28, aperture: 0.32 }],
        [duration, { look: [800, 500], distance: 17.2, azimuth: -20, elevation: 40, roll: -2, fov: 28, aperture: 0.28 }],
      ]
    : [
        [0.0, { look: [560, 330], distance: 13.2, azimuth: -40, elevation: 27, roll: 5, fov: 28, aperture: 0.38 }],
        [duration, { look: [640, 350], distance: 12.2, azimuth: -36, elevation: 28, roll: 4, fov: 28, aperture: 0.38 }],
      ];

  function state(t: number): OverviewState {
    if (outro) return { tab: 2, forecast: 1, anomaly: 1, focus: [880, 330] };
    // focus: out of the blur onto the headline, then over to the chart
    const a = [720, 700], b = [330, 300], c = [980, 300];
    const k1 = ease.sine(inv(0.1, 0.9, t)), k2 = ease.sine(inv(1.3, 2.0, t));
    return {
      tab: 0, forecast: 0, anomaly: 0,
      focus: [lerp(lerp(a[0], b[0], k1), c[0], k2), lerp(lerp(a[1], b[1], k1), c[1], k2)],
    };
  }

  return { id, duration, size: { w: W, h: H }, camera, state, draw };
}
