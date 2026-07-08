import { test } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { AnsiSpan } from '../src/client/ansi.ts';

// React 19 diffs dangerouslySetInnerHTML by object identity and re-assigns
// innerHTML whenever the {__html} object is new — even for an identical
// string. During a live run the viewer re-renders 4×/s, so a component that
// builds {__html} inline rebuilds every log line's DOM on every tick: text
// selections collapse, linkified anchors are recreated, hover targets vanish.
// AnsiSpan keeps the {__html} object stable so re-renders never touch the DOM.

const dom = new JSDOM('<div id="root"></div>');
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
// createRoot warns outside real browsers without this flag.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function mount(): { root: Root; el: HTMLElement } {
  const el = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(el);
  return { root: createRoot(el), el };
}

test('re-rendering with the same text leaves the DOM untouched', () => {
  const { root, el } = mount();
  const text = '[31mtest failed[39m';
  flushSync(() => root.render(React.createElement(AnsiSpan, { text, generation: 1 } as any)));
  const span = el.querySelector('span')!;
  const child = span.firstChild!;
  assert.strictEqual(child.textContent, 'test failed');
  // Parent re-renders with a fresh props object but the same text.
  flushSync(() => root.render(React.createElement(AnsiSpan, { text, generation: 2 } as any)));
  assert.strictEqual(el.querySelector('span'), span, 'span element must be reused');
  assert.strictEqual(span.firstChild, child, 'inner DOM must not be rebuilt on re-render');
  root.unmount();
});

test('re-render preserves DOM mutations made by post-render passes (linkify)', () => {
  const { root, el } = mount();
  const text = 'see https://example.com/run';
  flushSync(() => root.render(React.createElement(AnsiSpan, { text })));
  const span = el.querySelector('span')!;
  // Simulate the linkify post-pass replacing the text with an anchor.
  const a = dom.window.document.createElement('a');
  a.href = 'https://example.com/run';
  a.textContent = 'https://example.com/run';
  span.replaceChildren('see ', a);
  flushSync(() => root.render(React.createElement(AnsiSpan, { text })));
  assert.strictEqual(el.querySelector('a'), a, 'linkified anchor must survive re-renders');
  root.unmount();
});

test('changed text replaces the rendered markup', () => {
  const { root, el } = mount();
  flushSync(() => root.render(React.createElement(AnsiSpan, { text: 'first' })));
  const span = el.querySelector('span')!;
  flushSync(() => root.render(React.createElement(AnsiSpan, { text: '[32msecond[39m' })));
  assert.strictEqual(el.querySelector('span'), span);
  assert.strictEqual(span.textContent, 'second');
  root.unmount();
});
