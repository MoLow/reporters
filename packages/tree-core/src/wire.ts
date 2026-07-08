import type { TestEvent, TestEventData } from './types.ts';

const ERROR_BASE_KEYS = new Set(['message', 'stack', 'name', 'cause']);
const BARE_KEY_RE = /^[A-Za-z_$][\w$]*$/;

function inspectValue(value: unknown, depth: number, seen: Set<object>): string {
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function') return value.name ? `[Function: ${value.name}]` : '[Function (anonymous)]';
  if (typeof value !== 'object' || value == null) return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  if (seen.has(value)) return '[Circular]';
  if (depth < 0) return Array.isArray(value) ? '[Array]' : '[Object]';
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.length === 0 ? '[]' : `[ ${value.map((v) => inspectValue(v, depth - 1, seen)).join(', ')} ]`;
    }
    const entries = Object.entries(value)
      .map(([k, v]) => `${BARE_KEY_RE.test(k) ? k : inspectValue(k, 0, seen)}: ${inspectValue(v, depth - 1, seen)}`);
    return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
  } finally {
    seen.delete(value);
  }
}

/** The `util.inspect`-style `{ key: value }` block a terminal reporter prints
 *  after the stack frames — the error's extra own enumerable props. The
 *  test-runner's ERR_TEST_FAILURE wrapper is skipped: its code/failureType
 *  bookkeeping isn't part of the user's error (viewers unwrap to the cause). */
function errorPropsSuffix(raw: object): string {
  if ((raw as { code?: unknown }).code === 'ERR_TEST_FAILURE') return '';
  const seen = new Set<object>([raw]);
  const entries = Object.entries(raw)
    .filter(([k]) => !ERROR_BASE_KEYS.has(k))
    .map(([k, v]) => `  ${BARE_KEY_RE.test(k) ? k : inspectValue(k, 0, seen)}: ${inspectValue(v, 1, seen)}`);
  return entries.length === 0 ? '' : ` {\n${entries.join(',\n')}\n}`;
}

function flattenError(raw: unknown): unknown {
  if (raw == null) return undefined;
  const err = raw as { message?: string; stack?: string; name?: string; cause?: unknown };
  const suffix = typeof raw === 'object' ? errorPropsSuffix(raw) : '';
  return {
    message: err.message ?? String(err),
    stack: err.stack == null ? err.stack : err.stack + suffix,
    name: err.name,
    cause: err.cause instanceof Error ? flattenError(err.cause) : err.cause,
  };
}

/**
 * Normalize a `node:test` event into a small, JSON-safe object containing only
 * the fields the store consumes. This is the canonical NDJSON wire shape shared
 * by the live reporter, the embedded HTML and the hosted viewer.
 */
export function toWireEvent(event: TestEvent): TestEvent {
  const d = event.data ?? {};
  const data: TestEventData = {};
  const t = event.t;
  if (d.name != null) data.name = d.name;
  if (d.nesting != null) data.nesting = d.nesting;
  if (d.file != null) data.file = d.file;
  if (d.testId != null) data.testId = d.testId;
  if (d.parentId != null) data.parentId = d.parentId;
  if (d.line != null) data.line = d.line;
  if (d.column != null) data.column = d.column;
  if (d.tags != null) data.tags = d.tags;
  if (d.todo != null) data.todo = d.todo;
  if (d.skip != null) data.skip = d.skip;
  if (d.message != null) data.message = d.message;
  if (d.level != null) data.level = d.level;
  if (d.count != null) data.count = d.count;
  if (d.type != null) data.type = d.type;
  if (d.counts != null) data.counts = d.counts;
  if (d.duration_ms != null) data.duration_ms = d.duration_ms;
  if (d.success != null) data.success = d.success;
  if (d.details != null) {
    data.details = {
      duration_ms: d.details.duration_ms,
      type: d.details.type,
      passed: d.details.passed,
      error: flattenError(d.details.error) as Error | undefined,
    };
    if (d.details.attempt != null) data.details.attempt = d.details.attempt;
    if (d.details.passed_on_attempt != null) data.details.passed_on_attempt = d.details.passed_on_attempt;
  }
  return t != null ? { type: event.type, t, data } : { type: event.type, data };
}

/** Serialize one event as an NDJSON line, stamping the writer wall-clock so
 *  viewers can compute real elapsed times however late they join the stream. */
export function serializeWireLine(event: TestEvent): string {
  const stamped = event.t != null ? event : { ...event, t: Date.now() };
  return `${JSON.stringify(toWireEvent(stamped))}\n`;
}

export function parseWireLines(text: string): TestEvent[] {
  const events: TestEvent[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as TestEvent);
    } catch {
      // Ignore partial/truncated trailing lines (e.g. a stream cut mid-write).
    }
  }
  return events;
}
