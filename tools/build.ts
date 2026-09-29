// Builds the player as a static site into public/, for GitHub Pages or GitLab Pages.
//
// The site is the same files the development server serves:
// index.html, the sources with their types stripped, the fonts,
// the link-preview card and the two libraries from node_modules.
// Pages is served over HTTPS, so the in-browser MP4 render works there too.
//
// Usage: bun run build

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, VENDOR, toJs } from './server.js';

const OUT = join(ROOT, 'public');

// the files of a library the browser actually loads
const LIBRARY_FILES: Record<string, string[]> = {
  three: ['three.module.min.js', 'three.core.min.js'],
  'mp4-muxer': ['mp4-muxer.mjs'],
};

// Writes every .ts under dir as .js, and copies any other file as it is.
async function copySources(dir: string, to: string): Promise<number> {
  let n = 0;
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(dir)) {
    const from = join(dir, name);
    if (statSync(from).isDirectory()) n += await copySources(from, join(to, name));
    else if (name.endsWith('.ts')) {
      await Bun.write(join(to, name.replace(/\.ts$/, '.js')), toJs(await Bun.file(from).text()));
      n++;
    } else {
      cpSync(from, join(to, name));
      n++;
    }
  }
  return n;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, 'index.html'), join(OUT, 'index.html'));
cpSync(join(ROOT, 'fonts'), join(OUT, 'fonts'), { recursive: true });
// the card that link previews of the site show
mkdirSync(join(OUT, 'media'), { recursive: true });
cpSync(join(ROOT, 'media', 'social.png'), join(OUT, 'media', 'social.png'));
const sources = await copySources(join(ROOT, 'src'), join(OUT, 'src'));

for (const [name, files] of Object.entries(LIBRARY_FILES)) {
  mkdirSync(join(OUT, 'vendor', name), { recursive: true });
  for (const f of files) {
    const from = join(VENDOR[name], f);
    if (!existsSync(from)) throw new Error(`${relative(ROOT, from)} is missing; run "bun install" first.`);
    cpSync(from, join(OUT, 'vendor', name, f));
  }
}
console.log(`public/: index.html, ${sources} source files, fonts, vendor`);
