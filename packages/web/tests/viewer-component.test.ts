import { afterEach, test } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import type ReactTypes from 'react';
import type { Root } from 'react-dom/client';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
// linkifyDom walks rendered message/log text with a TreeWalker.
(globalThis as any).NodeFilter = dom.window.NodeFilter;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Everything below is imported dynamically, after the DOM globals exist:
// react-dom snapshots the environment at module evaluation, and with no
// document its event system goes inert — dispatched events silently reach no
// handler. The dist bundle (React external) is what embedders actually run;
// node:test couldn't load the .tsx source anyway.
const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { TestReportViewer, memoryFilterState } = await import('../dist/start.js' as string) as {
  TestReportViewer: ReactTypes.FunctionComponent<Record<string, unknown>>;
  memoryFilterState: (initial?: object) => object;
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

// Every mounted root is torn down after its test, pass or fail. Without this a
// throwing assertion leaks the viewer's poll timer, and node:test waits out the
// whole file timeout instead of reporting the failure — one bad assert used to
// cost 200s.
const mounted: Root[] = [];
afterEach(async () => {
  const roots = mounted.splice(0);
  await act(async () => { for (const r of roots) r.unmount(); });
});

function mount(): { root: Root; el: HTMLElement } {
  const el = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(el);
  const root = createRoot(el);
  mounted.push(root);
  return { root, el };
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

test('tags collapse to one chip whose tooltip and row label carry the names', async () => {
  const tags = ['aws-rds-workflow-test', 'rds-tests-workflow-test'];
  const tagged = [
    `{"type":"test:pass","data":{"name":"tagged","nesting":0,"file":"t.test.js","tags":${JSON.stringify(tags)},"details":{"duration_ms":1},"testNumber":1}}`,
    '{"type":"test:pass","data":{"name":"single","nesting":0,"file":"t.test.js","tags":["smoke"],"details":{"duration_ms":1},"testNumber":2}}',
    '{"type":"test:pass","data":{"name":"plain","nesting":0,"file":"t.test.js","details":{"duration_ms":1},"testNumber":3}}',
    SUMMARY,
  ].join('\n');
  const { fetchImpl } = fakeSource(`${tagged}\n`);
  const { root, el } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10 }));
  });
  await tick(30);
  const rowOf = (name: string) => [...el.querySelectorAll('.row')]
    .find((r) => r.querySelector('.name')?.textContent === name)!;
  const many = rowOf('tagged');
  assert.strictEqual(many.querySelectorAll('.tagchip').length, 1, 'one chip stands for every tag');
  assert.ok(!many.textContent!.includes(tags[0]), 'tag names stay out of the row title');
  assert.strictEqual(many.querySelector('.tagchip')!.getAttribute('data-tip'), `2 tags: ${tags.join(' · ')}`);
  assert.strictEqual(many.querySelector('.tagchip-n')!.textContent, '2');
  assert.ok(many.getAttribute('aria-label')!.includes(`2 tags: ${tags.join(' · ')}`));
  const one = rowOf('single');
  assert.strictEqual(one.querySelector('.tagchip')!.getAttribute('data-tip'), 'Tag: smoke');
  assert.strictEqual(one.querySelector('.tagchip-n'), null, 'a lone tag needs no count');
  assert.strictEqual(rowOf('plain').querySelector('.tagchip'), null);
  await act(async () => root.unmount());
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

async function typeQuery(el: HTMLElement, text: string): Promise<void> {
  const input = el.querySelector('input')!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, text);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await tick(450); // past the URL store's 400ms typing debounce
}

test('the default filter store syncs the page URL', async () => {
  const { fetchImpl } = fakeSource(`${LOG}\n${SUMMARY}\n`);
  const { root, el } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10 }));
  });
  await tick(30);
  await typeQuery(el, 'adds');
  assert.strictEqual(dom.window.location.search, '?q=adds');
  await act(async () => root.unmount());
  dom.window.history.replaceState(null, '', '/');
});

