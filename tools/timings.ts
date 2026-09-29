// GPU time per pipeline stage, fenced with a one-pixel readback
// (Chrome turns gl.finish() into a flush, so finish() times nothing).
// Use it before blaming the lens:
// the slow part is usually the canvas upload or MSAA, not the bokeh.
//
// Usage: bun run timings [--film=<name>] [--w=3840] [--h=2160] [--q=master] [--t=1,6,12]

import { arg, openCapture, startSession } from './common.js';

const W = +arg('w', '3840'), H = +arg('h', '2160'), q = arg('q', 'master');

const session = await startSession();
try {
  const page = await openCapture(session, W, H);
  if (q !== 'master') await page.evaluate((q) => window.__film!.setQuality(q as 'draft' | 'high'), q);
  for (const t of arg('t', '1,6,12').split(',').map(Number)) {
    console.log(`t=${t}`, JSON.stringify(await page.evaluate((t) => window.__film!.timings(t), t)));
  }
} finally {
  await session.close();
}
