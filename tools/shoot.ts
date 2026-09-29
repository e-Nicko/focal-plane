// Renders stills of the film and, optionally, a contact sheet.
// This is the main loop of composing a shot:
// change a camera key, shoot, look, repeat.
//
// Usage:
//   bun run shoot --t=0.6,2.4,5.8 [--film=<name>] [--w=1920] [--h=1080] [--q=high|draft|master] [--tag=name] [--format=jpg|png] [--sheet]
//   bun run shoot --shot=forecast --lt=0.3,0.8,1.6
// --t takes times in the whole film, --lt takes times inside the shot named by --shot.
// The shots and their times are printed first.
// Defaults: 1920x1080, quality high, JPEG, tag "shot".
// Output:
//   out/frames/<tag>-t<time>.jpg (the time is the time in the whole film),
//   and out/frames/<tag>-sheet.jpg with --sheet

import { mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { arg, flag, openCapture, reportErrors, startSession } from './common.js';
import { ROOT } from './server.js';

const W = +arg('w', '1920'), H = +arg('h', '1080'), q = arg('q', 'high'), tag = arg('tag', 'shot');
const format = arg('format', 'jpg');
const out = join(ROOT, 'out', 'frames');
mkdirSync(out, { recursive: true });

const session = await startSession();
try {
  const page = await openCapture(session, W, H);
  if (q !== 'master') await page.evaluate((q) => window.__film!.setQuality(q as 'draft' | 'high'), q);

  const shots = await page.evaluate(() => window.__film!.shots);
  console.log(`shots: ${shots.map((s) => `${s.id} ${s.start.toFixed(2)}-${(s.start + s.duration).toFixed(2)}`).join(', ')}`);
  let times = arg('t', '1,3,5,7,9,11,13,15').split(',').map(Number);
  const shotId = arg('shot');
  if (shotId) {
    const shot = shots.find((s) => s.id === shotId);
    if (!shot) throw new Error(`no shot "${shotId}"; the shots are ${shots.map((s) => s.id).join(', ')}`);
    times = arg('lt', '0.3,1,1.7').split(',').map((lt) => shot.start + Number(lt));
  }

  const stills: { t: number; url: string }[] = [];
  for (const t of times) {
    const started = Date.now();
    const png = format === 'png';
    const url = await page.evaluate(({ t, png }) => window.__film!.shot(t, png ? 'image/png' : 'image/jpeg', 0.92), { t, png });
    const file = join(out, `${tag}-t${t.toFixed(2)}.${format}`);
    await Bun.write(file, Buffer.from(url.split(',')[1], 'base64'));
    stills.push({ t, url });
    console.log(`${relative(ROOT, file)}  ${Date.now() - started} ms`);
  }

  if (flag('sheet')) {
    const cols = Math.min(4, stills.length), rows = Math.ceil(stills.length / cols);
    const tw = 640, th = Math.round((tw * H) / W);
    const sheet = await page.evaluate(
      async ({ stills, cols, rows, tw, th }) => {
        const c = document.createElement('canvas');
        c.width = cols * tw;
        c.height = rows * (th + 22);
        const g = c.getContext('2d')!;
        g.fillStyle = '#111';
        g.fillRect(0, 0, c.width, c.height);
        for (let i = 0; i < stills.length; i++) {
          const img = new Image();
          img.src = stills[i].url;
          await img.decode();
          const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + 22);
          g.drawImage(img, x, y, tw, th);
          g.fillStyle = '#ddd';
          g.font = '14px monospace';
          g.fillText(`t=${stills[i].t}`, x + 8, y + th + 16);
        }
        return c.toDataURL('image/jpeg', 0.9);
      },
      { stills, cols, rows, tw, th },
    );
    const file = join(out, `${tag}-sheet.jpg`);
    await Bun.write(file, Buffer.from(sheet.split(',')[1], 'base64'));
    console.log(relative(ROOT, file));
  }

  reportErrors(page);
} finally {
  await session.close();
}
