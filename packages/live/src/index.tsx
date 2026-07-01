import React from 'react';
import { render } from 'ink';
import { createTreeStore, toWireEvent, type TestEvent } from '@reporters/tree-core';
import { App } from './App.tsx';
import { renderTreeText } from './text.ts';

/**
 * A live, React-powered tree reporter for `node:test`.
 *
 * Two independent levers decide how it behaves:
 *   - Output (stdout is a TTY): render the live Ink tree, else print a fully
 *     expanded plain-text tree once at the end.
 *   - Input (stdin is a TTY): after the run, keep the view open so you can
 *     browse — arrow keys move, space toggles a test's diagnostics, q / Ctrl+C
 *     closes — else exit as soon as the run ends.
 * So `npm run test` (stdout is a TTY, stdin isn't) shows the live tree and then
 * exits, while a plain pipe / CI prints text and exits. REPORTERS_LIVE_PLAIN=1
 * forces both levers off (plain text, exit when done).
 *
 * Note: under the default process isolation Node buffers each file's events
 * until that file's turn to report, so files fill in as they complete. For true
 * real-time per-test streaming, run with `--test-isolation=none`.
 */
export default async function* live(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  const store = createTreeStore();
  const plain = process.env.REPORTERS_LIVE_PLAIN === '1';
  const renderApp = Boolean(process.stdout.isTTY) && !plain;
  const waitForInput = Boolean(process.stdin.isTTY) && !plain;

  if (!renderApp) {
    for await (const event of source) store.apply(toWireEvent(event));
    yield `${renderTreeText(store.getSnapshot())}\n`;
    return;
  }

  // We own the terminal. Ctrl+C / q exit the process from within <App/>.
  const app = render(<App store={store} interactive={waitForInput} />, { patchConsole: false, exitOnCtrlC: false });
  // Consume the whole stream (breaking early would destroy Node's reporter
  // pipeline and raise ABORT_ERR).
  for await (const event of source) store.apply(toWireEvent(event));

  if (waitForInput) {
    // Keep the view open for review; the user quits with q / Ctrl+C (handled in
    // <App/> via process.exit). Block so the process doesn't close the window.
    await new Promise<never>(() => {});
  }
  // No stdin to drive navigation: leave the final frame on screen and let the
  // generator return so Node finishes the run and sets the exit code.
  app.unmount();
}
