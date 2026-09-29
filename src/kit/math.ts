// Small, deterministic math for shots.
// Everything here is pure:
// the same input gives the same output on every machine,
// so any frame of a film can be rendered out of order.

// A point on a page, in page pixels.
export type Vec2 = [x: number, y: number];

export const clamp = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));

export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

// Progress of v between a and b, clamped to 0..1.
export const inv = (a: number, b: number, v: number): number => clamp((v - a) / (b - a));

export const smoothstep = (a: number, b: number, v: number): number => {
  const k = inv(a, b, v);
  return k * k * (3 - 2 * k);
};

// A window in time:
// rises over [a, a + fin], holds, falls over [b - fout, b].
// Presses, hovers and labels are all windows.
export const pulse = (t: number, a: number, b: number, fin = 0.25, fout = 0.25): number =>
  smoothstep(a, a + fin, t) * (1 - smoothstep(b - fout, b, t));

export const ease = {
  inOut: (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  out: (k: number): number => 1 - Math.pow(1 - k, 3),
  sine: (k: number): number => -(Math.cos(Math.PI * k) - 1) / 2,
  outBack: (k: number): number => {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  },
};

// A seeded random generator, numbers in 0..1 (mulberry32).
// The same seed gives the same numbers on every machine,
// which is what a film needs from randomness.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A roughly normal number with mean 0 and standard deviation 1:
// the sum of six uniform numbers, rescaled.
export const gauss = (rnd: () => number): number => {
  let s = 0;
  for (let i = 0; i < 6; i++) s += rnd();
  return (s - 3) / Math.sqrt(0.5);
};

// A key of a spline: a time and the values at that time.
export type Key = [t: number, values: number[]];

// Hermite interpolation through timed keys [[t, [v0, v1, ...]], ...].
// Inner tangents are Catmull-Rom and respect uneven timing;
// end tangents are zero,
// so a move eases out of its first key and into its last.
export function spline(keys: Key[], t: number): number[] {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1].slice();
  if (t >= keys[n - 1][0]) return keys[n - 1][1].slice();
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const [t0, p0] = keys[i], [t1, p1] = keys[i + 1];
  const dt = t1 - t0, u = (t - t0) / dt;
  const tangent = (j: number): number[] => {
    if (j === 0 || j === n - 1) return p0.map(() => 0);
    const [ta, pa] = keys[j - 1], [tb, pb] = keys[j + 1];
    return pa.map((_, c) => (pb[c] - pa[c]) / (tb - ta));
  };
  const m0 = tangent(i), m1 = tangent(i + 1);
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return p0.map((_, c) => h00 * p0[c] + h10 * dt * m0[c] + h01 * p1[c] + h11 * dt * m1[c]);
}
