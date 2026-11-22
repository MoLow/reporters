import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileTagRules, tagRuleMatcher } from '../src/client/tagFilters.ts';

test('tag references honor token boundaries, casing, wildcards and literal punctuation, including negations', () => {
  const matches = tagRuleMatcher(['SMOKE and (aws-* || !flaky)', 'not (db.v2 or suite[1] or constructor or İ)']);
  for (const tag of ['smoke', 'AWS-RDS', 'aws-', 'flaky', 'db.v2', 'suite[1]', 'constructor', 'i\u0307']) {
    assert.equal(matches(tag), true, tag);
  }
  for (const tag of ['smoke-extra', 'rds', 'dbXv2', 'suite1', 'and', 'or', 'not', 'i']) {
    assert.equal(matches(tag), false, tag);
  }
  assert.equal(tagRuleMatcher()('smoke'), false);
  assert.equal(tagRuleMatcher(['*'])('any-tag'), true);
});

test('compiled precedence and explanations agree with the boolean expression for every tag combination', () => {
  const evaluate = compileTagRules(['(smoke && api && !flaky) || (aws-*)']);
  const names = ['smoke', 'api', 'flaky', 'aws-rds'];
  for (let mask = 0; mask < 16; mask += 1) {
    const tags = new Set(names.filter((_, index) => mask & (1 << index)));
    const firstBranch = tags.has('smoke') && tags.has('api') && !tags.has('flaky');
    const wildcardBranch = tags.has('aws-rds');
    const result = evaluate(tags);
    assert.equal(result.matches, firstBranch || wildcardBranch, JSON.stringify([...tags]));
    assert.deepEqual(new Set(result.contributingTags), new Set([
      ...(firstBranch ? ['smoke', 'api'] : []),
      ...(wildcardBranch ? ['aws-rds'] : []),
    ]));
  }
  const result = evaluate(new Set(['smoke', 'flaky', 'aws-rds']));
  assert.deepEqual(result.contributingTags, ['aws-rds']);
  assert.deepEqual(result.filters[0].reasons, ['aws-*: present (aws-rds)']);
});

test('operator aliases, precedence, parentheses and repeated flags have runner semantics', () => {
  const expressions = [
    ['smoke OR api aNd nOt flaky', 'smoke || api && !flaky'],
    ['(smoke or api) and not flaky', '(smoke || api) && !flaky'],
  ];
  for (let mask = 0; mask < 8; mask += 1) {
    const tags = new Set(['smoke', 'api', 'flaky'].filter((_, index) => mask & (1 << index)));
    for (const [words, symbols] of expressions) {
      assert.equal(compileTagRules([words])(tags).matches, compileTagRules([symbols])(tags).matches);
    }
    assert.equal(compileTagRules([expressions[0][0]])(tags).matches,
      tags.has('smoke') || (tags.has('api') && !tags.has('flaky')));
    const repeated = compileTagRules(['smoke or api', 'not flaky'])(tags);
    assert.equal(repeated.matches, (tags.has('smoke') || tags.has('api')) && !tags.has('flaky'));
    assert.deepEqual(repeated.filters.map((filter) => filter.matches),
      [tags.has('smoke') || tags.has('api'), !tags.has('flaky')]);
    if (!repeated.matches) assert.deepEqual(repeated.contributingTags, []);
  }
});

test('negated compound conditions explain the evidence for their result', () => {
  const absent = compileTagRules(['not (smoke or api)'])(new Set());
  assert.equal(absent.matches, true);
  assert.deepEqual(absent.contributingTags, []);
  assert.deepEqual(absent.filters[0].reasons, ['smoke: absent', 'api: absent']);

  const negated = compileTagRules(['not (smoke && !flaky)'])(new Set(['smoke', 'flaky']));
  assert.equal(negated.matches, true);
  assert.deepEqual(negated.contributingTags, ['flaky']);
  assert.deepEqual(negated.filters[0].reasons, ['flaky: present']);

  const double = compileTagRules(['!!smoke'])(new Set(['smoke']));
  assert.equal(double.matches, true);
  assert.deepEqual(double.contributingTags, ['smoke']);

  const failed = compileTagRules(['smoke && !flaky'])(new Set(['smoke', 'flaky']));
  assert.equal(failed.matches, false);
  assert.deepEqual(failed.contributingTags, []);
  assert.deepEqual(failed.filters[0].reasons, ['flaky: present']);
});

