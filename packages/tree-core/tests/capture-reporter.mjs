// A minimal reporter that emits each node:test event as one NDJSON line.
// Used by the real-fixture corpus tests to capture genuine Node event streams.

function replacer(_key, value) {
  if (value instanceof Error) {
    return {
      message: value.message, stack: value.stack, name: value.name, cause: value.cause,
    };
  }
  return value;
}

export default async function* captureReporter(source) {
  for await (const event of source) {
    yield `${JSON.stringify({ type: event.type, data: event.data }, replacer)}\n`;
  }
}
