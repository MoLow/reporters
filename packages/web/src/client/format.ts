import type { TestStatus } from '@reporters/tree-core';

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

const LEVEL_RE = /^\s*(?:\[[^\]]*\]\s*)?(trace|debug|info|warn|warning|error|fatal)\s*:/i;

/** Best-effort log level from a leading `[time] LEVEL:` / `LEVEL:` prefix, else null. */
export function extractLevel(message: string): string | null {
  const match = stripAnsi(message).match(LEVEL_RE);
  return match ? match[1].toLowerCase() : null;
}

export interface StackLine {
  text: string;
  kind: 'head' | 'frame' | 'internal';
  loc?: { pre: string; location: string; post: string };
}

const FRAME_RE = /^\s+at\s/;
const INTERNAL_RE = /\(node:|\snode:|node_modules[/\\]/;
const LOC_RE = /((?:file:\/\/)?[^()\s]+:\d+:\d+)/;

/** Classify a single line as a stack frame (dimmed internals, located user code), or null. */
export function classifyFrame(line: string): StackLine | null {
  const text = stripAnsi(line);
  if (!FRAME_RE.test(text)) return null;
  if (INTERNAL_RE.test(text)) return { text, kind: 'internal' };
  const match = text.match(LOC_RE);
  if (!match || match.index === undefined) return { text, kind: 'frame' };
  return {
    text,
    kind: 'frame',
    loc: {
      pre: text.slice(0, match.index),
      location: match[1],
      post: text.slice(match.index + match[1].length),
    },
  };
}

export function classifyStack(stack: string): StackLine[] {
  return stripAnsi(stack).split('\n').map((text) => classifyFrame(text) ?? { text, kind: 'head' as const });
}

export function levelSeverity(level: string): TestStatus {
  if (level === 'error' || level === 'fatal') return 'failed';
  if (level === 'warn' || level === 'warning') return 'running';
  return 'skipped';
}

/** Compact count for section headers: exact under 1000, `1.9k` above. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  const rounded = Math.round(k * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}k`;
}

export interface TextSegment { kind: 'text' | 'url'; text: string; }

const URL_RE = /https?:\/\/[^\s"'<>()\][]+/g;

export function splitUrls(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    if (match.index > last) segments.push({ kind: 'text', text: text.slice(last, match.index) });
    segments.push({ kind: 'url', text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length || segments.length === 0) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}
