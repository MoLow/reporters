import React from 'react';
import { render } from 'ink';
import { createTreeStore, toWireEvent, type TestEvent } from '@reporters/tree-core';
import { App } from './App.tsx';
import { renderTreeText } from './text.ts';

/**
 * A live, React-powered tree reporter for `node:test`.
 *
 * In a TTY it renders an Ink tree that updates in place as tests run, then stays
 * open so you can browse results — arrow keys move, space toggles a test's
 * diagnostics, q or Ctrl+C closes. Outside a TTY (CI, pipes) it prints a
 * plain-text tree at the end. Set REPORTERS_LIVE_PLAIN=1 to force plain text.
 *
 * Note: under the default process isolation Node buffers each file's events
 * until that file's turn to report, so files fill in as they complete. For true
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

  // We own the terminal. Ctrl+C / q exit the process from within <App/>.
  render(<App store={store} />, { patchConsole: false, exitOnCtrlC: false });
  // Consume the whole stream (breaking early would destroy Node's reporter
  // pipeline and raise ABORT_ERR).
  for await (const event of source) store.apply(toWireEvent(event));
  // The run has finished. Keep the interactive view open for review — the user
  // browses results and quits with q / Ctrl+C (handled in <App/> via
  // process.exit). Block so the process doesn't exit and close the window.
  // (In CI / non-TTY we took the plain-text path above and never get here.)
  await new Promise<never>(() => {});
}
