// The camera rig speaks the language of composition, not of world space.
// A key says which point of the page the lens looks at,
// from how far, from which side and how high,
// how the frame is tilted, how long the lens is,
// and how shallow the focus is.
// World coordinates are derived here.

import { spline, type Key, type Vec2 } from '../kit/math.js';
import type { CameraKey, CameraKeys, ResolvedCamera, Shot, Size } from './types.js';

// Page canvas px per world unit.
export const UNIT = 100;

const FIELDS = ['distance', 'azimuth', 'elevation', 'roll', 'fov', 'aperture'] as const;

// A point on the page (canvas px) in world space:
// the page lies on y = 0, centred on the origin, its top edge towards -z.
export function pageToWorld(size: Size, px: number, py: number): [number, number, number] {
  return [(px - size.w / 2) / UNIT, 0, (py - size.h / 2) / UNIT];
}

// Interpolates camera keys at time t.
export function sampleKeys(keys: CameraKeys, t: number): CameraKey {
  const flat: Key[] = keys.map(([kt, k]) => [kt, [k.look[0], k.look[1], ...FIELDS.map((f) => k[f])]]);
  const v = spline(flat, t);
  const out = { look: [v[0], v[1]] as Vec2 } as CameraKey;
  FIELDS.forEach((f, i) => { out[f] = v[2 + i]; });
  return out;
}

// Resolves a shot's camera at local time t.
// azimuth 0 puts the camera below the page, reading it upright;
// negative azimuth moves it to the left, positive to the right.
// elevation is measured from the page up.
// focus is the planar distance to the page point the shot wants sharp.
export function resolveCamera(shot: Pick<Shot, 'size' | 'camera'>, t: number, focusPx: Vec2): ResolvedCamera {
  const k = sampleKeys(shot.camera, t);
  const look = pageToWorld(shot.size, k.look[0], k.look[1]);
  const a = (k.azimuth * Math.PI) / 180, e = (k.elevation * Math.PI) / 180;
  const pos: [number, number, number] = [
    look[0] + k.distance * Math.sin(a) * Math.cos(e),
    k.distance * Math.sin(e),
    look[2] + k.distance * Math.cos(a) * Math.cos(e),
  ];
  const fw = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]];
  const len = Math.hypot(...fw);
  const fp = pageToWorld(shot.size, focusPx[0], focusPx[1]);
  const focus = Math.max(0.3, ((fp[0] - pos[0]) * fw[0] + (fp[1] - pos[1]) * fw[1] + (fp[2] - pos[2]) * fw[2]) / len);
  return { pos, look, roll: k.roll, fov: k.fov, aperture: k.aperture, focus };
}