test('without src renders the load-error screen; retry button only with onRetry', async () => {
  const { root, el } = mount();
  await act(async () => { root.render(React.createElement(TestReportViewer, {})); });
  assert.ok(el.textContent!.includes('Couldn’t load the live log'), 'load-error screen renders');
  assert.strictEqual(el.querySelector('.state button'), null, 'no retry without a handler');

  let retried = 0;
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { onRetry: () => { retried += 1; } }));
  });
  const button = el.querySelector('.state button') as HTMLButtonElement;
  assert.ok(button, 'retry button renders with a handler');
  await act(async () => { button.click(); });
  assert.strictEqual(retried, 1);
  await act(async () => root.unmount());
});

test('memoryFilterState keeps the page URL untouched', async () => {
  const { fetchImpl } = fakeSource(`${LOG}\n${SUMMARY}\n`);
  const { root, el } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, {
      src: '/run.ndjson', fetch: fetchImpl, pollMs: 10, filters: memoryFilterState(),
    }));
  });
  await tick(30);
  await typeQuery(el, 'adds');
  assert.strictEqual(dom.window.location.search, '', 'memory store must not write query params');
  await act(async () => root.unmount());
});

// The real v26.6.0 shape: logs stream out eagerly, then the buffered
// declaration block (start/pass) and finally the diagnostics.
const MESSAGE_LOG = [
  '{"type":"test:enqueue","data":{"name":"uploads","nesting":0,"file":"s3.test.js","testId":1,"parentId":0,"type":"test"}}',
  '{"type":"test:dequeue","data":{"name":"uploads","nesting":0,"file":"s3.test.js","testId":1,"parentId":0,"type":"test"}}',
  '{"type":"test:log","data":{"name":"uploads","nesting":0,"file":"s3.test.js","testId":1,"parentId":0,"message":"fetched user","data":{"userId":42}}}',
  '{"type":"test:log","data":{"name":"uploads","nesting":0,"file":"s3.test.js","testId":1,"parentId":0,"message":"retrying endpoint","data":{"level":"warn","attempt":3}}}',
  '{"type":"test:complete","data":{"name":"uploads","nesting":0,"file":"s3.test.js","testId":1,"parentId":0,"details":{"passed":true,"duration_ms":1}}}',
  '{"type":"test:start","data":{"name":"uploads","nesting":0,"file":"s3.test.js","testId":1,"parentId":0}}',
  '{"type":"test:pass","data":{"name":"uploads","nesting":0,"file":"s3.test.js","testId":1,"parentId":0,"details":{"duration_ms":1}}}',
  '{"type":"test:diagnostic","data":{"nesting":0,"file":"s3.test.js","message":"buffered note","level":"info"}}',
].join('\n');

/** Mount the log, then open the "uploads" row and its Messages section — a
 *  passing test collapses both by default. */
async function openMessages(): Promise<{ root: Root; el: HTMLElement; list: Element }> {
  const { fetchImpl } = fakeSource(`${MESSAGE_LOG}\n${SUMMARY}\n`);
  const { root, el } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10 }));
  });
  await tick(30);

  const row = [...el.querySelectorAll('[role="treeitem"]')]
    .find((n) => n.getAttribute('aria-label')!.startsWith('uploads,')) as HTMLElement;
  assert.ok(row, 'the uploads row should render');
  await act(async () => { (row.querySelector('.logbtn') as HTMLElement).click(); });

  const tab = [...el.querySelectorAll('.pop-tab')]
    .find((n) => n.textContent!.startsWith('Messages')) as HTMLElement;
  assert.ok(tab, 'a Messages tab should render');
  await act(async () => { tab.click(); });

  const list = el.querySelector('.diag-list');
  assert.ok(list, 'the Messages list should render in the popup body');
  return { root, el, list: list! };
}

test('logs and diagnostics render in one Messages block, in arrival order', async () => {
  const { root, list } = await openMessages();
  assert.deepStrictEqual(
    [...list.querySelectorAll('.diag-item .txt')].map((n) => n.textContent),
    ['fetched user{"userId":42}', 'retrying endpoint{"level":"warn","attempt":3}', 'buffered note'],
  );
  await act(async () => root.unmount());
});

test('a log payload renders in its own dimmed span', async () => {
  const { root, list } = await openMessages();
  assert.deepStrictEqual(
    [...list.querySelectorAll('.diag-payload')].map((n) => n.textContent),
    ['{"userId":42}', '{"level":"warn","attempt":3}'],
  );
  await act(async () => root.unmount());
});

