// The development server, and the server the tools drive.
//
// - Static files from the repository root.
// - TypeScript for the browser: a request for /x.js is answered from x.ts
//   (transpiled on the fly, types stripped, nothing else rewritten)
//   when there is no x.js.
//   The sources import each other with .js extensions,
//   so the same URLs work here and in the built site.
// - /vendor/three/ and /vendor/mp4-muxer/ come from node_modules,
//   so the film needs no CDN and renders offline.
// - HTTP byte ranges, so a <video> can seek in a rendered file.
// - For the tools only: PUT /__upload/<token>/<name> hands a binary from the page
//   to the tool without base64 in between,
//   and /__mount/<name>/ serves one more folder (to look at a file outside the repository).
//
// Localhost is a secure context, which WebCodecs needs for the in-browser MP4 master.
//
// Usage: bun tools/server.ts [port]      (default 8790)

import { existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

export const ROOT = resolve(import.meta.dir, '..');

// what /vendor/<name>/ serves
export const VENDOR: Record<string, string> = {
  three: join(ROOT, 'node_modules', 'three', 'build'),
  'mp4-muxer': join(ROOT, 'node_modules', 'mp4-muxer', 'build'),
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.ts': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
};

const BLANK = '<!doctype html><meta charset="utf-8"><title>blank</title><link rel="icon" href="data:,">';

const transpiler = new Bun.Transpiler({ loader: 'ts', target: 'browser' });

// Types stripped, imports untouched.
export function toJs(source: string): string {
  return transpiler.transformSync(source);
}

const isFile = (p: string) => existsSync(p) && statSync(p).isFile();

export interface Served {
  // http://127.0.0.1:<port>/
  url: string;
  port: number;
  // what the page has uploaded, by name
  inbox: Map<string, Uint8Array>;
  // the path the page PUTs to, for uploads enabled with { uploads: true }
  uploadUrl(name: string): string;
  stop(): void;
}

export interface ServerOptions {
  port?: number;
  // accept PUT /__upload/<token>/<name>
  uploads?: boolean;
  // extra folders served under /__mount/<name>/
  mounts?: Record<string, string>;
}

export function startServer({ port = 0, uploads = false, mounts = {} }: ServerOptions = {}): Served {
  const inbox = new Map<string, Uint8Array>();
  const token = crypto.randomUUID();
  // a cache of transpiled sources, keyed by path and modification time
  const cache = new Map<string, { mtime: number; js: string }>();

  async function transpiled(ts: string): Promise<string> {
    const mtime = statSync(ts).mtimeMs;
    const hit = cache.get(ts);
    if (hit && hit.mtime === mtime) return hit.js;
    const js = toJs(await Bun.file(ts).text());
    cache.set(ts, { mtime, js });
    return js;
  }

  function file(path: string, req: Request): Response {
    const type = MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
    const size = statSync(path).size;
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? +range[1] : Math.max(0, size - +range[2]);
      const end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
      if (start > end || start >= size) return new Response('range not satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      return new Response(Bun.file(path).slice(start, end + 1), {
        status: 206,
        headers: { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes' },
      });
    }
    return new Response(Bun.file(path), { headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' } });
  }

  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    // a 4K60 master is over 100 MB
    maxRequestBodySize: 2 * 1024 ** 3,
    async fetch(req) {
      const { pathname } = new URL(req.url);
      let rel: string;
      try {
        rel = decodeURIComponent(pathname);
      } catch {
        return new Response('bad request', { status: 400 });
      }

      if (uploads && req.method === 'PUT' && rel.startsWith(`/__upload/${token}/`)) {
        inbox.set(rel.slice(`/__upload/${token}/`.length), new Uint8Array(await req.arrayBuffer()));
        return new Response('ok');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('method not allowed', { status: 405 });
      if (rel === '/__blank') return new Response(BLANK, { headers: { 'Content-Type': MIME['.html'] } });

      // a folder the tool asked to serve
      const mount = /^\/__mount\/([^/]+)\/(.+)$/.exec(rel);
      if (mount) {
        const dir = mounts[mount[1]];
        const p = dir && resolve(dir, mount[2]);
        return p && p.startsWith(resolve(dir) + sep) && isFile(p) ? file(p, req) : new Response('404', { status: 404 });
      }

      // third-party code from node_modules
      const vendor = /^\/vendor\/([^/]+)\/(.+)$/.exec(rel);
      if (vendor) {
        const dir = VENDOR[vendor[1]];
        const p = dir && resolve(dir, vendor[2]);
        return p && p.startsWith(dir + sep) && isFile(p) ? file(p, req) : new Response('404', { status: 404 });
      }

      // the repository: no dotfiles, no node_modules, nothing outside the root
      if (rel.split('/').some((s) => s.startsWith('.') || s === 'node_modules')) return new Response('404', { status: 404 });
      let p = resolve(ROOT, '.' + rel);
      if (p !== ROOT && !p.startsWith(ROOT + sep)) return new Response('404', { status: 404 });
      if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');

      if (isFile(p)) {
        if (p.endsWith('.ts')) return new Response(await transpiled(p), { headers: { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' } });
        return file(p, req);
      }
      // /x.js from x.ts
      if (p.endsWith('.js') && isFile(p.slice(0, -3) + '.ts')) {
        return new Response(await transpiled(p.slice(0, -3) + '.ts'), { headers: { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' } });
      }
      return new Response('404', { status: 404 });
    },
  });

  const base = `http://127.0.0.1:${server.port}/`;
  return {
    url: base,
    port: server.port!,
    inbox,
    uploadUrl: (name) => `${base}__upload/${token}/${name}`,
    stop: () => server.stop(true),
  };
}

if (import.meta.main) {
  const { url } = startServer({ port: +(process.argv[2] ?? 8790) });
  console.log(url);
}
