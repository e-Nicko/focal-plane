# Pitfalls

Each of these cost time once.
Symptom first, then the cause and the fix.

## In a shot

**State and draw disagree about where text is.**
`state()` computed positions from text widths measured before the fonts loaded.
Measure lazily on the first call, with a private canvas (`shot-api.md`).

**A glyph looks different from its neighbours.**
The font lacks it and the browser used a system font,
so the frame differs between machines.
IBM Plex Mono has no Greek: the kit's mono stack falls back to Plex Sans for σ.
Check new symbols against the fonts in `fonts/`;
`'σ'.toUpperCase()` is `Σ`, which is why `micro()` restores σ.
The check, with `pip install fonttools brotli`:

```bash
python -c "from fontTools.ttLib import TTFont; print(ord('σ') in TTFont('fonts/IBMPlexMono-Regular.woff2').getBestCmap())"
```

Only Sans 400, 500, 600 and Mono 400, 500 are shipped.
Any other weight is synthesised by the browser and looks wrong.

**A number in a label disagrees with the chart.**
It was typed instead of computed.
Derive it from the data module in the shot.

**The subject moves the wrong way when you change `look`.**
Moving `look` down the page moves the content up in the frame.

**Blur everywhere, or nowhere.**
The focus point is off the subject, or `aperture` does not suit the angle:
steep shots need 0.28–0.32, frontal ones 0.4–0.42.

**The cursor covers the effect.**
Aim beside the target and drift away after the click (`composition.md`).

**A frame differs between two renders.**
Something in `state`, `draw` or the data reads the clock or `Math.random`.
Seed it or derive it from `t`.

## In the player and the tools

**`VideoEncoder is not defined`.**
WebCodecs needs a secure context: `https://` or `localhost`.
Serve with `bun run serve`; do not open the file from disk
or set the page content from a script.

**`shoot` waits and times out.**
The film failed to load.
The tool now stops with the page's message;
check the console errors it prints.
Film names are lowercase letters, digits and hyphens.

**A verified MP4 shows the same frame at two times.**
The browser reported the seek before presenting the new frame,
or the server does not support HTTP ranges.
`bun run verify` handles both; keep it for checking renders.

**Timing a stage with `gl.finish()` gives near zero.**
Chrome treats `finish()` as a flush.
Fence with a one-pixel `readPixels`.

## At 4K

**The page upload takes seconds per frame.**
An sRGB canvas texture with `flipY` goes through the CPU in Chrome.
The engine uploads plain RGBA8, unflipped and premultiplied, and decodes sRGB in the shader;
do not change the texture settings in `src/engine/page.ts`.

**MSAA makes the master crawl.**
Multisampling a half-float target at 4K is about twenty times slower.
The master preset uses FXAA instead.

**Text looks soft in the 4K master.**
Page density is 5× in the master; if you changed it, restore it.
If the text is simply small, set it larger: a macro lens looks at a third of the page.

## In the output

**The GIF is huge.**
Grain and chromatic aberration are noise to a GIF.
Set `grain: 0, ca: 0`, use a grey palette, and store only changed pixels (see `tools/media.ts`).

**The film fades in the middle.**
It does not: fades exist only at the start and end of the edit.
A one-shot test film fades out over its last 0.7 s, which can look like a problem in stills.
