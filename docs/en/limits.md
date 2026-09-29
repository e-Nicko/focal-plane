# What it can't do

The method is narrow on purpose.
These are its edges.

## In the frame

- **One page per shot.**
  Each shot is a single canvas on a single plane.
  Depth inside a shot comes from the camera's angle to that plane;
  there are no layers floating at different heights.
- **Canvas 2D only.**
  There is no DOM and no CSS layout in the frame.
  Every element is placed by hand in page pixels.
- **No real 3D objects.**
  Glass, reflections and extruded shapes belong to the neighbouring genre, the product render.
- **Monochrome by design.**
  Colour works, but the grade and these pages assume grey.
- **No audio.**

## In the machine

- **Chrome with a GPU.**
  The tools drive the installed Google Chrome over the DevTools protocol,
  with a small client of their own in `tools/cdp.ts`
  (Playwright does not run under Bun on Windows).
  The player needs WebGL 2, and the MP4 export needs WebCodecs,
  which only runs on `https://` or a loopback address such as `localhost`.
  Other browsers are untested,
  and so is every operating system except Windows 11.
- **Repeatable on one machine, up to GPU noise.**
  The times, the data and the camera are exact.
  Two renders of one frame on the same GPU and driver differed by one level of 8-bit colour
  in at most 0.0015% of the pixels in our runs.
  Other GPUs may differ more, in the last bits of shader arithmetic.
- **Encoding speed.**
  On an RTX 3060 Ti the 4K60 master renders and encodes at 16 to 20 frames a second,
  so the sixteen-second film takes about a minute.
- **mp4-muxer is deprecated.**
  Its author now maintains Mediabunny.
  mp4-muxer still works,
  and moving is a contained change in `src/engine/export.ts`.

## In the craft

- **The cursor is scripted.**
  Each shot writes its own path; there is no planner.
- **The type must be large.**
  A macro lens on a 4K frame looks at a third of a page;
  text under about 13 px on the page turns to texture.
- **Blur costs detail on small screens.**
  On a phone, the difference between sharp and soft shrinks,
  and the effect weakens.

Back to [the documentation](README.md).
