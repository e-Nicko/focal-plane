# Contributing

**English** · [Русский](CONTRIBUTING.ru.md) · [中文](CONTRIBUTING.zh.md)

Thank you for improving Focal Plane.
A few rules keep it coherent.

## Code

- **Every frame is a function of time.**
  No `Math.random`, `Date` or `performance.now` in shots, data or the engine's frame path.
  Seed any randomness.
- **Shots are plain objects**: `{ id, duration, size, camera, state, draw }`.
  Keep `state(t)` pure and `draw()` synchronous.
- **Match the surrounding code**: its naming, its comment density, its idiom.
- **Comments explain why**, one clause per line.

## Writing

- **Short pages, one question each.**
  If a page needs a table of contents, split it.
- **[Semantic Line Breaks](https://sembr.org/)**:
  a new line after each sentence, and after a clause where it helps.
  In Chinese, break only after full-width punctuation (。，；：！？),
  so browsers do not insert spaces between characters.
- **English first.**
  The Russian and Chinese pages follow the English ones;
  a change to one is a change to all three.
  Use the words in `docs/glossary.md`.
- **Mark your sources.**
  Research claims cite the paper;
  craft conventions are labelled as craft;
  links in `docs/sources.md` carry a reliability mark.

## Before a merge request

- [ ] `bun run typecheck` is clean.
- [ ] `bun run shoot --t=1,5,9,13 --sheet` renders, and you looked at the sheet.
- [ ] If you changed the engine, the kit or the data:
      stills before and after are identical outside what you meant to change.
- [ ] If you changed the example film: `bun run media` rebuilt the cover and the stills.
- [ ] Links in the pages you touched resolve.
