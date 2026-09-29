// Checks a rendered MP4 the way a viewer will see it:
// opens it in Chrome, reports resolution, duration and bitrate,
// and pulls frames out of the file itself for a look.
// A render is not done until its frames have been seen decoded.
//
// Usage: bun run verify out/film.mp4 [--at=1,5,9]
// Output: out/frames/mp4-<name>-t<time>.jpg

import { mkdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { arg, positional, reportErrors, startSession } from './common.js';
import { ROOT } from './server.js';

const file = positional();
if (!file) {
  console.error('usage: bun run verify <file.mp4> [--at=1,5,9]');
  process.exit(2);
}
const path = resolve(file);
const at = arg('at', '1,5,9').split(',').map(Number);

// the file's folder is served under /__mount/video/, wherever the file lives
const session = await startSession({ mounts: { video: dirname(path) } });
try {
  const page = await session.browser.newPage();
  await page.goto(`${session.server.url}__blank`);

  const info = await page.evaluate(
    async ({ src, at }) => {
      const v = document.createElement('video');
      v.src = src;
      v.muted = true;
      v.preload = 'auto';
      await new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => resolve();
        v.onerror = () => reject(new Error('the browser cannot decode this file'));
      });
      const c = document.createElement('canvas');
      c.width = 1280;
      c.height = Math.round((1280 * v.videoHeight) / v.videoWidth);
      const g = c.getContext('2d')!;
      const frames: { t: number; url: string }[] = [];
      for (const t of at) {
        // 'seeked' alone can hand back the previous frame:
        // wait until the new frame is presented, with a timeout,
        // because nothing is presented when the seek lands on the frame already shown
        const shown = new Promise<void>((resolve) => {
          let done = false;
          const finish = () => { if (!done) { done = true; resolve(); } };
          v.requestVideoFrameCallback?.(finish);
          v.onseeked = () => setTimeout(finish, 400);
        });
        v.currentTime = t;
        await shown;
        g.drawImage(v, 0, 0, c.width, c.height);
        frames.push({ t, url: c.toDataURL('image/jpeg', 0.9) });
      }
      return { w: v.videoWidth, h: v.videoHeight, duration: v.duration, frames };
    },
    { src: `/__mount/video/${encodeURIComponent(basename(path))}`, at },
  );

  const bytes = statSync(path).size;
  console.log(`${file}: ${info.w}x${info.h}, ${info.duration.toFixed(3)} s, ${(bytes / 1048576).toFixed(1)} MB, ${((bytes * 8) / info.duration / 1e6).toFixed(1)} Mbit/s`);
  const name = basename(path, extname(path));
  mkdirSync(join(ROOT, 'out', 'frames'), { recursive: true });
  for (const f of info.frames) {
    const p = join(ROOT, 'out', 'frames', `mp4-${name}-t${f.t}.jpg`);
    await Bun.write(p, Buffer.from(f.url.split(',')[1], 'base64'));
    console.log(relative(ROOT, p));
  }
  reportErrors(page);
} finally {
  await session.close();
}
