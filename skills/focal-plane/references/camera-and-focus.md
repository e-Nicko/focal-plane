# Camera and focus

## Camera keys

A shot's `camera` is a list of keys over its local time:

```ts
const camera: CameraKeys = [
  [0.0, { look: [540, 400], distance: 11.6, azimuth: -28, elevation: 33, roll: -3, fov: 28, aperture: 0.38 }],
  [2.4, { look: [530, 420], distance: 10.9, azimuth: -25, elevation: 34, roll: -2.4, fov: 28, aperture: 0.38 }],
];
```

Keys are interpolated with a Hermite spline:
Catmull-Rom tangents inside, zero tangents at the ends,
so the move eases out of the first key and into the last.
Two keys give a slow push-in with an ease at both ends; that is usually enough.
Add a middle key only for a deliberate change of direction.

| Field | Unit | Meaning | Example range |
|---|---|---|---|
| `look` | page px `[x, y]` | the page point at the centre of the frame | anywhere on the page |
| `distance` | world units (100 page px = 1) | camera to `look` | 6 (macro) to 17 (wide) |
| `azimuth` | degrees | 0 = from below the page, reading it upright; − from the left, + from the right | −58 to +36 |
| `elevation` | degrees above the page | low = steep and dramatic, high = calm and legible | 19 to 57 |
| `roll` | degrees | tilts the horizon | −7 to +10 |
| `fov` | degrees, vertical | 26–30 reads as a long lens | 26 to 30 |
| `aperture` | K in the thin-lens formula | bigger = shallower | 0.28 to 0.42 |

## Framing

- Moving `look` **down** the page (larger y) moves the content **up** in the frame.
  Moving it left moves the content right.
  This is the most common mistake; check the direction before you iterate.
- The camera orbits `look`, so changing `azimuth` or `elevation` keeps `look` centred
  but changes what else fits.
- With `azimuth` negative, the left and bottom of the page are nearer to the lens:
  put the large effect there and the small cause far away, top right.
- A push-in of 5–10% of `distance` over the shot, plus a few page pixels of `look` drift,
  keeps the frame alive without drawing attention.
- `roll` of 2–10° in the direction of the diagonal adds energy to steep shots;
  keep it near 0 in frontal shots.

### Frame budget

The frame shows about 88 × `distance` page px across
and 50 × `distance` / sin(`elevation`) px down at `fov` 28
(95 × and 54 × at `fov` 30).
A layout 1100 px across therefore needs a `distance` of at least 13.
`azimuth` turns this rectangle on the page, so leave a margin when it is large.
Do the sum before the first shot: two of three first attempts at a new layout overflow the frame.

## Aperture

The circle of confusion in pixels is `c = K · (1/z_focus − 1/z) · H`,
clamped to 3.8% of the frame height.

- The lower the camera sits over the page, the smaller the `K` you need:
  a steep diagonal spans a long depth range (0.3 is plenty);
  a near-frontal shot spans little (0.4 or more).
- Blur falls with the square of the distance, about K / `distance`².
  When you pull the camera back 20%, raise `K` by 20–40% to keep the same look
  (0.42 to 0.55 when `distance` grows from 11.5 to 13.6).
- Too much `K` makes even the focal region look soft at 720p stills;
  check at the resolution you care about.

## Focus

`state(t)` returns `focus: [x, y]`, a page point.
The engine uses the distance to it along the view axis,
so focus stays on the thing while the camera moves.

Rack focus by interpolating between two page points:

```js
const rack = ease.sine(inv(0.85, 1.45, t));
focus: [lerp(cause[0], effect[0], rack), lerp(cause[1], effect[1], rack)],
```

- A rack needs a depth difference.
  If the cause and the effect sit at the same distance from the lens,
  for example side by side in a frontal shot, focus has nothing to move between:
  put one nearer, or raise `azimuth` or `K`.
- Start the rack 0.1–0.3 s after the effect begins.
- A rack takes 0.5–0.7 s; faster reads as a glitch, slower as indecision.
- Aim the focus at the part of the effect that carries the meaning:
  the end of a forecast line, the value in a label, the ringed outlier.
- In a shot without a cursor (establishing), rack from the headline to the next thing to read.

## The grade

`makeEdit({ grade })` overrides these defaults (`src/engine/edit.ts`):

| Key | Default | Effect |
|---|---|---|
| `bloom` | 0.04 | glow; keep it near zero |
| `exposure` | 1.0 | before the tone map |
| `vignette` | 0.28 | darkens the corners |
| `ca` | 0.0025 | chromatic aberration towards the corners |
| `grain` | 0.02 | film grain, strongest in the midtones |
| `lift` | 0.045 | output black level, about 11.5/255 |
| `gain` | 236/255 | output white level |

For a GIF or anything heavily compressed: `grain: 0, ca: 0`
(`window.__film.setGrade({ grain: 0, ca: 0 })` in capture mode).