test('a warn payload level drives the item severity', async () => {
  const { root, list } = await openMessages();
  assert.deepStrictEqual(
    [...list.querySelectorAll('.diag-item .diag-level')].map((n) => [n.textContent, n.getAttribute('data-soft')]),
    [['info', 'skipped'], ['warn', 'running'], ['info', 'skipped']],
  );
  await act(async () => root.unmount());
});

/** The shape of your everyday cascade: a suite whose before hook blew up, a
 *  failing test with a real stack, and children the runner cancelled. */
const CASCADE = [
  '{"type":"test:start","data":{"name":"EKS Namespace","nesting":0,"file":"eks.test.js","testId":1}}',
  '{"type":"test:stdout","data":{"file":"eks.test.js","message":"creating namespace\\nwaiting for pods\\n"}}',
  '{"type":"test:start","data":{"name":"with S3 vault","nesting":1,"file":"eks.test.js","testId":2,"parentId":1}}',
  '{"type":"test:fail","data":{"name":"with S3 vault","nesting":1,"file":"eks.test.js","testId":2,"parentId":1,"details":{"duration_ms":0,"error":{"message":"test did not finish before its parent and was cancelled","failureType":"cancelledByParent","code":"ERR_TEST_FAILURE"}}}}',
  '{"type":"test:start","data":{"name":"discovers pg","nesting":1,"file":"eks.test.js","testId":3,"parentId":1}}',
  '{"type":"test:fail","data":{"name":"discovers pg","nesting":1,"file":"eks.test.js","testId":3,"parentId":1,"details":{"duration_ms":4,"error":{"message":"expected 3 to equal 4","stack":"AssertionError: expected 3 to equal 4\\n    at eks.test.js:12:3","failureType":"testCodeFailure","code":"ERR_TEST_FAILURE"}}}}',
  '{"type":"test:fail","data":{"name":"EKS Namespace","nesting":0,"file":"eks.test.js","testId":1,"details":{"duration_ms":9,"error":{"message":"2 subtests failed","failureType":"subtestsFailed","code":"ERR_TEST_FAILURE"}}}}',
].join('\n');

async function renderCascade() {
  const { fetchImpl } = fakeSource(`${CASCADE}\n`);
  const { root, el } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10, filters: memoryFilterState() }));
  });
  await tick(20);
  return { root, el };
}

const rowOf = (el: HTMLElement, name: string) => [...el.querySelectorAll('.row')]
  .find((n) => n.getAttribute('aria-label')!.startsWith(`${name},`)) as HTMLElement;

test('a cancelled test renders muted, with no error panel to expand', async () => {
  const { root, el } = await renderCascade();
  const row = rowOf(el, 'with S3 vault');
  const glyph = row.querySelector('.cglyph')!;
  assert.strictEqual(glyph.textContent, '⊗', 'cancelled wears its own glyph, not ✕');
  assert.strictEqual(glyph.getAttribute('data-stc'), 'cancelled', 'and its own muted tone');
  assert.strictEqual(row.getAttribute('data-fail'), 'false', 'no red row tint');
  assert.strictEqual(row.getAttribute('data-clickable'), 'false', 'nothing left to disclose');
  assert.ok(!el.textContent!.includes('did not finish before its parent'), 'the runner’s cancellation text is gone');
  await act(async () => root.unmount());
});

test('a real failure keeps its mark and its tint, and opens on its stack', async () => {
  const { root, el } = await renderCascade();
  const row = rowOf(el, 'discovers pg');
  assert.strictEqual(row.querySelector('.tdot')!.getAttribute('data-stf'), 'failed', 'a test is a dot, not a glyph');
  assert.strictEqual(row.getAttribute('data-fail'), 'true');
  assert.strictEqual(el.querySelector('.stack'), null, 'nothing is printed inline any more');
  // The row itself is the affordance for a leaf — no caret to hunt for.
  await act(async () => { row.click(); });
  assert.strictEqual(el.querySelector('.pop-tab[data-on]')!.textContent, 'Error1', 'opens on the first tab it has');
  assert.ok(el.querySelector('.stack')!.textContent!.includes('at eks.test.js:12:3'));
  assert.strictEqual(el.querySelector('.pop-path')!.textContent, 'eks.test.js › EKS Namespace › discovers pg');
  await act(async () => root.unmount());
});

