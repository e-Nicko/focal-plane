// Renders the film to MP4 in headless Chrome,
// frame by frame (GPU for the image, WebCodecs H.264 for the encoding).
// Deterministic: frame i is time i / fps, nothing is captured from a screen.
//
// Usage:
//   bun run render [--film=<name>] [--w=3840] [--h=2160] [--from=0] [--to=<end>] [--fps=60] [--mbps=48] [--out=out/film.mp4]

import { mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { arg, openCapture, reportErrors, startSession } from './common.js';
import { ROOT } from './server.js';

const W = +arg('w', '3840'), H = +arg('h', '2160'), fps = +arg('fps', '60'), mbps = +arg('mbps', '48');
const out = resolve(ROOT, arg('out', `out/${arg('film', 'focal-plane')}-${H}p${fps}.mp4`));
mkdirSync(dirname(out), { recursive: true });

const session = await startSession();
try {
  const page = await openCapture(session, W, H);
  page.onConsole((text) => {
    if (text.startsWith('[render]')) process.stdout.write(`\r${text.slice(9).padEnd(60)}`);
  });
  const from = +arg('from', '0');
  const to = +arg('to', String(await page.evaluate(() => window.__film!.duration)));

  const started = Date.now();
  // the page hands the finished file to the tool's server, then reports its size
  const size = await page.evaluate(
    async ({ W, H, from, to, fps, mbps, url }) => {
      const blob = await window.__film!.exportMP4({
        width: W, height: H, from, to, fps, bitrate: mbps * 1e6,
        onProgress: ({ frame, total, eta }) => {
          if (frame % 10 === 0 || frame === total) console.log(`[render] frame ${frame}/${total}, about ${Math.ceil(eta)} s left`);
        },
      });
      const r = await fetch(url, { method: 'PUT', body: blob });
      if (!r.ok) throw new Error(`the tool's server refused the upload: ${r.status}`);
      return blob.size;
    },
    { W, H, from, to, fps, mbps, url: session.server.uploadUrl('render.mp4') },
  );
  console.log(`\nencoded ${(size / 1048576).toFixed(1)} MB in ${((Date.now() - started) / 1000).toFixed(0)} s`);

  await Bun.write(out, session.server.inbox.get('render.mp4')!);
  console.log(relative(ROOT, out));
  reportErrors(page, 10);
} finally {
  await session.close();
}
