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

export function classifyStack(stack: string): StackLine[] {
  return stripAnsi(stack).split('\n').map((text) => {
    if (!FRAME_RE.test(text)) return { text, kind: 'head' as const };
    if (INTERNAL_RE.test(text)) return { text, kind: 'internal' as const };
    const match = text.match(LOC_RE);
    if (!match || match.index === undefined) return { text, kind: 'frame' as const };
    return {
      text,
      kind: 'frame' as const,
      loc: {
        pre: text.slice(0, match.index),
        location: match[1],
        post: text.slice(match.index + match[1].length),
      },
    };
  });
}

export function levelSeverity(level: string): TestStatus {
  if (level === 'error' || level === 'fatal') return 'failed';
  if (level === 'warn' || level === 'warning') return 'running';
  return 'skipped';
}