test('Escape and the scrim both close the popup, and focus goes back to the button', async () => {
  const { root, el } = await renderCascade();
  const btn = rowOf(el, 'discovers pg').querySelector('.logbtn') as HTMLElement;
  await act(async () => { btn.focus(); btn.click(); });
  assert.ok(el.querySelector('.pop'), 'the popup is open');
  assert.strictEqual(btn.getAttribute('data-on'), 'true', 'and its button reads as active');
  await act(async () => { dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' })); });
  assert.strictEqual(el.querySelector('.pop'), null, 'Escape closes it');
  assert.strictEqual(dom.window.document.activeElement, btn, 'focus returns to where it came from');

  await act(async () => { btn.click(); });
  await act(async () => { (el.querySelector('.scrim') as HTMLElement).click(); });
  assert.strictEqual(el.querySelector('.pop'), null, 'a scrim click closes it too');
  await act(async () => root.unmount());
});

test('a node with no error opens on Output, since there is no Error tab', async () => {
  const { root, el } = await renderCascade();
  // The file wrapper: it owns the run's stdout but reported no error of its own.
  const row = rowOf(el, 'eks.test.js');
  await act(async () => { (row.querySelector('.logbtn') as HTMLElement).click(); });
  assert.deepStrictEqual(
    [...el.querySelectorAll('.pop-tab')].map((n) => n.textContent),
    ['Output2'],
    'only tabs with content are rendered',
  );
  assert.strictEqual(el.querySelector('.pop-tab[data-on]')!.textContent, 'Output2');
  await act(async () => root.unmount());
});

test('the error message is printed once, not repeated by its own stack', async () => {
  const { root, el } = await renderCascade();
  await act(async () => { rowOf(el, 'discovers pg').click(); });
  const body = el.querySelector('.pop-body')!.textContent!;
  assert.strictEqual(body.match(/expected 3 to equal 4/g)!.length, 1, 'headline only — the stack drops its preamble');
  assert.ok(el.querySelector('.stack')!.textContent!.startsWith('    at '), 'the stack starts at the first frame');
  await act(async () => root.unmount());
});

test('a synthetic error whose stack is just its message renders no stack at all', async () => {
  const orphan = '{"type":"test:fail","data":{"name":"lonely","nesting":0,"file":"x.test.js","testId":9,"details":{"duration_ms":1,"error":{"message":"1 subtest failed","failureType":"subtestsFailed"}}}}';
  const { fetchImpl } = fakeSource(`${orphan}\n`);
  const { root, el } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10, filters: memoryFilterState() }));
  });
  await tick(20);
  await act(async () => { (rowOf(el, 'lonely').querySelector('.logbtn') as HTMLElement).click(); });
  assert.strictEqual(el.querySelector('.pop-msg')!.textContent, '1 subtest failed');
  assert.strictEqual(el.querySelector('.stack'), null, 'nothing left to print below it');
  await act(async () => root.unmount());
});

test('a failed leaf previews what broke, on one line, under its row', async () => {
  const { root, el } = await renderCascade();
  const lines = [...el.querySelectorAll('.errline')];
  assert.deepStrictEqual(
    lines.map((n) => n.querySelector('.errline-msg')!.textContent),
    ['expected 3 to equal 4'],
    'the rollup on EKS Namespace previews nothing — its fail chip already says it',
  );
  assert.strictEqual(lines[0].getAttribute('aria-hidden'), 'true', 'the row already carries this for AT');
  assert.ok(
    rowOf(el, 'discovers pg').getAttribute('aria-label')!.endsWith(': expected 3 to equal 4'),
    'so the message rides on the row label instead',
  );
  await act(async () => root.unmount());
});

