// Checks the text of the repository against .agents/rules/line-breaks.mdc,
// documentation.mdc and translations.mdc.
//
//   sembr     a prose line holds two sentences (Markdown, rules, comments in code)
//   cjk-break a Chinese line ends where a browser would insert a space into the sentence
//   space     trailing spaces in Markdown, where two of them make a visible line break
//   link      a relative link or image whose target does not exist
//   parity    a translation whose headings, tables, code blocks or list items
//             do not match the English page
//
// Usage: bun run check:docs [files...]
// Without files it reads every .md, .mdc, .ts and .yml in the repository.
// Exit code 1 when anything is found.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SKIP = new Set(['node_modules', 'out', 'public', '.git']);

interface Problem {
  file: string;
  line: number;
  rule: string;
  text: string;
}
const problems: Problem[] = [];
const report = (file: string, line: number, rule: string, text: string): void => {
  problems.push({ file: relative(ROOT, file).split(sep).join('/'), line, rule, text });
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(md|mdc|ts|yml)$/.test(name)) out.push(p);
  }
  return out;
}

// ---------- sentences ----------

// Words that end in a full stop without ending a sentence.
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'vs', 'etc', 'al', 'fig', 'approx', 'no', 'cf', 'ca', 'pp', 'vol', 'ed', 'dr', 'mr', 'ms']);
const CLOSERS = '"\'”’»)\\]*_';
const LATIN_BOUNDARY = new RegExp(`([.!?…])[${CLOSERS}]*\\s+(?=[\\p{Lu}«"“(\\[*])`, 'gu');
const CJK_BOUNDARY = new RegExp(`[。！？][${CLOSERS}」』）]*(?=\\S)`, 'u');
const CJK = /[㐀-鿿]/u;

// The text of a line with the parts that hold no sentences taken out.
function prose(line: string): string {
  return line
    .replace(/^\s*([-*+]|\d+\.)\s+/, '')
    .replace(/`[^`]*`/g, 'X')
    .replace(/\]\([^)]*\)/g, ']()')
    .replace(/https?:\/\/\S+/g, 'URL')
    .replace(/<[^>]+>/g, '');
}

// True when the text holds the end of a sentence and the start of another.
function twoSentences(text: string): boolean {
  if (CJK.test(text) && CJK_BOUNDARY.test(text)) return true;
  for (const m of text.matchAll(LATIN_BOUNDARY)) {
    const before = text.slice(0, m.index! + 1);
    const word = /(\S+)$/.exec(before)?.[1] ?? '';
    const bare = word.replace(/^[("'“«\[*_]+/, '').replace(/[.!?…]+$/, '');
    if (m[1] === '.' && (/^\p{Lu}$/u.test(bare) || ABBREVIATIONS.has(bare.toLowerCase()))) continue;   // initials and abbreviations
    return true;
  }
  return false;
}

// ---------- Markdown ----------

interface Line {
  no: number;
  text: string;
}

// The prose lines of a Markdown file: no code blocks, frontmatter, headings, tables or HTML.
function proseLines(source: string): Line[] {
  const out: Line[] = [];
  let fence = false, front = source.startsWith('---');
  source.split('\n').forEach((raw, i) => {
    const text = raw.replace(/\r$/, '');
    if (front) {
      if (i > 0 && text.trim() === '---') front = false;
      return;
    }
    if (/^\s*```/.test(text)) {
      fence = !fence;
      return;
    }
    if (fence || !text.trim() || /^#{1,6}\s/.test(text) || /^\s*\|/.test(text) || /^\s*</.test(text) || /^-{3,}$/.test(text.trim())) return;
    out.push({ no: i + 1, text });
  });
  return out;
}

const isChinese = (file: string): boolean => /(^|[\\/])zh[\\/]/.test(relative(ROOT, file)) || file.endsWith('.zh.md');

