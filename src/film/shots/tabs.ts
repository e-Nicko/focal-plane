// Shot "Tabs":
// the navigation on a steep diagonal.
// The hand glides along the tabs, the underline follows it,
// and a click on Forecast motivates the cut into the forecast shot.
// Below the nav, the page begins nearer to the lens
// and melts into a soft foreground mass.

import { M, txt, micro, hline, cursor, ripple, measureTxt, grey, clamp, lerp, inv, pulse, ease, type Ctx } from '../../kit/index.js';
import type { CameraKeys, Shot, ShotState } from '../../engine/types.js';

// pos: the cursor's position in tab-index space, tab: the underline's, ripple: 0..1 since the click.
interface TabsState extends ShotState {
  pos: number;
  tab: number;
  press: number;
  ripple: number;
}

const W = 1500, H = 700;
const SIZE = 34;
const BASE = 300;                          // baseline of the tab labels
const CLICK = 1.0;
const ITEMS = [
  { label: 'Overview', x: 420 }, { label: 'Revenue', x: 640 }, { label: 'Forecast', x: 850 },
  { label: 'Risk', x: 1070 }, { label: 'Reports', x: 1200 },
];

// Label widths from a private measuring canvas,
// so state() and draw() agree from the very first frame.
let WIDTHS: number[] | null = null;
function widths(): number[] {
  if (!WIDTHS) {
    const m = document.createElement('canvas').getContext('2d');
    if (!m) throw new Error('Canvas 2D is not available.');
    WIDTHS = ITEMS.map((it) => measureTxt(m, it.label, { size: SIZE, weight: 500 }));
  }
  return WIDTHS;
}
const centerOf = (i: number): number => ITEMS[i].x + widths()[i] / 2;

// The cursor's x for a fractional tab position.
function cursorX(pos: number): number {
  const p = clamp(pos, 0, ITEMS.length - 1);
  const j0 = Math.floor(p), j1 = Math.min(ITEMS.length - 1, j0 + 1);
  return lerp(centerOf(j0), centerOf(j1), p - j0);
}

function state(t: number): TabsState {
  // the cursor moves in tab-index space: from past Overview, easing onto Forecast
  const pos = lerp(0.35, 2.0, ease.inOut(inv(0.05, 0.9, t)));
  const settle = t > 0.9 && t < 1.4 ? Math.sin((t - 0.9) * 22) * Math.exp(-(t - 0.9) * 8) * 0.03 : 0;
  // the underline trails the cursor slightly, then locks onto the clicked tab
  const tab = lerp(0, 2, ease.inOut(inv(0.15, 1.05, t)));
  const s = {
    pos: pos + settle, tab,
    press: pulse(t, CLICK - 0.06, CLICK + 0.14, 0.05, 0.08),
    ripple: t > CLICK ? (t - CLICK) / 0.7 : 0,
  };
  return { ...s, focus: [cursorX(s.pos), BASE - 12] };
}

const camera: CameraKeys = [
  [0.0, { look: [760, 290], distance: 6.4, azimuth: -58, elevation: 20, roll: 10, fov: 30, aperture: 0.3 }],
  [1.8, { look: [860, 290], distance: 6.0, azimuth: -55, elevation: 19, roll: 9, fov: 30, aperture: 0.3 }],
];

function draw(ctx: Ctx, w: number, h: number, _t: number, s: TabsState): void {
  ctx.fillStyle = M.page;
  ctx.fillRect(0, 0, w, h);
  const ws = widths();

  // brand and breadcrumb
  micro(ctx, 'Focal', 90, BASE - 6, { size: 18, color: M.ink, spacing: 3 });
  txt(ctx, '→', 300, BASE - 4, { size: 26, color: M.ink3 });

  // the tabs brighten as the cursor passes; the active underline slides
  ITEMS.forEach((it, i) => {
    const near = 1 - clamp(Math.abs(s.pos - i) * 1.2);
    const act = 1 - clamp(Math.abs(s.tab - i));
    txt(ctx, it.label, it.x, BASE, { size: SIZE, weight: 500, color: grey(Math.max(near * 0.85, act), 0x66, 0xec) });
  });
  const i0 = Math.floor(clamp(s.tab, 0, ITEMS.length - 1)), i1 = Math.min(ITEMS.length - 1, i0 + 1), f = s.tab - i0;
  ctx.fillStyle = M.ink;
  ctx.fillRect(lerp(ITEMS[i0].x, ITEMS[i1].x, f), BASE + 22, lerp(ws[i0], ws[i1], f), 3);
  hline(ctx, 60, w - 60, BASE + 24, M.line2);

  // the page below, nearer to the lens
  micro(ctx, 'Net revenue · daily', 420, BASE + 130, { size: 16 });
  txt(ctx, '$4.28M', 412, BASE + 320, { size: 150, weight: 600, spacing: -5, color: '#7c7c7c' });

  // the hand sits just under the label, so the word stays readable
  const cx = cursorX(s.pos);
  ripple(ctx, cx, BASE - 12, s.ripple);
  cursor(ctx, cx + 10, BASE + 8, { kind: 'hand', press: s.press });
}

export default { id: 'tabs', duration: 1.8, size: { w: W, h: H }, camera, state, draw } satisfies Shot<TabsState>;
