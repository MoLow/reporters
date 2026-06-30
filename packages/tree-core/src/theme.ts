import type { TestStatus } from './types.ts';

export const SYMBOLS: Record<TestStatus, string> = {
  passed: '✔',
  failed: '✖',
  skipped: '⏭',
  todo: '☐',
  running: '◌',
  queued: '·',
};

export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** Ink (terminal) color names per status. */
export const INK_COLOR: Record<TestStatus, string> = {
  passed: 'green',
  failed: 'red',
  skipped: 'yellow',
  todo: 'cyan',
  running: 'blue',
  queued: 'gray',
};

/** CSS color tokens per status, for the web renderers. */
export const WEB_COLOR: Record<TestStatus, string> = {
  passed: '#3fb950',
  failed: '#f85149',
  skipped: '#d29922',
  todo: '#a371f7',
  running: '#58a6ff',
  queued: '#8b949e',
};

export const STATUS_LABEL: Record<TestStatus, string> = {
  passed: 'passed',
  failed: 'failed',
  skipped: 'skipped',
  todo: 'todo',
  running: 'running',
  queued: 'queued',
};

export const TREE_GUIDES = {
  vertical: '│ ',
  branch: '├─',
  last: '└─',
  space: '  ',
};
