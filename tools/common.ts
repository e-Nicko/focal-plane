// What every tool needs:
// arguments, a Chrome to drive, and a page in capture mode.

import { Browser, type Page } from './cdp.js';
import { startServer, type Served, type ServerOptions } from './server.js';

// A tool's errors are for its user: the message, and the stack only when DEBUG is set.
const fail = (e: unknown): never => {
  console.error(`error: ${process.env.DEBUG && e instanceof Error ? e.stack : e instanceof Error ? e.message : e}`);
  process.exit(1);
};
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

// --name=value, or a fallback.
export function arg(name: string): string | undefined;
export function arg(name: string, fallback: string): string;
export function arg(name: string, fallback?: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : fallback;
}

export const flag = (name: string): boolean => process.argv.includes(`--${name}`);

// The first argument that is not an option.
export const positional = (): string | undefined => process.argv.slice(2).find((a) => !a.startsWith('--'));

export interface Session {
  browser: Browser;
  server: Served;
  close(): Promise<void>;
}

// A server and a Chrome, closed together.
export async function startSession(options: Pick<ServerOptions, 'mounts'> = {}): Promise<Session> {
  const server = startServer({ uploads: true, ...options });
  try {
    const browser = await Browser.launch();
    return {
      browser,
      server,
      close: async () => {
        await browser.close();
        server.stop();
      },
    };
  } catch (e) {
    server.stop();
    throw e;
  }
}

// Opens the player in capture mode and waits until it is ready for frames.
// --film=<name> picks src/<name>/main.ts instead of the example film.
export async function openCapture(s: Session, w: number, h: number): Promise<Page> {
  const film = arg('film');
  const page = await s.browser.newPage();
  await page.goto(`${s.server.url}index.html?${film ? `film=${encodeURIComponent(film)}&` : ''}capture&w=${w}&h=${h}`);
  await page.waitFor(() => document.documentElement.dataset.ready === '1' || !document.getElementById('fatal')!.hidden, { timeout: 120_000 });
  const fatal = await page.evaluate(() => {
    const el = document.getElementById('fatal')!;
    return el.hidden ? '' : el.textContent ?? '';
  });
  if (fatal) throw new Error([fatal, ...page.errors.map((e) => `  ${e}`)].join('\n'));
  return page;
}

// The errors a page reported, without repeats.
export function reportErrors(page: Page, limit = 20): void {
  const errors = [...new Set(page.errors)];
  if (errors.length) console.log(`PAGE ERRORS:\n  ${errors.slice(0, limit).join('\n  ')}`);
}
