# The look

A dark page, grey type, no colour, no glow.
The grade gives the frame the look of film.

## Measured, then matched

The target values come from measuring the reference reel frame by frame
([how we know](how-we-know.md)):

| Measure | Reference | Here |
|---|---|---|
| darkest black | about 12/255 | `lift: 0.045`, 11.5/255 |
| brightest white | about 235/255 | `gain: 236/255` |
| saturation | about 2/255: grey | neutrals with no hue |
| glow | none visible | `bloom: 0.04` |

## The palette

| Token | Value | Use |
|---|---|---|
| `page` | `#0c0c0c` | the page and the void around it |
| `ink` | `#ececec` | the one thing the shot is about |
| `ink2` | `#a0a0a0` | secondary text |
| `ink3` | `#6a6a6a` | labels, axes |
| `ink4` | `#3c3c3c` | whatever is off |

Hierarchy comes from lightness and from focus.
There is no accent colour to fall back on,
so every shot has to decide which thing gets `ink`.

The type is IBM Plex Sans and IBM Plex Mono,
shipped in `fonts/` so every machine renders the same glyphs.

## The grade, in order

1. **Bloom**, almost none (0.04).
2. **Exposure**, then the Khronos PBR Neutral tone map,
   which keeps greys grey while it rolls highlights off.
3. **Chromatic aberration** (0.0025), growing towards the corners.
4. **Vignette** (0.28), soft.
5. **Lift and gain** in display space:
   black never goes below 11.5/255, white never above 236/255.
   A film print never reaches pure black,
   and the lifted black keeps dark bokeh visible against the page.
6. **Grain** (0.02), strongest in the midtones, as on film.
   It also hides banding in the smooth bokeh.
7. **Dither** of one level, against banding in the 8-bit output.

The fades at the start and the end go to the lifted black.

## When to change it

For a GIF, set `grain: 0` and `ca: 0`:
noise is the one thing a GIF cannot compress
([the pipeline](pipeline.md)).
For a brand with a colour, keep the page grey
and spend the colour on the one thing the shot is about.

Next: [why it works](why-it-works.md).
