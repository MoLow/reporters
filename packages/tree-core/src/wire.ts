import type { TestEvent, TestEventData } from './types.ts';

// Loaded via getBuiltinModule so bundling this file for the browser stays
// possible; there flattenError never sees a live Error — only Node does.
const inspect = (globalThis as {
  process?: { getBuiltinModule?: (id: string) => { inspect: (value: unknown, opts?: object) => string } };
}).process?.getBuiltinModule?.('node:util')?.inspect;

const ANSI = '[';

function skipAnsi(text: string, from: number): number {
  let i = from;
  while (text.startsWith(ANSI, i)) {
    const end = text.indexOf('m', i + ANSI.length);
    if (end === -1) break;
    i = end + 1;
  }
  return i;
}

/** Slice `text` past `plain`, matching around interleaved ANSI color codes
 *  (inspect dims internal stack frames, so the raw stack isn't a substring). */
function sliceAfterPlain(text: string, plain: string, from: number): string {
  let ti = from;
  for (let pi = 0; pi < plain.length; pi++, ti++) {
    ti = skipAnsi(text, ti);
    if (text[ti] !== plain[pi]) return '';
  }
  return text.slice(skipAnsi(text, ti));
}

/** The colored `{ key: value }` props block `util.inspect` prints after the
 *  stack frames, exactly as terminal reporters show it — obtained by
 *  inspecting the error and slicing off the stack. The test-runner's
 *  ERR_TEST_FAILURE wrapper is skipped: its code/failureType bookkeeping isn't
 *  part of the user's error (viewers unwrap to the cause). */
function errorPropsSuffix(err: Error & { code?: unknown }): string {
  if (inspect == null || typeof err.stack !== 'string' || err.stack === '' || err.code === 'ERR_TEST_FAILURE') return '';
  const text = inspect(err, { colors: true });
  // A self-referencing error is prefixed with its (colored) circular-ref marker.
  let from = skipAnsi(text, 0);
  if (text.startsWith('<ref *', from)) {
    from = skipAnsi(text, text.indexOf('>', from) + 1);
    if (text[from] === ' ') from++;
  }
  return sliceAfterPlain(text, err.stack, from);
}

function flattenError(raw: unknown): unknown {
  if (raw == null) return undefined;
  const err = raw as { message?: string; stack?: string; name?: string; cause?: unknown };
  const suffix = raw instanceof Error ? errorPropsSuffix(raw) : '';
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
