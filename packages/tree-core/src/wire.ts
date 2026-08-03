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
  const err = raw as {
    message?: string; stack?: string; name?: string; cause?: unknown;
    code?: unknown; failureType?: unknown;
  };
  return {
    message: err.message ?? String(err),
    stack: inspectedStack(raw) ?? err.stack,
    name: err.name,
    code: typeof err.code === 'string' ? err.code : undefined,
    failureType: typeof err.failureType === 'string' ? err.failureType : undefined,
    cause: err.cause instanceof Error ? flattenError(err.cause) : err.cause,
  };
}

const MAX_DEPTH = 8;
const MAX_NODES = 1000;

/**
 * Make a `t.log()` payload safe to JSON-serialize. The payload is arbitrary
 * user data that reaches us untouched — under `--test-isolation=none` a
 * circular object arrives with its cycle intact, and an unguarded
 * `JSON.stringify` would throw and take down the whole run. Cycles are tracked
 * along the current path only, so a value referenced twice is kept twice rather
 * than being mistaken for a cycle.
 */
function sanitizeLogData(root: unknown): unknown {
  let budget = MAX_NODES;
  const path = new Set<object>();

  const walkList = (items: unknown[], depth: number): unknown[] => {
    const out: unknown[] = [];
    for (const item of items) {
      if (budget <= 0) {
        out.push('[Truncated]');
        break;
      }
      budget -= 1;
      // Positions carry meaning in a list, so an omitted value becomes null
      // rather than shifting everything after it.
      const value = walk(item, depth + 1);
      out.push(value === undefined ? null : value);
    }
    return out;
  };

  const walkObject = (obj: object, depth: number): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(obj)) {
      if (budget <= 0) {
        out['[Truncated]'] = true;
        break;
      }
      budget -= 1;
      const value = walk(raw, depth + 1);
      if (value !== undefined) out[key] = value;
    }
    return out;
  };

  function walk(value: unknown, depth: number): unknown {
    if (value === null) return null;
    const type = typeof value;
    if (type === 'string' || type === 'boolean') return value;
    // JSON turns NaN/Infinity into null, losing which one it was.
    if (type === 'number') return Number.isFinite(value) ? value : String(value);
    if (type === 'bigint') return `${value as bigint}n`;
    if (type === 'undefined' || type === 'function' || type === 'symbol') return undefined;
    if (depth >= MAX_DEPTH) return '[Truncated]';
    const obj = value as object;
    if (path.has(obj)) return '[Circular]';
    if (obj instanceof Date) return obj.toISOString();
    if (obj instanceof Error) return flattenError(obj);
    path.add(obj);
    try {
      if (obj instanceof Map || obj instanceof Set) return walkList([...obj], depth);
      if (Array.isArray(obj)) return walkList(obj, depth);
      return walkObject(obj, depth);
    } finally {
      path.delete(obj);
    }
  }

  return walk(root, 0);
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
  if (d.data !== undefined) data.data = sanitizeLogData(d.data);
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
