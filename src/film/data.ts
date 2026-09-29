// Sample data for the example film:
// the Q3 dashboard of a fictional analytics product.
// Deterministic by construction —
// a seeded PRNG and arithmetic, no Math.random, no clock —
// so every run and every machine sees the same numbers.
// The numbers also agree with each other across shots:
// the headline, the prior period, the forecast and the outliers are one story.

import { mulberry32, gauss } from '../kit/index.js';

// ---------- dates ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const END_DAY = Date.UTC(2026, 8, 26);           // the last day of data, "today": 26 Sep 2026
const fmtDate = (d: Date, withYear: boolean): string => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${withYear ? ', ' + d.getUTCFullYear() : ''}`;

// Label of day i in a series of n days that ends today.
export function dayLabel(i: number, n: number, withYear = false): string {
  return fmtDate(new Date(END_DAY - (n - 1 - i) * 86400000), withYear);
}

// Label of the day that comes `days` after today.
export function dateAfter(days: number, withYear = false): string {
  return fmtDate(new Date(END_DAY + Math.round(days) * 86400000), withYear);
}

// ---------- daily net revenue, last 120 days ----------
export const REVENUE_N = 120;

// The daily series, the prior period, the days planted as outliers, and the headline figures.
export interface Revenue {
  values: number[];
  prev: number[];
  anomalies: { i: number; dv: number }[];
  headline: number;
  delta: number;
}

export const revenue: Revenue = (() => {
  const rnd = mulberry32(20260927);
  const n = REVENUE_N, v: number[] = [], prev: number[] = [];
  let walk = 0, walk2 = 0;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    walk = walk * 0.86 + gauss(rnd) * 0.026e6;
    walk2 = walk2 * 0.86 + gauss(rnd) * 0.022e6;
    const base = 3.18e6 + 1.1e6 * Math.pow(k, 1.15);
    const weekly = 0.034e6 * Math.sin((2 * Math.PI * i) / 7 + 0.8);
    v.push(base + weekly + walk);
    prev.push(2.86e6 + 0.78e6 * Math.pow(k, 1.05) + weekly * 0.8 + walk2);
  }
  // the last value is the headline figure
  const fix = 4.28e6 - v[n - 1];
  for (let i = 0; i < n; i++) v[i] += fix * Math.pow(i / (n - 1), 2);
  // the prior period ends at headline / (1 + delta),
  // so "+12.4% vs $3.81M" names a value the chart actually reaches
  const fixP = 4.28e6 / 1.124 - prev[n - 1];
  for (let i = 0; i < n; i++) prev[i] += fixP * Math.pow(i / (n - 1), 2);
  // three real outliers, planted where the detector in the anomaly shot will find them
  const anomalies = [{ i: 38, dv: 0.21e6 }, { i: 71, dv: -0.17e6 }, { i: 97, dv: 0.15e6 }];
  for (const a of anomalies) v[a.i] += a.dv;
  return { values: v, prev, anomalies, headline: 4.28e6, delta: 12.4 };
})();

// The linear trend of the last 30 days, which the forecast extends.
const trend = (() => {
  const v = revenue.values, n = v.length, m = 30;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let j = 0; j < m; j++) { const y = v[n - m + j]; sx += j; sy += y; sxx += j * j; sxy += j * y; }
  const slope = (m * sxy - sx * sy) / (m * sxx - sx * sx);
  let res = 0;
  for (let j = 0; j < m; j++) res += (v[n - m + j] - (sy / m + slope * (j - sx / m))) ** 2;
  return { slope, sigma: Math.sqrt(res / m) };
})();

// One day of the forecast: the middle line and the band around it.
export interface ForecastPoint {
  i: number;
  mid: number;
  lo: number;
  hi: number;
}

// Forecast days 0..days after today.
// z is the half-width of the band in sigmas (1.28 = an 80% band).
export function revenueForecast(days: number, z = 1.28): ForecastPoint[] {
  const n = REVENUE_N, last = revenue.values[n - 1], out: ForecastPoint[] = [];
  for (let d = 0; d <= Math.ceil(days); d++) {
    const mid = last + trend.slope * d * 0.92 + 0.02e6 * Math.sin((2 * Math.PI * (n - 1 + d)) / 7 + 0.8) * Math.min(1, d / 4);
    const half = z * trend.sigma * Math.sqrt(d) * 1.6;
    out.push({ i: n - 1 + d, mid, lo: mid - half, hi: mid + half });
  }
  return out;
}

// ---------- the rest of the page ----------
export const allocation = {
  total: 18.64e6,
  segments: [
    { name: 'Equities', v: 0.41 }, { name: 'Fixed income', v: 0.23 }, { name: 'Digital assets', v: 0.15 },
    { name: 'Commodities', v: 0.12 }, { name: 'Cash', v: 0.09 },
  ],
};

function spark(seed: number, n: number, drift: number, vol: number): number[] {
  const rnd = mulberry32(seed), out: number[] = [];
  let v = 1;
  for (let i = 0; i < n; i++) { v += drift + gauss(rnd) * vol; out.push(v); }
  return out;
}
// Each sparkline rises, like the delta next to it.
export const kpis = [
  { label: 'Active users', value: '128,430', delta: '+8.2%', series: spark(11, 28, 0.012, 0.03) },
  { label: 'Conversion', value: '4.72%', delta: '+0.6 pt', series: spark(40, 28, 0.004, 0.035) },
  { label: 'ARR', value: '$51.4M', delta: '+14.1%', series: spark(13, 28, 0.016, 0.025) },
];

export const risk = { score: 34, label: 'Low' };

// Sessions by weekday and hour, normalised by the maximum.
// Tuesday 11:00 is the single peak.
export const heatmap = (() => {
  const rnd = mulberry32(4242);
  const cells: number[][] = [];
  for (let d = 0; d < 7; d++) {
    const row: number[] = [], weekend = d >= 5 ? 0.55 : 1;
    for (let h = 0; h < 24; h++) {
      const morning = Math.exp(-((h - 10.5) ** 2) / 6);
      const afternoon = Math.exp(-((h - 15.5) ** 2) / 5) * 0.85;
      const evening = Math.exp(-((h - 20.5) ** 2) / 4) * (d >= 5 ? 0.9 : 0.45);
      row.push((0.06 + (morning + afternoon) * weekend + evening) * (0.82 + rnd() * 0.3));
    }
    cells.push(row);
  }
  let max = 0;
  for (const row of cells) for (const v of row) max = Math.max(max, v);
  for (const row of cells) for (let h = 0; h < 24; h++) row[h] = Math.min(0.97, row[h] / max);
  cells[1][11] = 1;
  return { cells };
})();
