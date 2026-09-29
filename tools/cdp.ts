// A small Chrome DevTools Protocol client for the tools.
// Playwright cannot run under Bun on Windows
// (launch and connectOverCDP both hang, checked with Bun 1.3.13),
// and the tools need very little of it:
// start Chrome with the GPU,
// open a page,
// run a function in it,
// and collect the page's errors.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------- finding and starting Chrome ----------

// CHROME_PATH wins, then the usual install locations.
// Chromium builds often lack the H.264 encoder that the MP4 export needs,
// so the tools look for Google Chrome.
export function findChrome(): string {
  const env = process.env.CHROME_PATH;
  if (env) {
    if (!existsSync(env)) throw new Error(`CHROME_PATH points to a file that does not exist: ${env}`);
    return env;
  }
  const win = ['PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA']
    .map((k) => process.env[k])
    .filter((v): v is string => !!v)
    .map((base) => join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  const found =
    process.platform === 'win32' ? win.find(existsSync)
    : process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync)
    : ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'].map((n) => Bun.which(n)).find((p) => p);
  if (!found) throw new Error('Google Chrome was not found. Install it, or set CHROME_PATH to the browser executable.');
  return found;
}

// The GPU stays on in headless mode:
// ANGLE on Direct3D 11 on Windows, the default backend elsewhere.
// Field trials are switched off:
// they are experiments Chrome assigns per machine,
// and a renderer wants the same browser behaviour everywhere.
// The rest keeps a page rendering at full speed with nobody looking at it,
// and keeps Chrome from talking to the network or the keychain.
const CHROME_ARGS = [
  '--headless=new',
  '--disable-field-trial-config',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-extensions',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-breakpad',
  '--metrics-recording-only',
  '--password-store=basic',
  '--use-mock-keychain',
  '--enable-gpu',
  '--ignore-gpu-blocklist',
  ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
  '--force-color-profile=srgb',
  '--hide-scrollbars',
  '--mute-audio',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];

// ---------- the protocol connection ----------

type Params = Record<string, unknown>;
type Reply = { id: number; result?: any; error?: { code: number; message: string }; sessionId?: string };
type Event = { method: string; params: any; sessionId?: string };

class Connection {
  private nextId = 0;
  private pending = new Map<number, (r: Reply) => void>();
  private listeners: ((e: Event) => void)[] = [];
  private ws: WebSocket;
  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener('message', (m) => {
      const msg = JSON.parse(m.data as string);
      if (msg.id !== undefined) {
        this.pending.get(msg.id)?.(msg);
        this.pending.delete(msg.id);
      } else for (const l of this.listeners) l(msg);
    });
    ws.addEventListener('close', () => {
      // a call still waiting when the socket closes will never be answered
      for (const [id, done] of this.pending) done({ id, error: { code: -1, message: 'the browser connection closed' } });
      this.pending.clear();
    });
  }

  static async open(url: string): Promise<Connection> {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)), { once: true });
    });
    return new Connection(ws);
  }

  send(method: string, params: Params = {}, sessionId?: string): Promise<any> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (r) => (r.error ? reject(new Error(`${method}: ${r.error.message}`)) : resolve(r.result)));
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  on(listener: (e: Event) => void): void {
    this.listeners.push(listener);
  }

  close(): void {
    this.ws.close();
  }
}

// ---------- pages ----------

interface ExceptionDetails {
  text?: string;
  exception?: { description?: string };
}
interface RemoteObject {
  type: string;
  value?: unknown;
  description?: string;
}
const describeException = (d: ExceptionDetails): string => d.exception?.description || d.text || 'script error';
const remoteValue = (a: RemoteObject): string => String(a.value ?? a.description ?? a.type);

export class Page {
  // Everything the page reported as wrong: exceptions, console errors, failed loads.
  readonly errors: string[] = [];
  private consoleListeners: ((text: string) => void)[] = [];

  private conn: Connection;
  private sessionId: string;
  private targetId: string;

  constructor(conn: Connection, sessionId: string, targetId: string) {
    this.conn = conn;
    this.sessionId = sessionId;
    this.targetId = targetId;
    conn.on((e) => {
      if (e.sessionId !== sessionId) return;
      if (e.method === 'Runtime.exceptionThrown') this.errors.push(`pageerror: ${describeException(e.params.exceptionDetails)}`);
      else if (e.method === 'Runtime.consoleAPICalled') {
        const text = (e.params.args as RemoteObject[]).map(remoteValue).join(' ');
        if (e.params.type === 'error') this.errors.push(text);
        for (const l of this.consoleListeners) l(text);
      }
      else if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') this.errors.push(`${e.params.entry.text} ${e.params.entry.url ?? ''}`.trim());
      else if (e.method === 'Inspector.targetCrashed') this.errors.push('the page crashed');
    });
  }

