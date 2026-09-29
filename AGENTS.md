# Working on Focal Plane

Focal Plane makes 2.5D motion UI films in the browser:
a flat canvas-2D interface lies on a plane in 3D, a thin-lens camera films it,
the film is cut into short shots and rendered frame by frame to 4K60 MP4.
The [README](README.md) has the pitch, and [docs/en](docs/en/README.md) has the craft.

This is the entry point for coding agents.
The rules are in [.agents/rules](.agents/rules), and [.agents/README.md](.agents/README.md) says how to apply them.
The skill that teaches agents to make films is [skills/focal-plane](skills/focal-plane/SKILL.md).
It is a product of this repository, and it is not a set of rules for working on it.

## Invariants

- A frame is a pure function of time: no clock, no randomness that is not seeded,
  no state carried between frames — [determinism](.agents/rules/determinism.mdc).
- Types first, then pixels.
  A report says which of "types pass", "the still looks right", "the render finished"
  and "the MP4 decodes and looks right" it checked — [verification](.agents/rules/verification.mdc).
- The repository is public and MIT-licensed.
  Nothing of unknown origin goes in, and the reference reel stays out — [provenance](.agents/rules/provenance.mdc).
- The docs come in three languages, English first.
  A change to one page is a change to all three — [translations](.agents/rules/translations.mdc).
- Nothing loads from the network at run time: libraries come from `node_modules/`, fonts from `fonts/`.

## Stack

- Bun 1.2 or newer for the tools, the development server and the build.
  Sources are TypeScript with `strict`, checked by tsc and stripped of types by Bun.
- three.js 0.180.0 for the page plane, the camera and the passes; mp4-muxer 5.2.2 with WebCodecs for the MP4.
- IBM Plex Sans and Mono, shipped in `fonts/`.
- Google Chrome with a GPU, driven over the DevTools protocol by our own client.
  Playwright hangs under Bun on Windows.
- Tested on Windows 11 with an RTX 3060 Ti; other systems are untested.

## Structure

```text
src/kit/             drawing primitives, controls, cursor, easing, seeded randomness
src/engine/          camera, lens and grade passes, player, MP4 export, shared types
src/film/            the example film: data, seven shots, the edit
tools/               server, Chrome client, shoot, render, verify, timings, media, build, check-docs
skills/focal-plane/  the agent skill: SKILL.md, references, templates
docs/                en, ru, zh, the glossary and the sources
fonts/ media/        IBM Plex; the cover, stills and link card built by tools/media.ts
.agents/ AGENTS.md   the rules and this entry point
```

## Commands

```bash
bun install                                      # dependencies
bun run serve                                    # the player at http://127.0.0.1:8790
bun run typecheck                                # tsc --noEmit over src/ and tools/
bun run check:docs                               # line breaks, links, structure of the translations
bun run shoot --shot=forecast --lt=0.3,1.2       # stills, with --sheet a contact sheet
bun run render                                   # out/focal-plane-2160p60.mp4
bun run verify out/focal-plane-2160p60.mp4       # decodes frames from the file
bun run timings                                  # GPU milliseconds per stage
bun run media                                    # cover, stills and link card
bun run build                                    # the static site into public/
```

Write the options after the script name, without `--` in between.

## How we work

- The maintainer sets the task and accepts the result.
  An agent prepares the change and the commit message.
  Commit, push and pull request happen only on the maintainer's request — [git-conventions](.agents/rules/git-conventions.mdc).
- Before editing, run `git status --short`.
  Changes you did not make are someone else's: do not delete, revert or reformat them.
- A change is finished when everything it touched agrees:
  code, the example film and its media, the skill, the docs in three languages, `NOTICE.md` —
  [documentation](.agents/rules/documentation.mdc).
- Composing a shot is a loop on stills: change one camera key, shoot, look, repeat.
  Look at every image; do not infer it from the code.

## Language

The docs are in English first, with Russian and Chinese mirrors.
Code identifiers, comments and commit messages are in English.
Text wraps by meaning — [line-breaks](.agents/rules/line-breaks.mdc).