test('a container previews its own failure — the cascade\u2019s only real cause', async () => {
  // A suite whose hook died: its children are cancelled with a generic sentence,
  // so this row holds the only explanation in the subtree.
  const hook = [
    '{"type":"test:start","data":{"name":"EKS Namespace","nesting":0,"file":"eks.test.js","testId":1}}',
    '{"type":"test:start","data":{"name":"with S3 vault","nesting":1,"file":"eks.test.js","testId":2,"parentId":1}}',
    '{"type":"test:fail","data":{"name":"with S3 vault","nesting":1,"file":"eks.test.js","testId":2,"parentId":1,"details":{"duration_ms":0,"error":{"message":"test did not finish before its parent and was cancelled","failureType":"cancelledByParent"}}}}',
    '{"type":"test:fail","data":{"name":"EKS Namespace","nesting":0,"file":"eks.test.js","testId":1,"details":{"duration_ms":9,"error":{"message":"HTTP-Code: 401 Message: Unauthorized","stack":"Error: HTTP-Code: 401 Message: Unauthorized\\n    at readStorageClass (k8s.js:4009:19)","failureType":"hookFailed"}}}}',
  ].join('\n');
  const { fetchImpl } = fakeSource(`${hook}\n`);
  const { root, el } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10, filters: memoryFilterState() }));
  });
  await tick(20);
  assert.deepStrictEqual(
    [...el.querySelectorAll('.errline-msg')].map((n) => n.textContent),
    ['HTTP-Code: 401 Message: Unauthorized'],
    'the suite previews its 401; its cancelled child previews nothing',
  );
  await act(async () => root.unmount());
});

test('the preview opens the popup on Error even when another tab was last used', async () => {
  const { root, el } = await renderCascade();
  // Leave the popup on Output, then close it, so the sticky tab is not Error.
  await act(async () => { (rowOf(el, 'eks.test.js').querySelector('.logbtn') as HTMLElement).click(); });
  assert.strictEqual(el.querySelector('.pop-tab[data-on]')!.textContent, 'Output2');
  await act(async () => { (el.querySelector('.scrim') as HTMLElement).click(); });

  await act(async () => { (el.querySelector('.errline') as HTMLElement).click(); });
  assert.strictEqual(el.querySelector('.pop-tab[data-on]')!.textContent, 'Error1');
  await act(async () => root.unmount());
});

test('a cancelled test gets no preview — it never ran, so nothing broke', async () => {
  const { root, el } = await renderCascade();
  const row = rowOf(el, 'with S3 vault');
  assert.ok(!row.nextElementSibling?.classList.contains('errline'), 'no line follows it');
  assert.ok(!row.getAttribute('aria-label')!.includes('did not finish'), 'and nothing on its label');
  await act(async () => root.unmount());
});

test('rows still collapse and expand while a filter is active', async () => {
  const { fetchImpl } = fakeSource(`${CASCADE}\n`);
  const { root, el } = mount();
  const filters = memoryFilterState({ query: 'vault' });
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10, filters }));
  });
  await tick(20);

  const suite = rowOf(el, 'EKS Namespace');
  assert.strictEqual(suite.getAttribute('aria-expanded'), 'true', 'the query forced it open to reveal the matches');
  assert.ok(rowOf(el, 'with S3 vault'), 'and the matching child is on screen');

  await act(async () => { suite.click(); });
  assert.strictEqual(rowOf(el, 'EKS Namespace').getAttribute('aria-expanded'), 'false', 'the caret still works under a filter');
  assert.strictEqual(rowOf(el, 'with S3 vault'), undefined, 'so its children are gone');

  await act(async () => { rowOf(el, 'EKS Namespace').click(); });
  assert.strictEqual(rowOf(el, 'EKS Namespace').getAttribute('aria-expanded'), 'true', 'and opens again');
  await act(async () => root.unmount());
});

test('the log button counts exactly what the tabs add up to', async () => {
  const { root, el } = await renderCascade();
  const row = rowOf(el, 'discovers pg');
  const shown = Number(row.querySelector('.logbtn-n')!.textContent);
  await act(async () => { (row.querySelector('.logbtn') as HTMLElement).click(); });
  const tabTotal = [...el.querySelectorAll('.pop-tab-n')].reduce((sum, n) => sum + Number(n.textContent), 0);
  assert.strictEqual(shown, tabTotal, 'one source, no separate math');
  await act(async () => root.unmount());
});

