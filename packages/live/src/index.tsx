import React from 'react';
import { render } from 'ink';
import { createTreeStore, toWireEvent, type TestEvent } from '@reporters/tree-core';
import { App } from './App.tsx';
import { renderTreeText } from './text.ts';

/**
 * A live, React-powered tree reporter for `node:test`.
 *
 * In a TTY it renders an Ink tree that updates in place as tests run. Outside a
 * TTY (CI, pipes) it falls back to a plain-text tree printed at the end, so logs
 * stay clean. Set REPORTERS_LIVE_PLAIN=1 to force the plain-text path.
 *
 * Note: under the default process isolation, Node buffers each file's events
 * until that file's turn to report, so files appear as they complete. For true
 * real-time per-test streaming, run with `--test-isolation=none`.
 */
export default async function* live(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  const store = createTreeStore();
  const interactive = Boolean(process.stdout.isTTY) && process.env.REPORTERS_LIVE_PLAIN !== '1';

  if (!interactive) {
    for await (const event of source) store.apply(toWireEvent(event));
    yield `${renderTreeText(store.getSnapshot())}\n`;
    return;
  }

  const app = render(<App store={store} />, {
    stdout: process.stdout,
    patchConsole: false,
    // Don't let Ink hold stdin open for Ctrl+C handling — it would keep the
    // process alive after the run finishes.
    exitOnCtrlC: false,
  });
  try {
    for await (const event of source) {
      store.apply(toWireEvent(event));
      // The cumulative summary (no file) marks the end of the run. Stop here so
      // we unmount even if the event source itself is never closed (e.g. when
      // run without --test), which would otherwise keep the process alive.
      if (event.type === 'test:summary' && event.data?.file == null) break;
    }
  } finally {
    app.rerender(<App store={store} />);
    app.unmount();
    await app.waitUntilExit();
    // Release stdin so the event loop can drain and the process can exit.
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(false); } catch { /* not a raw-capable tty */ }
    }
    process.stdin.pause();
    process.stdin.unref();
  }
}

