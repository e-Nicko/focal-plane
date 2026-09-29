# Shot API

Everything a shot can use, with exact signatures.
Paths are relative to the repository root.

## The shot object

```ts
export default { id, duration, size: { w, h }, camera, state, draw } satisfies Shot<MyState>;
```

`Shot<S>` and the other shared types live in `src/engine/types.ts`.
`MyState` is the interface of what `state()` returns:
it extends `ShotState` (which holds `focus`), and `draw()` receives it as `s`.

| Field | Type | Contract |
|---|---|---|
| `id` | string | unique within the edit |
| `duration` | seconds | usually 1.8–2.6 |
| `size` | `{ w, h }` page px | the page `draw()` paints; typical 1400×800 to 1500×900 |
| `camera` | `CameraKeys`, `[[t, key], ...]` | see `camera-and-focus.md` |
| `state(t)` | `t` → `S` | pure; `S extends ShotState`, so it includes `focus: Vec2` |
| `draw(ctx, w, h, t, s)` | paints | the whole page for state `s` |

### `state(t)`

- `t` is local time, `0 ≤ t ≤ duration`.
- Pure and cheap: it runs every frame, and the camera needs it for focus.
- Must return `focus: [x, y]` in page px.
- Usually also returns `cursor: { x, y, kind: 'arrow' | 'hand', press }`,
  control states (`hover`, `press`, `on`, `ripple` in 0..1),
  and animated values.
- If it needs text widths, measure lazily on first call with a private canvas,
  never at module load (fonts are not loaded yet then):

```ts
let WIDTHS: number[] | null = null;
function widths(): number[] {
  if (!WIDTHS) {
    const m = document.createElement('canvas').getContext('2d');
    if (!m) throw new Error('Canvas 2D is not available.');
    WIDTHS = ITEMS.map((it) => measureTxt(m, it.label, { size: 34, weight: 500 }));
  }
  return WIDTHS;
}
```

### `draw(ctx, w, h, t, s)`

- `ctx` is already scaled from page px to canvas px; draw in page px.
- Paint everything, starting with the background: `ctx.fillStyle = M.page; ctx.fillRect(0, 0, w, h)`.
- Synchronous, deterministic, no images loaded from the network.
- Draw the cursor last.

## The kit: `src/kit/index.ts`

Import from a shot as `'../../kit/index.js'`:
the sources name each other with `.js` extensions,
and the server answers from the `.ts` file.
Types come with a `type` modifier: `import { txt, type Ctx } from '../../kit/index.js'`.

### Math

| Function | Returns |
|---|---|
| `clamp(v, a = 0, b = 1)` | `v` clamped |
| `lerp(a, b, k)` | linear mix |
| `inv(a, b, v)` | progress of `v` from `a` to `b`, clamped to 0..1 |
| `smoothstep(a, b, v)` | smooth 0..1 between `a` and `b` |
| `pulse(t, a, b, fin = 0.25, fout = 0.25)` | 0 → 1 over `[a, a + fin]`, 1 → 0 over `[b − fout, b]` |
| `mulberry32(seed)` | a seeded generator: a function returning numbers in 0..1 |
| `gauss(rnd)` | a roughly normal number, mean 0, deviation 1, from such a generator |
| `ease.inOut(k)`, `ease.out(k)`, `ease.sine(k)`, `ease.outBack(k)` | eases on 0..1 (cubic in-out, cubic out, sine in-out, overshoot) |
| `spline(keys, t)` | Hermite through `[[t, [v0, v1, ...]], ...]` |

### Drawing

| Function | Notes |
|---|---|
| `M` | palette: `page #0c0c0c`, `ink #ececec`, `ink2 #a0a0a0`, `ink3 #6a6a6a`, `ink4 #3c3c3c`, `line`, `line2`, `track` |
| `FONT` | `{ sans, mono }` font stacks, IBM Plex; shipped weights are Sans 400, 500, 600 and Mono 400, 500 |
| `txt(ctx, s, x, y, { size = 16, weight = 400, fam = 'sans', color = M.ink, align = 'left', base = 'alphabetic', spacing = 0, alpha = 1 })` | draws, returns width |
| `measureTxt(ctx, s, { size, weight, fam, spacing })` | width only |
| `micro(ctx, s, x, y, opts)` | 14 px tracked mono capitals in `ink3`; σ stays lowercase |
| `hline(ctx, x0, x1, y, color = M.line)`, `vline(ctx, x, y0, y1, color)` | 1 px rules |
| `roundRect(ctx, x, y, w, h, r)` | path only; fill or stroke it yourself |
| `monotonePath(ctx, pts, move = true)` | smooth path through `[[x, y], ...]` that never overshoots |
| `polyline(ctx, pts)` | straight path |
| `grey(k, from = 0x0c, to = 0xec)` | `rgb()` string from page black (0) to ink white (1) |

