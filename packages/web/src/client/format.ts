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

export function levelSeverity(level: string): TestStatus {
  if (level === 'error' || level === 'fatal') return 'failed';
  if (level === 'warn' || level === 'warning') return 'running';
  return 'skipped';
}
