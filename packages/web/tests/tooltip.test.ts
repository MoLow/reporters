import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initTooltips, registerTooltipContent } from '../src/client/tooltip.ts';
import { tagTooltip } from '../src/client/tagTooltip.ts';
import { compileTagRules } from '../src/client/tagFilters.ts';

test('tooltip providers run only when opened, reuse evaluation results, and unregister cleanly', (t) => {
  const dom = new JSDOM('<button data-tip="Fallback">Tags</button>');
  (globalThis as any).document = dom.window.document;
  (globalThis as any).window = dom.window;
  t.after(() => dom.window.close());
  t.mock.timers.enable({ apis: ['setTimeout'] });
  initTooltips();
  const button = document.querySelector('button')!;
  const tip = document.getElementById('rt-tooltip')!;
  let calls = 0;
  const evaluate = compileTagRules(['smoke && !flaky']);
  const results: unknown[] = [];
  const unregister = registerTooltipContent(button, () => {
    calls += 1;
    return tagTooltip(['smoke'], (tags) => {
      const result = evaluate(tags);
      results.push(result);
      return result;
    });
  });
  const over = () => button.dispatchEvent(new dom.window.MouseEvent('pointerover', { bubbles: true }));
  const out = () => button.dispatchEvent(new dom.window.MouseEvent('pointerout', { bubbles: true }));
  assert.equal(calls, 0);
  over();
  t.mock.timers.tick(139);
  assert.equal(calls, 0);
  out();
  t.mock.timers.tick(200);
  assert.equal(calls, 0, 'brief hover does not evaluate');
  over();
  t.mock.timers.tick(140);
  assert.equal(calls, 1);
  assert.match(tip.textContent!, /1 tag supporting match: smoke/);
  out();
  button.focus();
  t.mock.timers.tick(140);
  assert.equal(calls, 2);
  assert.strictEqual(results[0], results[1], 'focus and hover share the cached explanation');
  button.blur();
  unregister();
  over();
  t.mock.timers.tick(140);
  assert.equal(calls, 2);
  assert.equal(tip.textContent, 'Fallback');
  out();
  registerTooltipContent(button, () => { throw new Error('Detached tooltip should not render'); });
  over();
  button.remove();
  t.mock.timers.tick(140);
});

test('malformed filters remain visibly unavailable in the tooltip', () => {
  const dom = new JSDOM();
  (globalThis as any).document = dom.window.document;
  try {
    const tip = tagTooltip(['smoke'], compileTagRules(['smoke &&']));
    assert.match(tip.textContent!, /Cannot evaluate recorded filters/);
    assert.doesNotMatch(tip.textContent!, /Does not match|supporting match/);
  } finally {
    dom.window.close();
  }
});