  private send(method: string, params: Params = {}): Promise<any> {
    return this.conn.send(method, params, this.sessionId);
  }

  // Calls back with every line the page writes to its console.
  onConsole(listener: (text: string) => void): void {
    this.consoleListeners.push(listener);
  }

  async init(width: number, height: number): Promise<void> {
    await Promise.all([this.send('Runtime.enable'), this.send('Log.enable'), this.send('Page.enable')]);
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  }

  async goto(url: string): Promise<void> {
    const r = await this.send('Page.navigate', { url });
    if (r.errorText) throw new Error(`cannot open ${url}: ${r.errorText}`);
  }

  // Runs a function in the page and returns its result, awaiting a promise.
  // The function is sent as source text,
  // so it may use only its argument and the page's own globals, never a variable of the tool.
  async evaluate<A, R>(fn: (arg: A) => R | Promise<R>, arg?: A): Promise<Awaited<R>> {
    const expression = `(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`;
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(describeException(r.exceptionDetails));
    return r.result.value;
  }

  // Polls until the function returns something truthy.
  async waitFor(fn: () => unknown, { timeout = 30_000, interval = 100 } = {}): Promise<void> {
    const until = Date.now() + timeout;
    while (!(await this.evaluate(fn))) {
      if (Date.now() > until) throw new Error(`timed out after ${timeout} ms\n  ${this.errors.join('\n  ')}`);
      await sleep(interval);
    }
  }

  async close(): Promise<void> {
    await this.conn.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {});
  }
}

// ---------- the browser ----------

export class Browser {
  private proc: ReturnType<typeof Bun.spawn>;
  private conn: Connection;
  private profile: string;

  private constructor(proc: ReturnType<typeof Bun.spawn>, conn: Connection, profile: string) {
    this.proc = proc;
    this.conn = conn;
    this.profile = profile;
  }

  static async launch(): Promise<Browser> {
    const profile = mkdtempSync(join(tmpdir(), 'focal-plane-chrome-'));
    // CHROME_FLAGS adds switches, for trying something out: CHROME_FLAGS="--disable-gpu-rasterization"
    const extra = (process.env.CHROME_FLAGS ?? '').split(/\s+/).filter(Boolean);
    const proc = Bun.spawn([findChrome(), '--remote-debugging-port=0', `--user-data-dir=${profile}`, ...CHROME_ARGS, ...extra, 'about:blank'], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
    try {
      // Chrome writes the debugging port and the browser endpoint into the profile folder
      const file = join(profile, 'DevToolsActivePort');
      const until = Date.now() + 30_000;
      while (!existsSync(file) || readFileSync(file, 'utf8').split('\n').length < 2) {
        if (proc.exitCode !== null) throw new Error(`Chrome exited with code ${proc.exitCode} before it was ready`);
        if (Date.now() > until) throw new Error('Chrome did not start in 30 seconds');
        await sleep(50);
      }
      const [port, path] = readFileSync(file, 'utf8').split('\n');
      const browser = new Browser(proc, await Connection.open(`ws://127.0.0.1:${port}${path}`), profile);
      // the tools kill only the Chrome they started
      process.on('exit', () => proc.kill());
      return browser;
    } catch (e) {
      proc.kill();
      rmSync(profile, { recursive: true, force: true });
      throw e;
    }
  }

  get version(): Promise<string> {
    return this.conn.send('Browser.getVersion').then((r) => r.product);
  }

  async newPage(width = 1280, height = 720): Promise<Page> {
    const { targetId } = await this.conn.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.conn.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this.conn, sessionId, targetId);
    await page.init(width, height);
    return page;
  }

  async close(): Promise<void> {
    await this.conn.send('Browser.close').catch(() => {});
    this.conn.close();
    // give Chrome a moment to leave on its own, then make sure
    for (let i = 0; i < 40 && this.proc.exitCode === null; i++) await sleep(50);
    this.proc.kill();
    await this.proc.exited;
    // Windows keeps a profile file open for a moment after the process exits
    for (let i = 0; i < 10; i++) {
      try {
        rmSync(this.profile, { recursive: true, force: true });
        return;
      } catch {
        await sleep(200);
      }
    }
  }
}