test('all successful alternatives contribute, but a failed flag prevents an overall match', () => {
  const tags = new Set(['smoke', 'api']);
  assert.deepEqual(compileTagRules(['smoke or api'])(tags).contributingTags, ['smoke', 'api']);
  assert.deepEqual(compileTagRules(['smoke or api', 'database'])(tags).contributingTags, []);
  assert.deepEqual(compileTagRules([])(tags), { matches: true, contributingTags: [], filters: [] });
});

test('compiled tags use exact set membership and escaped, case-normalized wildcard patterns', () => {
  const evaluate = compileTagRules(['SMOKE and (aws-* or db.*) and suite[1]']);
  const result = evaluate(new Set(['smoke', 'AWS-RDS', 'aws-s3', 'db.v2', 'suite[1]']));
  assert.equal(result.matches, true);
  assert.deepEqual(new Set(result.contributingTags), new Set(['smoke', 'aws-rds', 'aws-s3', 'db.v2', 'suite[1]']));
  assert.equal(evaluate(new Set(['smoke', 'dbXv2', 'suite[1]'])).matches, false);
  assert.equal(evaluate(new Set(['smoke-extra', 'aws-rds', 'suite[1]'])).matches, false);
  assert.equal(compileTagRules(['İ'])(new Set(['i\u0307'])).matches, true);
  assert.equal(compileTagRules(['İ'])(new Set(['i'])).matches, false);
  assert.equal(compileTagRules(['*'])(new Set()).matches, false);
  assert.equal(compileTagRules(['*'])(new Set(['anything'])).matches, true);
  assert.equal(compileTagRules(['constructor and globalThis.injected=true'])(
    new Set(['constructor', 'globalThis.injected=true']),
  ).matches, true, 'code-shaped tag names are literal data');
  assert.equal(Object.hasOwn(globalThis, 'injected'), false);
});

test('evaluations are lazy and cached by normalized complete tag set, scoped to the compiled rules', () => {
  const evaluate = compileTagRules(['smoke && api && !flaky']);
  const first = evaluate(new Set(['smoke', 'api']));
  assert.strictEqual(evaluate(new Set(['API', 'SMOKE', 'smoke'])), first);
  const withFlaky = evaluate(new Set(['smoke', 'api', 'flaky']));
  assert.notStrictEqual(withFlaky, first);
  assert.equal(first.matches, true);
  assert.equal(withFlaky.matches, false);
  assert.strictEqual(evaluate(new Set(['flaky', 'api', 'smoke'])), withFlaky);
  const changedRules = compileTagRules(['smoke && api && flaky']);
  assert.equal(changedRules(new Set(['smoke', 'api'])).matches, false);
  assert.notStrictEqual(changedRules(new Set(['smoke', 'api'])), first);
});

test('malformed or excessively nested report expressions produce an unavailable explanation, not a false verdict', () => {
  for (const expression of ['', 'smoke api', 'smoke &&', '|| smoke', '(', ')', 'smoke | api',
    'smoke & api', 'smoke)', '(smoke', '()', '!', 'and', 'smoke && || api', `${'('.repeat(130)}smoke${')'.repeat(130)}`]) {
    const result = compileTagRules([expression])(new Set(['smoke']));
    assert.equal(result.matches, null, expression);
    assert.ok(result.error, expression);
    assert.deepEqual(result.contributingTags, []);
  }
  assert.equal(compileTagRules([`${'('.repeat(100)}smoke${')'.repeat(100)}`])(new Set(['smoke'])).matches, true);
});