test('a suite keeps the verdict glyph its tests trade for a dot', async () => {
  const { root, el } = await renderCascade();
  assert.strictEqual(rowOf(el, 'EKS Namespace').querySelector('.cglyph')!.textContent, '✕');
  assert.strictEqual(rowOf(el, 'EKS Namespace').querySelector('.tdot'), null);
  await act(async () => root.unmount());
});

test('the subtests rollup becomes a fail chip on the row, with no panel left', async () => {
  const { root, el } = await renderCascade();
  const row = rowOf(el, 'EKS Namespace');
  assert.strictEqual(row.querySelector('.failchip')!.textContent, '2 failed');
  assert.ok(!el.textContent!.includes('2 subtests failed'), 'the runner’s wording is gone entirely');
  assert.strictEqual(row.querySelector('.failchip')!.textContent, '2 failed');
  await act(async () => root.unmount());
});

test('a rollup with no failing descendant to point at keeps its error', async () => {
  // The chip is the replacement; with no count there is no chip, so suppressing
  // would lose the only thing the node said.
  const orphan = '{"type":"test:fail","data":{"name":"lonely","nesting":0,"file":"x.test.js","testId":9,"details":{"duration_ms":1,"error":{"message":"1 subtest failed","failureType":"subtestsFailed"}}}}';
  const { fetchImpl } = fakeSource(`${orphan}\n`);
  const { root, el } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10, filters: memoryFilterState() }));
  });
  await tick(20);
  const row = rowOf(el, 'lonely');
  assert.strictEqual(row.querySelector('.failchip'), null, 'no chip to stand in for it');
  await act(async () => { (row.querySelector('.logbtn') as HTMLElement).click(); });
  assert.ok(el.querySelector('.pop-msg')!.textContent!.includes('1 subtest failed'), 'so the error still shows');
  await act(async () => root.unmount());
});

test('the tab is left alone unless the host asks for it', async () => {
  dom.window.document.title = 'host app';
  const { fetchImpl } = fakeSource(`${LOG}\n${SUMMARY}\n`);
  const { root } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, { src: '/run.ndjson', fetch: fetchImpl, pollMs: 10, filters: memoryFilterState() }));
  });
  await tick(30);
  assert.strictEqual(dom.window.document.title, 'host app');
  assert.strictEqual(dom.window.document.head.querySelector('link[rel="icon"]'), null);
  await act(async () => root.unmount());
});

test('documentTitle and favicon follow the run, and hand the page back on unmount', async () => {
  dom.window.document.title = 'host app';
  const { state, fetchImpl } = fakeSource(`${LOG}\n`);
  const { root } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, {
      src: '/run.ndjson', fetch: fetchImpl, pollMs: 10, filters: memoryFilterState(), documentTitle: true, favicon: true,
    }));
  });
  await tick(30);
  assert.strictEqual(dom.window.document.title, '100% · host app');
  const icon = dom.window.document.head.querySelector('link[rel="icon"]') as HTMLLinkElement;
  assert.match(icon.getAttribute('href')!, /^data:image\/svg\+xml,/);

  state.body += `${SUMMARY}\n`;
  await tick(30);
  assert.strictEqual(dom.window.document.title, '✓ · host app');

  await act(async () => root.unmount());
  assert.strictEqual(dom.window.document.title, 'host app');
  assert.strictEqual(dom.window.document.head.querySelector('link[rel="icon"]'), null);
});

test('a documentTitle function owns the whole title', async () => {
  dom.window.document.title = 'host app';
  const { fetchImpl } = fakeSource(`${LOG}\n${SUMMARY}\n`);
  const { root } = mount();
  await act(async () => {
    root.render(React.createElement(TestReportViewer, {
      src: '/run.ndjson',
      fetch: fetchImpl,
      pollMs: 10,
      filters: memoryFilterState(),
      documentTitle: (progress: { counts: { passed: number } }, base: string) => `${progress.counts.passed} passed — ${base}`,
    }));
  });
  await tick(30);
  assert.strictEqual(dom.window.document.title, '1 passed — host app');
  await act(async () => root.unmount());
  assert.strictEqual(dom.window.document.title, 'host app');
});
