import type { TestEvent, TestEventData } from './types.ts';

// Loaded via getBuiltinModule so bundling this file for the browser stays
// possible; there flattenError never sees a live Error — only Node does.
const inspect = (globalThis as {
  process?: { getBuiltinModule?: (id: string) => { inspect: (value: unknown, opts?: object) => string } };
}).process?.getBuiltinModule?.('node:util')?.inspect;

/** The colored stack + `{ key: value }` props block `util.inspect` prints,
 *  exactly as terminal reporters show it. The test-runner's ERR_TEST_FAILURE
 *  wrapper keeps its plain stack: its code/failureType bookkeeping isn't part
 *  of the user's error (viewers unwrap to the cause). */
function inspectedStack(raw: unknown): string | undefined {
  if (inspect == null || !(raw instanceof Error) || (raw as { code?: unknown }).code === 'ERR_TEST_FAILURE') return undefined;
  if (typeof raw.stack !== 'string' || raw.stack === '') return undefined;
  return inspect(raw, { colors: true });
}

function flattenError(raw: unknown): unknown {
  if (raw == null) return undefined;
  const err = raw as { message?: string; stack?: string; name?: string; cause?: unknown };
  return {
    message: err.message ?? String(err),
    stack: inspectedStack(raw) ?? err.stack,
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
