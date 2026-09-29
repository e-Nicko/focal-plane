// Makes the README media from the film itself:
// the animated cover (media/cover.gif), one still per shot (media/stills/),
// and the card that chat apps and GitHub show when the repository is linked (media/social.png).
//
// The cover is a short cut of the film,
// rendered offline at twice its size and scaled down.
// The film is monochrome, so the GIF palette holds only greys,
// placed by 1D k-means where the frames actually have pixels.
// Film grain is off for the cover:
// noise is the one thing a GIF cannot compress.
// After the first frame, a frame stores only the pixels that changed;
// the rest is transparent and shows the frame before.
//
// Usage: bun run media [--film=<name>] [--w=800] [--colors=64] [--step=0.07] [--no-cover] [--no-stills] [--no-social]

import { mkdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GIFEncoder } from 'gifenc';
import type { Page } from './cdp.js';
import { arg, flag, openCapture, reportErrors, startSession, type Session } from './common.js';
import { ROOT } from './server.js';

const MEDIA = join(ROOT, 'media');

interface ShotTime {
  id: string;
  start: number;
  duration: number;
}
type Shots = Record<string, ShotTime>;

// The cover cut: shot id, then shot-local in and out times.
// Each piece is the moment of the shot where its one idea happens.
const CUT: [id: string, from: number, to: number][] = [
  ['overview', 0.45, 1.95],
  ['forecast', 0.3, 2.3],
  ['horizon', 0.3, 2.1],
  ['months', 0.2, 2.0],
  ['anomaly', 0.4, 2.4],
];

// One still per shot, at a shot-local time.
const STILLS: [id: string, t: number][] = [
  ['overview', 1.2], ['tabs', 1.0], ['forecast', 0.7], ['horizon', 2.05],
  ['months', 1.2], ['anomaly', 2.2], ['outro', 1.5],
];

// Places k grey levels over a 256-bin histogram (Lloyd's algorithm in one dimension).
// The histogram is weighted by the square root of the counts:
// with raw counts the near-black page takes every level
// and the highlights band.
// Starting from quantiles puts more levels where there are more pixels;
// the levels start distinct, and in one dimension they stay distinct.
function greyPalette(counts: ArrayLike<number>, k: number): number[] {
  const hist = Array.from(counts, Math.sqrt);
  const total = hist.reduce((a, b) => a + b, 0);
  const centers: number[] = [];
  for (let j = 0, acc = 0, v = 0; j < k; j++) {
    const goal = ((j + 0.5) / k) * total;
    while (v < 255 && acc + hist[v] < goal) acc += hist[v++];
    centers.push(j ? Math.max(v, centers[j - 1] + 1) : v);
  }
  for (let iter = 0; iter < 30; iter++) {
    const sum = new Float64Array(k), cnt = new Float64Array(k);
    for (let v = 0; v < 256; v++) {
      if (!hist[v]) continue;
      let best = 0;
      for (let j = 1; j < k; j++) if (Math.abs(centers[j] - v) < Math.abs(centers[best] - v)) best = j;
      sum[best] += v * hist[v];
      cnt[best] += hist[v];
    }
    for (let j = 0; j < k; j++) if (cnt[j]) centers[j] = sum[j] / cnt[j];
  }
  return [...new Set(centers.map(Math.round))].sort((a, b) => a - b);
}

async function cover(page: Page, session: Session, shots: Shots, GW: number, GH: number, colors: number, step: number): Promise<void> {
  await page.evaluate(() => window.__film!.setGrade({ grain: 0, ca: 0 }));
  const times: number[] = [];
  for (const [id, a, b] of CUT) for (let t = a; t < b - 1e-6; t += step) times.push(shots[id].start + t);

  const frames: Uint8Array[] = [];
  const hist = new Float64Array(256);
  for (let i = 0; i < times.length; i++) {
    // the page renders the frame, scales it down, keeps the luma
    // and hands the bytes to the tool's server
    await page.evaluate(
      async ({ t, i, GW, GH, url }) => {
        window.__film!.renderAt(t, i);
        const scaled = new OffscreenCanvas(GW, GH);
        const g = scaled.getContext('2d', { willReadFrequently: true })!;
        g.imageSmoothingQuality = 'high';
        g.drawImage(document.querySelector<HTMLCanvasElement>('#film')!, 0, 0, GW, GH);
        const px = g.getImageData(0, 0, GW, GH).data, y = new Uint8Array(GW * GH);
        for (let p = 0; p < y.length; p++) y[p] = Math.round(0.2126 * px[p * 4] + 0.7152 * px[p * 4 + 1] + 0.0722 * px[p * 4 + 2]);
        const r = await fetch(url, { method: 'PUT', body: y });
        if (!r.ok) throw new Error(`upload failed: ${r.status}`);
      },
      { t: times[i], i, GW, GH, url: session.server.uploadUrl(`cover-${i}`) },
    );
    const y = session.server.inbox.get(`cover-${i}`)!;
    session.server.inbox.delete(`cover-${i}`);
    for (let p = 0; p < y.length; p++) hist[y[p]]++;
    frames.push(y);
    process.stdout.write(`\rcover frame ${i + 1}/${times.length}`);
  }

  // index 0 is the transparent colour, the greys follow
  const greys = greyPalette(hist, colors - 1);
  const palette = [[0, 0, 0], ...greys.map((v) => [v, v, v])];
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    let best = 0;
    for (let j = 1; j < greys.length; j++) if (Math.abs(greys[j] - v) < Math.abs(greys[best] - v)) best = j;
    lut[v] = best + 1;
  }
  const depth = Math.max(2, Math.ceil(Math.log2(palette.length)));
  const gif = GIFEncoder();
  const shown = new Uint8Array(GW * GH);   // palette index currently on screen
  const index = new Uint8Array(GW * GH);
  const delay = Math.round(step * 1000);
  frames.forEach((y, i) => {
    for (let p = 0; p < y.length; p++) {
      const q = lut[y[p]];
      // a pixel within two levels of what is already on screen stays as it is
      if (i > 0 && (q === shown[p] || Math.abs(greys[shown[p] - 1] - y[p]) <= 2)) index[p] = 0;
      else index[p] = shown[p] = q;
    }
    // dispose 1 keeps each frame under the next one, so transparency shows it
    gif.writeFrame(index, GW, GH, {
      palette: i === 0 ? palette : undefined, delay, repeat: 0, colorDepth: depth,
      transparent: i > 0, transparentIndex: 0, dispose: 1,
    });
  });
  gif.finish();
  const out = join(MEDIA, 'cover.gif');
  await Bun.write(out, gif.bytes());
  console.log(`\n${relative(ROOT, out)}: ${GW}x${GH}, ${frames.length} frames, ${greys.length} greys, ${(statSync(out).size / 1048576).toFixed(2)} MB`);
}

