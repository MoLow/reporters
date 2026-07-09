import { test } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// The built bundle, not the source: node:test can't load .tsx, and the dist
// artifact (React external) is what embedders actually run. Imported after
// the DOM globals exist.
const { TestReportViewer } = await import('../dist/start.js' as string) as {
  TestReportViewer: React.FunctionComponent<Record<string, unknown>>;
};

const LOG = [
  '{"type":"test:dequeue","data":{"name":"adds","nesting":0,"file":"math.test.js"}}',
  '{"type":"test:pass","data":{"name":"adds","nesting":0,"file":"math.test.js","details":{"duration_ms":1},"testNumber":1}}',
].join('\n');
const SUMMARY = '{"type":"test:summary","data":{"counts":{"tests":1,"failed":0,"passed":1,"cancelled":0,"skipped":0,"todo":0,"topLevel":1,"suites":0},"duration_ms":2,"success":true}}';

/** In-memory Range-honoring fetch over a mutable NDJSON buffer. */
function fakeSource(initial: string) {
  const state = { body: initial, calls: 0 };
  const fetchImpl = async (_url: string, init?: { headers?: Record<string, string> }) => {
    state.calls += 1;
    const start = Number(/^bytes=(\d+)-/.exec(init?.headers?.Range ?? '')?.[1] ?? 0);
    if (start >= Buffer.byteLength(state.body)) return new Response(null, { status: 416 });
    return new Response(Buffer.from(state.body).subarray(start), { status: start > 0 ? 206 : 200 });
  };
  return { state, fetchImpl };
}

function mount(): { root: Root; el: HTMLElement } {
  const el = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(el);
  return { root: createRoot(el), el };
}

const tick = (ms: number) => act(async () => { await new Promise((r) => { setTimeout(r, ms); }); });

test('renders rows from the stream and stops polling at the summary', async () => {
  const { state, fetchImpl } = fakeSource(`${LOG}\n`);
  const { root, el } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10 }));
  });
  await tick(20);
  assert.ok(el.textContent!.includes('adds'), 'test row should render');
  assert.ok(el.textContent!.includes('Running'), 'run should still stream without a summary');

  state.body += `${SUMMARY}\n`;
  await tick(30);
  assert.ok(el.textContent!.includes('Passing'), 'summary should settle the run');
  const settled = state.calls;
  await tick(50);
  assert.strictEqual(state.calls, settled, 'polling must stop after the summary');
  await act(async () => root.unmount());
});

test('unmount stops polling a live stream', async () => {
  const { state, fetchImpl } = fakeSource(`${LOG}\n`);
  const { root } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10 }));
  });
  await tick(30);
  assert.ok(state.calls > 0);
  await act(async () => root.unmount());
  const atUnmount = state.calls;
  await new Promise((r) => { setTimeout(r, 60); });
  assert.strictEqual(state.calls, atUnmount, 'no fetches after unmount');
});

test('renderNodeActions and renderHeaderActions render in the embedded component', async () => {
  const { fetchImpl } = fakeSource(`${LOG}\n${SUMMARY}\n`);
  const { root, el } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, {
      src: '/run.ndjson',
      fetch: fetchImpl,
      pollMs: 10,
      renderNodeActions: (node) => React.createElement('button', { className: 'x-node' }, `go ${node.name}`),
      renderHeaderActions: () => React.createElement('button', { className: 'x-header' }, 'all'),
    }));
  });
  await tick(30);
  assert.ok(el.querySelector('.node-actions .x-node'), 'node action button should render');
  assert.ok(el.querySelector('.header-actions .x-header'), 'header action button should render');
  await act(async () => root.unmount());
});

test('does not touch the page URL by default', async () => {
  const { fetchImpl } = fakeSource(`${LOG}\n${SUMMARY}\n`);
  const { root, el } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10 }));
  });
  await tick(30);
  const input = el.querySelector('input')!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, 'adds');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await tick(450); // past the 400ms URL-sync debounce
  assert.strictEqual(dom.window.location.search, '', 'embedded viewer must not write query params');
  await act(async () => root.unmount());
});