function checkMarkdown(file: string, source: string): void {
  const lines = proseLines(source);
  const zh = isChinese(file);
  lines.forEach((l, k) => {
    if (twoSentences(prose(l.text))) report(file, l.no, 'sembr', l.text.trim().slice(0, 90));
    if (/[ \t]+$/.test(l.text)) report(file, l.no, 'space', 'trailing spaces');
    const next = lines[k + 1];
    if (zh && next && next.no === l.no + 1 && !/^\s*([-*+]|\d+\.)\s/.test(next.text)) {
      // a soft line break becomes a space in the browser, unless it follows full-width punctuation
      const last = l.text.trimEnd().slice(-1), first = next.text.trimStart().charAt(0);
      if ((CJK.test(last) || /[A-Za-z0-9`]/.test(last)) && CJK.test(first)) report(file, l.no, 'cjk-break', `line ends with "${last}" and the next one starts with "${first}"`);
    }
  });
  checkLinks(file, source);
}

function checkLinks(file: string, source: string): void {
  let fence = false;
  source.split('\n').forEach((raw, i) => {
    if (/^\s*```/.test(raw)) fence = !fence;
    if (fence) return;
    const text = raw.replace(/`[^`]*`/g, '');
    const targets = [...text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
    targets.push(...[...text.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]));
    for (const target of targets) {
      if (/^([a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
      const path = decodeURI(target.split('#')[0].split('?')[0]);
      if (!path) continue;
      const full = path.startsWith('/') ? join(ROOT, path) : resolve(dirname(file), path);
      if (!existsSync(full)) report(file, i + 1, 'link', target);
    }
  });
}

// ---------- comments in code ----------

function checkCode(file: string, source: string): void {
  const hash = file.endsWith('.yml');
  source.split('\n').forEach((raw, i) => {
    const m = hash ? /(?:^|\s)#\s(.*)$/.exec(raw) : /(?:^|\s)\/\/\s(.*)$/.exec(raw) ?? /^\s*(?:\/\*+|\*)\s(.*)$/.exec(raw);
    if (m && twoSentences(prose(m[1]))) report(file, i + 1, 'sembr', raw.trim().slice(0, 90));
  });
}

// ---------- translations ----------

function shape(source: string): Record<string, number> {
  const count = { headings: 0, 'table rows': 0, 'code blocks': 0, 'list items': 0 };
  let fence = false;
  for (const text of source.split('\n')) {
    if (/^\s*```/.test(text)) {
      fence = !fence;
      if (fence) count['code blocks']++;
      continue;
    }
    if (fence) continue;
    if (/^#{1,6}\s/.test(text)) count.headings++;
    else if (/^\s*\|/.test(text)) count['table rows']++;
    else if (/^\s*([-*+]|\d+\.)\s/.test(text)) count['list items']++;
  }
  return count;
}

function checkParity(): void {
  const pairs: [string, string][] = [];
  for (const name of readdirSync(join(ROOT, 'docs', 'en'))) {
    for (const lang of ['ru', 'zh']) pairs.push([join('docs', 'en', name), join('docs', lang, name)]);
  }
  for (const base of ['README', 'CONTRIBUTING']) for (const lang of ['ru', 'zh']) pairs.push([`${base}.md`, `${base}.${lang}.md`]);
  for (const [en, tr] of pairs) {
    const a = join(ROOT, en), b = join(ROOT, tr);
    if (!existsSync(b)) {
      report(a, 1, 'parity', `no translation at ${tr.split(sep).join('/')}`);
      continue;
    }
    const x = shape(readFileSync(a, 'utf8')), y = shape(readFileSync(b, 'utf8'));
    for (const key of Object.keys(x)) if (x[key] !== y[key]) report(b, 1, 'parity', `${key}: ${x[key]} in ${en.split(sep).join('/')}, ${y[key]} here`);
  }
}

// ---------- run ----------

const given = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = given.length ? given.map((f) => resolve(f)) : walk(ROOT);
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  if (/\.(md|mdc)$/.test(file)) checkMarkdown(file, source);
  else checkCode(file, source);
}
if (!given.length) checkParity();

for (const p of problems) console.log(`${p.file}:${p.line}: ${p.rule}: ${p.text}`);
console.log(`${files.length} files, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