### Controls and type

| Function | Notes |
|---|---|
| `TOG` | `{ w: 58, h: 32 }`, toggle size at scale 1 |
| `toggle(ctx, x, y, on, hover = 0, press = 0, scale = 1)` | top-left at `(x, y)`; `on` animates 0..1 |
| `slider(ctx, x0, x1, y, v, hover = 0, press = 0, { dim, weight = 2, r = 11 })` | `v` in 0..1 |
| `tabs(ctx, items, a, y, { size = 17 })` | `items: [{ label, x }]`, `a` = fractional active index |
| `ripple(ctx, x, y, k)` | click ring, `k` in 0..1 |
| `odometer(ctx, value, x, y, { size = 220, weight = 600, prefix = '$', suffix = 'M', decimals = 2, color, spacing = -6 })` | rolling digits; no thousands separators; returns the drawn width |
| `cursor(ctx, x, y, { kind = 'arrow', press = 0, alpha = 1, scale = 1 })` | `(x, y)` is the hotspot; arrow 26 px tall; `scale` also lives in `CursorState` |

## The edit: `src/engine/edit.ts`

```ts
makeEdit({ title, shots, fps = 60, page = '#0c0c0c', grade = {}, fadeIn = 0.35, fadeOut = 0.7, poster = 0 })
```

Returns `{ title, shots, starts, duration, fps, page, poster, grade, stateAt(t) }`.
`stateAt(t)` gives `{ t, lt, index, shot, ui, fade, camera }` for any global time.

## The player and the capture API

`src/engine/player.ts` exports `boot(edit)`.
`index.html?film=<name>` loads `src/<name>/main.ts`.
With `?capture&w=&h=`, the player waits for the tools and exposes `window.__film`
(typed as `FilmApi` in the same file):

| Member | Use |
|---|---|
| `duration`, `fps` | the edit |
| `shots` | `[{ id, start, duration }]`, to turn local times into global ones |
| `setSize(w, h)`, `setQuality('draft' \| 'high' \| 'master')` | output |
| `setGrade(overrides)` | `{}` restores the edit's grade |
| `renderAt(t, frame)` | renders; returns `{ t, shot, focus }` |
| `shot(t, type = 'image/png', q)` | renders; returns a data URL |
| `timings(t)` | GPU ms per stage |
| `exportMP4({ width, height, fps, from, to, bitrate, onProgress, signal })` | a `Blob` |

## Tools

`shoot`, `render`, `timings` and `media` accept `--film=<name>`.

| Command | Does |
|---|---|
| `bun run serve` | development server on 127.0.0.1:8790 |
| `bun run typecheck` | `tsc --noEmit` over `src/` and `tools/` |
| `bun run shoot --t=a,b,c [--w --h --q --tag --format --sheet]` | stills to `out/frames/`, optional contact sheet; prints the shots and their start times; defaults 1920×1080, quality `high`, JPEG, tag `shot` |
| `bun run shoot --shot=<id> --lt=a,b,c` | the same, with times inside one shot |
| `bun run render [--w --h --from --to --fps --mbps --out]` | MP4 to `out/` |
| `bun run verify <file.mp4> [--at=a,b]` | size, duration, bitrate, decoded frames; the file may be anywhere |
| `bun run timings [--w --h --q --t]` | GPU ms per stage |
| `bun run media` | the example's cover GIF and stills |
| `bun run build` | the static site for GitHub or GitLab Pages, into `public/` |

Write the options after the script name, without `--` in between.
The tools stop with a short `error:` message for the mistakes a user can make (an unknown film, no Chrome);
set `DEBUG=1` for the stack.