async function stills(page: Page, shots: Shots): Promise<void> {
  await page.evaluate(() => { window.__film!.setGrade({}); window.__film!.setSize(1280, 720); });
  for (let i = 0; i < STILLS.length; i++) {
    const [id, t] = STILLS[i];
    const url = await page.evaluate((t) => window.__film!.shot(t, 'image/jpeg', 0.9), shots[id].start + t);
    const file = join(MEDIA, 'stills', `${String(i + 1).padStart(2, '0')}-${id}.jpg`);
    await Bun.write(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(relative(ROOT, file));
  }
}

// The link card, 1280x640:
// a still with the giant number, feathered into the page colour on its left,
// and the name of the project on the clean black beside it.
async function social(page: Page, shots: Shots): Promise<void> {
  const still = await page.evaluate((t) => {
    window.__film!.setGrade({});
    window.__film!.setSize(1280, 720);
    return window.__film!.shot(t, 'image/png');
  }, shots.horizon.start + 2.05);
  const url = await page.evaluate(async (still) => {
    const img = new Image();
    img.src = still;
    await img.decode();
    const W = 1280, H = 640, s = 0.92;
    const card = document.createElement('canvas');
    card.width = W;
    card.height = H;
    const g = card.getContext('2d')!;
    g.fillStyle = '#0c0c0c';
    g.fillRect(0, 0, W, H);
    // the still, faded out towards its left, top and bottom edges
    const fw = Math.round(1280 * s), fh = Math.round(720 * s);
    const layer = new OffscreenCanvas(fw, fh);
    const lg = layer.getContext('2d', { willReadFrequently: true })!;
    lg.drawImage(img, 0, 0, fw, fh);
    const px = lg.getImageData(0, 0, fw, fh);
    for (let y = 0; y < fh; y++) {
      const vertical = Math.min(1, y / 90, (fh - 1 - y) / 90);
      for (let x = 0; x < fw; x++) px.data[(y * fw + x) * 4 + 3] = Math.round(255 * vertical * Math.min(1, Math.max(0, (x - 220) / 380)) ** 1.8);
    }
    lg.putImageData(px, 0, 0);
    g.drawImage(layer, W - fw + 60, (H - fh) / 2 + 6);
    g.fillStyle = '#ececec';
    g.font = '600 118px "IBM Plex Sans"';
    g.fillText('Focal Plane', 84, 272);
    g.fillStyle = '#bebebe';
    g.font = '400 40px "IBM Plex Sans"';
    g.fillText('2.5D motion UI in the browser', 88, 341);
    g.fillStyle = '#787878';
    g.font = '400 25px "IBM Plex Mono"';
    g.fillText('three.js · WebCodecs · Bun · TypeScript', 88, 396);
    g.fillText('flat UI + real lens + hard cuts → 4K60', 88, 436);
    return card.toDataURL('image/png');
  }, still);
  const file = join(MEDIA, 'social.png');
  await Bun.write(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${relative(ROOT, file)}: 1280x640, ${(statSync(file).size / 1024).toFixed(0)} KB`);
}

const GW = +arg('w', '800'), GH = Math.round((GW * 9) / 16), colors = +arg('colors', '64'), step = +arg('step', '0.07');
mkdirSync(join(MEDIA, 'stills'), { recursive: true });

const session = await startSession();
try {
  const page = await openCapture(session, GW * 2, GH * 2);
  const shots: Shots = Object.fromEntries((await page.evaluate(() => window.__film!.shots)).map((s) => [s.id, s]));
  if (!flag('no-cover')) await cover(page, session, shots, GW, GH, colors, step);
  if (!flag('no-stills')) await stills(page, shots);
  if (!flag('no-social')) await social(page, shots);
  reportErrors(page, 10);
} finally {
  await session.close();
}
