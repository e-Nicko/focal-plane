// The vocabulary shared by the engine, the films and the tools.

import type { Ctx, Vec2 } from '../kit/index.js';

// A page size in page pixels.
export interface Size {
  w: number;
  h: number;
}

// One key of a shot's camera.
// The camera speaks the language of composition:
// where it looks, from how far, from which side and how high,
// how the frame is tilted, how long the lens is, how shallow the focus is.
export interface CameraKey {
  // the page point at the centre of the frame, in page px
  look: Vec2;
  // camera to look point, in world units (100 page px make one unit)
  distance: number;
  // degrees: 0 looks up the page from below it, negative from the left, positive from the right
  azimuth: number;
  // degrees above the page: low is steep and dramatic, high is calm and legible
  elevation: number;
  // degrees: tilts the horizon
  roll: number;
  // vertical field of view in degrees; 26–30 reads as a long lens
  fov: number;
  // K of the thin-lens circle of confusion; bigger is shallower
  aperture: number;
}

export type CameraKeys = [t: number, key: CameraKey][];

// A camera in world space, ready for the renderer.
export interface ResolvedCamera {
  pos: [number, number, number];
  look: [number, number, number];
  roll: number;
  fov: number;
  aperture: number;
  // distance to the sharp page point, along the view axis
  focus: number;
}

// What every shot's state must carry: the page point to keep sharp.
export interface ShotState {
  focus: Vec2;
}

// A shot: one idea, about two seconds.
// state() and draw() are pure functions of the shot's local time.
export interface Shot<S extends ShotState = ShotState> {
  id: string;
  duration: number;
  size: Size;
  camera: CameraKeys;
  state(t: number): S;
  draw(ctx: Ctx, w: number, h: number, t: number, s: S): void;
}

// The look of the film, applied last.
export interface Grade {
  bloom: number;
  exposure: number;
  vignette: number;
  // chromatic aberration
  ca: number;
  grain: number;
  // output black level, 0..1, display-referred
  lift: number;
  // output white level
  gain: number;
}

export type Quality = 'draft' | 'high' | 'master';

export const isQuality = (q: unknown): q is Quality => q === 'draft' || q === 'high' || q === 'master';

// Everything a frame needs, at one moment of the edit.
export interface FrameState {
  // global time
  t: number;
  // time within the shot
  lt: number;
  index: number;
  shot: Shot;
  ui: ShotState;
  // 0..1, the fade at the start and the end of the film
  fade: number;
  camera: ResolvedCamera;
}

export interface Edit {
  title: string;
  shots: Shot[];
  // global start time of each shot
  starts: number[];
  duration: number;
  fps: number;
  page: string;
  // the time of the frame shown still when the viewer prefers reduced motion
  poster: number;
  grade: Grade;
  stateAt(t: number): FrameState;
}
