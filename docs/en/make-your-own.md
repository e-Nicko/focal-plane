# Make your own film

A new story in six steps.
An agent can run the same loop with the [skill](../../skills/focal-plane/SKILL.md).

## 1. Write the shot list

One sentence per shot, each with a cause and an effect:

```
1. establish: the page and its headline number
2. the cursor switches round-ups on, and the projected balance rolls up
3. ...
```

Five to eight shots make a film of twelve to twenty seconds.

## 2. Put every number in one module

Create `src/<film>/data.ts`.
Seed any randomness; never call `Math.random()` or read the clock.
Derive every number a shot shows from this module
([honest data](honest-data.md)).

## 3. Write the shots

For each shot, copy `skills/focal-plane/templates/shot.ts`
to `src/<film>/shots/<id>.ts`, then:

- set the page size and draw the page in `draw()`;
- move the cursor, the controls and the values in `state(t)`,
  and return `focus: [x, y]`;
- set two camera keys;
- give the shot a state type,
  so `bun run typecheck` can compare what `state()` returns with what `draw()` reads.

## 4. Assemble the edit

Copy `templates/edit.ts` to `src/<film>/edit.ts` and list the shots.
Copy `templates/main.ts` to `src/<film>/main.ts`.
The player now plays it at `index.html?film=<film>`.
Run `bun run typecheck` before the first frame.

## 5. Compose on stills

```bash
bun run shoot --film=<film> --shot=<id> --lt=0.3,0.8,1.6,2.2 --sheet
```

Look at every frame.
Move `look` down the page to move the content up in the frame,
change `azimuth` and `elevation` for the angle,
and shoot again.
Check the whole edit on one contact sheet before rendering.

## 6. Render and verify

```bash
bun run render --film=<film>
bun run verify out/<film>-2160p60.mp4 --at=1,5,9
```

Look at the decoded frames before you call it done.
Then make a cover: copy `tools/media.ts` and set its `CUT` and `STILLS` to your shots.

Back to [the documentation](README.md).
