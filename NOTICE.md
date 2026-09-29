# Notices

Focal Plane is under the MIT License (see `LICENSE`).
It uses the following work by others.

## Shipped in this repository

- **IBM Plex Sans** 3.005 and **IBM Plex Mono** 2.005,
  Copyright © 2017 IBM Corp. with Reserved Font Name "Plex".
  Unmodified, in `fonts/`, under the SIL Open Font License 1.1 (`fonts/OFL.txt`).
  From the npm packages `@ibm/plex-sans` 1.1.0 and `@ibm/plex-mono` 2.5.0.

## Loaded at run time

Installed by `bun install` at exact versions,
served from `node_modules/` by the development server,
and copied into `public/vendor/` by `bun run build`:

- **three.js** 0.180.0, MIT License, Copyright © 2010–2025 three.js authors.
- **mp4-muxer** 5.2.2, MIT License, by Vanilagy.
  The package is superseded by Mediabunny, from the same author.

## Development only

Installed by `bun install`, not part of the film:

- **TypeScript**, Apache License 2.0, Copyright Microsoft Corporation.
- **@types/three** and **@types/bun**, MIT License, from DefinitelyTyped and the Bun team.
- **gifenc**, MIT License, by Matt DesLauriers.

## Techniques

- The tone map in `src/engine/shaders.ts` follows the
  [Khronos PBR Neutral](https://github.com/KhronosGroup/ToneMapping/tree/main/PBR_Neutral)
  reference implementation, Apache License 2.0.
- The bokeh gather follows Dennis Gustafsson's
  [single-pass bokeh depth of field](https://blog.voxagon.se/2018/05/04/bokeh-depth-of-field-in-single-pass.html) (2018).

## The example film

The company, the product and the numbers in the example film are fictional.
The reference reel we measured to set the look is not included;
its rights are unknown.
