# Verification

A frame you have not looked at is a guess.
This is the loop, and what to look for.

## The still loop

1. Pick three to five times per shot:
   just after the cut, the click, the middle of the rack, the landed label, the last frame.
2. `bun run shoot --film=<film> --shot=<id> --lt=... --w=1280 --h=720 --tag=<id> --sheet`.
3. Open every image.
4. Change one thing: one camera field, one timing, one position.
5. Shoot again with a new `--tag`, and compare.

Draft quality (`--q=draft`) is fine for framing;
check focus and text at the default `--q=high`,
and look at `--q=master` before the last contact sheet.

## Checklist for every still

- [ ] The frame answers the shot's one-sentence idea without the frames around it.
- [ ] The cause and the effect are both inside the frame when the effect happens.
- [ ] The focused element is sharp and legible; nothing important is cut by the frame edge.
- [ ] The cursor does not cover the control it clicks, or the effect.
- [ ] One thing is `ink`-bright; the rest steps down.
- [ ] There is a foreground element nearer than the focus, soft, or clear negative space.
- [ ] No text in the frame names a value the chart does not show.
- [ ] No glyph looks different from its neighbours (a fallback font).
- [ ] Motion starts within the first few frames after the cut.

## Checklist for the whole edit

Shoot the frame after each cut and the middle of each shot on one sheet.

- [ ] Every number that appears twice is the same number.
- [ ] Steep and calm angles alternate; the side flips only with a new subject.
- [ ] Shot lengths stay within 1.8–2.6 s.
- [ ] The poster frame tells the story on its own.

## Checking a render

```bash
bun run render --film=<film>
bun run verify out/<film>-2160p60.mp4 --at=1,5,9,13
```

- [ ] Resolution, duration and bitrate are what you asked for (verify prints them).
- [ ] The decoded frames match the stills at the same times.
- [ ] No black or repeated frames at the cuts.

Report these numbers to the user, and say which frames you looked at.

## Checking a change to shared code

When you change the kit, the engine or the data,
render the same times before and after and compare the pixels.
A difference outside the element you meant to change is a regression.
A small script can drive both versions through `tools/cdp.ts` and diff `shot(t, 'image/png')`;
report how many frames were identical and where the others differed.

## Measuring speed

`bun run timings --w=3840 --h=2160 --t=1,6,12` prints GPU milliseconds per stage.
Measure before optimising.
On an RTX 3060 Ti at 4K, the master spends
13–57 ms on the scene, 16–20 ms on depth of field, 2–5 ms on bloom and 1–2.5 ms on the grade.
