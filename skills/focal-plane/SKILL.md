---
name: focal-plane
description: >-
  Make 2.5D motion UI films: flat vector interfaces drawn on a plane in 3D,
  filmed through a thin-lens camera with shallow depth of field and rack focus,
  cut into short shots with a cursor as the actor,
  and rendered frame by frame in the browser (three.js, WebCodecs) to a 4K60 MP4.
  Use it for app promos, UI promos, product launch films, dashboard and SaaS showcases,
  "2.5D motion", "depth of field UI animation", or adding a shot to a Focal Plane film.
  Also for: «2.5D моушен», «промо интерфейса», «ролик дашборда», «моушен с глубиной резкости»,
  «2.5D 动效», «UI 宣传片», «产品发布片», «浅景深界面动画».
---

# Focal Plane: 2.5D motion UI

You are making a short film in which a flat interface is filmed like an object on a desk:
a canvas-2D page lies on a plane,
a camera with a real lens flies over it,
focus moves from what the cursor touches to what that touch changes,
and hard cuts join shots of about two seconds.
Every frame is a pure function of time,
so you can render any frame, look at it, and fix it.

This skill works inside a clone of the Focal Plane repository.
Check for `src/engine/player.ts`.
If it is not there, ask the user where the repository is before writing code.

## Non-negotiables

1. **One idea per shot**, 1.8–2.6 s.
   The control and the thing it changes share the frame.
2. **Focus is a point on the page.**
   `state(t)` returns `focus: [x, y]`.
   Rack it from the cause to the effect, starting after the effect has begun.
3. **The cursor acts like a hand.**
   Eased travel, lands beside the target, hover → press → ripple → settle,
   then drifts off the effect.
4. **Hard cuts only.**
   Start the motion in the first frames of every shot:
   a cut that lands on the start of a movement is the one viewers miss.
5. **Deterministic.**
   No `Math.random`, `Date`, `performance.now` or network in `state`, `draw` or data.
   Seed any randomness.
6. **One data module.**
   Every number on screen is derived from it and agrees across shots.
7. **Types first, then pixels.**
   `bun run typecheck` is clean before you render anything.
8. **Look before you claim.**
   You are not done until you have looked at the stills
   and at frames decoded from the rendered MP4.

## Setup

The tools run on [Bun](https://bun.sh) and drive an installed Google Chrome with the GPU.

```bash
bun install
bun run serve                   # http://127.0.0.1:8790/?film=<name>
```

Set `CHROME_PATH` if Chrome is somewhere unusual.
The sources are TypeScript: the dev server strips the types on the fly, and `bun run typecheck` checks them.
Read the example film in `src/film/` before writing a new one:
seven shots, each a complete, working answer to a composition problem.

## Workflow

### 1. Shot list

Write one sentence per shot, each with a cause and an effect,
and show the list to the user before you build.
Five to eight shots make twelve to twenty seconds.
Arc: establish → act → read → discover → pull back.
See `references/composition.md`.

### 2. Data

Create `src/<film>/data.ts`: `mulberry32` and `gauss` from the kit for randomness, arithmetic for the rest.
Compute derived values (totals, deltas, forecasts, outliers) there or in the shot from the data,
never by typing a number into a label.

### 3. Shots

For each shot, copy `templates/shot.ts` to `src/<film>/shots/<id>.ts`.
Rewrite the page in `draw()`, the motion in `state(t)`, the camera keys.
Keep type large: nothing important under 20 px on the page, readable values at 150–270 px.
A 330 px number is for a soft foreground mass that the frame may crop.
API: `references/shot-api.md`.

### 4. Edit and entry

Copy `templates/edit.ts` to `src/<film>/edit.ts` and `templates/main.ts` to `src/<film>/main.ts`.
The film now plays at `index.html?film=<film>`.

### 5. Compose on stills

```bash
bun run typecheck
bun run shoot --film=<film> --shot=<id> --lt=0.3,0.8,1.6,2.2 --w=1280 --h=720 --tag=<id> --sheet
```

`--lt` takes times inside the shot, `--t` takes times in the whole film.
`shoot` prints the shots and their start times first.
Open every image you render and check it against `references/verification.md`.
Change one camera key at a time; see `references/camera-and-focus.md`.
Expect three to six rounds per shot.

### 6. The whole edit

Shoot one frame per shot, plus the frames around each cut, as one contact sheet.
Check rhythm, continuity of numbers, and the alternation of steep and calm angles.

### 7. Render and verify

```bash
bun run render --film=<film>                             # 4K60, 16–20 frames/s on a mid-range GPU
bun run verify out/<film>-2160p60.mp4 --at=1,5,9         # decodes frames from the file
```

Open the decoded frames.
Report resolution, duration and bitrate from `verify`.

## Framing, fast

| You see | Change |
|---|---|
| the subject is too low in the frame | move `look` down the page (larger y) |
| the subject is cut off on the left | move `look` left (smaller x) or add `distance` |
| the frame feels flat | lower `elevation` (20–30°) or raise `azimuth` (±40–60°) |
| the text is unreadable | raise `elevation` (40–55°), bring `azimuth` towards 0 |
| no visible blur | raise `aperture`, or lower the camera (smaller `elevation`) |
| everything is soft | the focus point is wrong, or `aperture` is too high for the angle |
| the frame overflows | pull back: at `fov` 28 the frame shows about 88 × `distance` px across the page and 50 × `distance` / sin(`elevation`) px down |
| the cursor is a speck | raise its `scale` to about `distance` / 8 |

## When something looks wrong

Read `references/pitfalls.md`: blank frames, fallback fonts,
state and draw disagreeing about text widths, slow 4K renders, stale video frames.

## Files

- `references/composition.md`: shot grammar, the example's decisions, the cursor.
- `references/camera-and-focus.md`: camera keys, framing, aperture, rack timing, the grade.
- `references/shot-api.md`: the shot object, the kit, the edit, the capture API.
- `references/verification.md`: what to check in every still and every render.
- `references/pitfalls.md`: what broke before, and the fix.
- `templates/`: `shot.ts`, `edit.ts`, `main.ts`, tested as a film.
