// Shot template: one idea, with cause and effect in the same frame.
// Copy it to src/<film>/shots/<id>.ts, then rewrite the page, the story and the camera.
// The import paths below are right for that location.
//
// The idea, written first as one sentence:
//   "the cursor switches round-ups on, and the projected balance rolls up."
//
// A shot is a plain object:
//   id        a name, unique within the edit
//   duration  seconds; most shots take 1.8 to 2.6
//   size      the page in page pixels; draw() paints exactly this area
//   camera    camera keys over the shot's local time
//   state(t)  everything that moves, as a pure function of local time t,
//             including focus: [x, y], the page point to keep sharp
//   draw(ctx, w, h, t, s)  paints the whole page for the state s

import { M, txt, micro, hline, toggle, ripple, cursor, odometer, TOG, lerp, inv, pulse, smoothstep, ease, type Ctx, type CursorState, type Vec2 } from '../../kit/index.js';
import type { CameraKeys, Shot, ShotState } from '../../engine/types.js';

// Everything that moves in this shot, besides the camera.
interface RoundUpsState extends ShotState {
  cursor: CursorState;
  // 0..1: how close the cursor is to the toggle, and how far it is pressed
  hover: number;
  press: number;
  // the toggle, 0..1
  on: number;
  // 0..1 since the click, 0 before it
  ripple: number;
  // the projected balance, in thousands of dollars
  value: number;
}

const W = 1400, H = 800;                    // the page
const TOGGLE = { x: 1000, y: 200 };         // the cause
const TS = 1.4, TW = TOG.w * TS, TH = TOG.h * TS;
const VALUE = { x: 120, y: 600 };           // the effect, set large enough to survive the lens
const CLICK = 0.6;                          // seconds into the shot

function state(t: number): RoundUpsState {
  // The cursor travels with an ease and a bend,
  // lands beside the knob rather than on it,
  // and drifts away once the effect has started.
  const target = { x: TOGGLE.x + TW / 2 + 8, y: TOGGLE.y + TH / 2 + 10 };
  const from = { x: 760, y: 560 };
  const k = ease.inOut(inv(0.0, 0.5, t));
  const bend = Math.sin(Math.PI * k) * 36;
  const drift = ease.inOut(inv(1.1, 2.3, t));
  const x = lerp(from.x, target.x, k) - bend * 0.3 - drift * 24;
  const y = lerp(from.y, target.y, k) + bend * 0.2 + drift * 28;
  const hover = 1 - smoothstep(24, 70, Math.hypot(x - target.x, y - target.y));
  const press = pulse(t, CLICK - 0.06, CLICK + 0.14, 0.05, 0.08);

  // Focus stays on the toggle until the effect is under way,
  // then racks to the value.
  const rack = ease.sine(inv(0.85, 1.45, t));
  const cause: Vec2 = [TOGGLE.x + TW / 2, TOGGLE.y + TH / 2];
  const effect: Vec2 = [VALUE.x + 330, VALUE.y - 70];

  return {
    cursor: { x, y, kind: hover > 0.35 ? 'hand' : 'arrow', press },
    hover,
    press,
    on: ease.out(inv(CLICK, CLICK + 0.3, t)),
    ripple: t > CLICK ? (t - CLICK) / 0.8 : 0,
    value: lerp(12.48, 15.24, ease.inOut(inv(CLICK + 0.1, 1.7, t))),
    focus: [lerp(cause[0], effect[0], rack), lerp(cause[1], effect[1], rack)],
  };
}

// Two keys are usually enough: a slow push-in with a slight drift.
//   look       the page point at the centre of the frame;
//              moving it down the page moves the content up in the frame
//   distance   world units; 100 page px make one unit
//   azimuth    0 looks up the page from below it, negative from the left, positive from the right
//   elevation  degrees above the page: low is steep and dramatic, high is calm and legible
//   roll       tilts the horizon, a few degrees at most
//   fov        vertical, in degrees; 26–30 reads as a long lens
//   aperture   bigger is shallower; steep shots need less of it
const camera: CameraKeys = [
  [0.0, { look: [540, 400], distance: 11.6, azimuth: -28, elevation: 33, roll: -3, fov: 28, aperture: 0.38 }],
  [2.4, { look: [530, 420], distance: 10.9, azimuth: -25, elevation: 34, roll: -2.4, fov: 28, aperture: 0.38 }],
];

function draw(ctx: Ctx, w: number, h: number, _t: number, s: RoundUpsState): void {
  ctx.fillStyle = M.page;
  ctx.fillRect(0, 0, w, h);

  micro(ctx, 'Savings · monthly', 120, 120);
  txt(ctx, 'Round up every payment', 120, 180, { size: 44, weight: 500 });
  hline(ctx, 80, w - 80, 300);

  // the cause
  txt(ctx, 'Round-ups', TOGGLE.x - 26, TOGGLE.y + 32, { size: 28, weight: 500, align: 'right', color: s.on > 0.5 ? M.ink : M.ink2 });
  toggle(ctx, TOGGLE.x, TOGGLE.y, s.on, s.hover, s.press, TS);
  ripple(ctx, TOGGLE.x + TW / 2, TOGGLE.y + TH / 2, s.ripple);

  // the effect
  micro(ctx, 'Projected balance · 12 months', VALUE.x + 6, VALUE.y - 200);
  odometer(ctx, s.value, VALUE.x, VALUE.y, { size: 180, suffix: 'K' });
  hline(ctx, 80, w - 80, 720);

  // the cursor is drawn last, on top of everything
  cursor(ctx, s.cursor.x, s.cursor.y, s.cursor);
}

export default { id: 'round-ups', duration: 2.4, size: { w: W, h: H }, camera, state, draw } satisfies Shot<RoundUpsState>;
