// An edit is a list of shots joined by hard cuts.
// Each shot owns its page, its cursor and its camera;
// the edit only decides which shot is on screen at time t
// and how the film fades in and out.

import { clamp, smoothstep } from '../kit/math.js';
import { resolveCamera } from './camera.js';
import type { Edit, FrameState, Grade, Shot } from './types.js';

// The look of the reference reel:
// black lifted to about 12/255, white capped near 236/255,
// almost no glow, fine grain, a soft vignette.
export const DEFAULT_GRADE: Grade = {
  bloom: 0.04, exposure: 1.0, vignette: 0.28, ca: 0.0025, grain: 0.02, lift: 0.045, gain: 236 / 255,
};

export interface EditOptions {
  title?: string;
  shots: Shot[];
  fps?: number;
  // the page colour, and the colour of the void around it
  page?: string;
  // overrides of DEFAULT_GRADE
  grade?: Partial<Grade>;
  fadeIn?: number;
  fadeOut?: number;
  // the time of the frame shown still when the viewer prefers reduced motion
  poster?: number;
}

export function makeEdit({ title = 'Focal Plane', shots, fps = 60, page = '#0c0c0c', grade = {}, fadeIn = 0.35, fadeOut = 0.7, poster = 0 }: EditOptions): Edit {
  const starts: number[] = [];
  let acc = 0;
  for (const s of shots) { starts.push(acc); acc += s.duration; }
  const duration = acc;

  function shotAt(t: number): { index: number; shot: Shot; lt: number } {
    let index = 0;
    while (index < shots.length - 1 && t >= starts[index] + shots[index].duration) index++;
    const shot = shots[index];
    return { index, shot, lt: clamp(t - starts[index], 0, shot.duration) };
  }

  // Everything a frame needs, as a pure function of t.
  function stateAt(tIn: number): FrameState {
    const t = clamp(tIn, 0, duration);
    const { index, shot, lt } = shotAt(t);
    const ui = shot.state(lt);
    const camera = resolveCamera(shot, lt, ui.focus);
    const fade = smoothstep(0, fadeIn, t) * (1 - smoothstep(duration - fadeOut, duration, t));
    return { t, lt, index, shot, ui, fade, camera };
  }

  return { title, shots, starts, duration, fps, page, poster, grade: { ...DEFAULT_GRADE, ...grade }, stateAt };
}
