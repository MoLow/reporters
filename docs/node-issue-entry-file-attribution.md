# `node:test`: reporter events carry no process/entry-file identity, so custom reporters cannot reliably reconstruct the test tree under `--test` isolation

## Summary

Under the default `--test` process isolation, the runner forwards each child
process's reporter events into a single merged `TestsStream`, but the events
carry **no indication of which child process (entry file) they came from**.
Combined with two documented properties —

- `testId` is *"unique within the test file's process"* (i.e. every process
  counts 1, 2, 3, …), and
- `data.file` reports the file **where the test is defined**, which for a
  subtest created inside a shared, imported helper module is the *helper*, not
  the entry file —

this makes several event streams **ambiguous by construction**: two concurrent
processes can emit byte-identical events for different tests, and a reporter
consuming the stream has no field it can use to tell them apart.

The declaration-ordered events (`test:start`/`test:pass`/`test:fail`) are
serialized per file, so a reporter that buffers until each file completes (like
the built-in `spec` reporter) renders correctly. But any reporter that wants to
show **live progress** must use the execution-ordered events
(`test:enqueue`/`test:dequeue`/`test:complete`), and those interleave freely
across processes with colliding `testId`/`parentId` and helper-attributed
`file` — there is nothing to correlate on.

## Reproduction

Node v26.4.0 (also reproduces on v24). Three files:

```js
// helper.mjs
export async function backupAndRestore(t, target) {
  await t.test(`restore ${target}`, async () => {});
}
```

```js
// a.test.mjs
import { test } from 'node:test';
import { backupAndRestore } from './helper.mjs';
test('backup A', async (t) => { await backupAndRestore(t, 'vm'); });
```

```js
// b.test.mjs  — identical, 'backup B'
import { test } from 'node:test';
import { backupAndRestore } from './helper.mjs';
test('backup B', async (t) => { await backupAndRestore(t, 'vm'); });
```

```js
// dump-reporter.mjs
export default async function* dump(source) {
  for await (const { type, data } of source) {
    if (!type.startsWith('test:') || type === 'test:coverage') continue;
    const { name, file, testId, parentId, nesting } = data ?? {};
    yield `${JSON.stringify({ type, name, file: file?.split('/').pop(), testId, parentId, nesting })}\n`;
  }
}
```

```console
$ node --test --test-reporter ./dump-reporter.mjs --test-reporter-destination stdout a.test.mjs b.test.mjs
```

## Observed output (abridged)

```json
{"type":"test:enqueue","name":"restore vm","file":"helper.mjs","testId":2,"parentId":1,"nesting":1}
{"type":"test:complete","name":"restore vm","file":"helper.mjs","testId":2,"parentId":1,"nesting":1}
...
{"type":"test:enqueue","name":"restore vm","file":"helper.mjs","testId":2,"parentId":1,"nesting":1}
{"type":"test:complete","name":"restore vm","file":"helper.mjs","testId":2,"parentId":1,"nesting":1}
```

The two `restore vm` subtests — one belonging to `backup A`, one to
`backup B` — produce **byte-identical event payloads**. `parentId: 1` refers
to `testId: 1` *in the emitting process*, but the stream contains a `testId: 1`
per process (plus the file-wrapper tests in the root process, which use the
same counter space: `a.test.mjs` itself is `testId: 1`, and `b.test.mjs` is
`testId: 2`, colliding with the in-process ids too).

In this toy run the files execute one after another, so ordering can still
disambiguate. In a real suite (we hit this with a 40-file concurrent run where
every file exercises shared helper modules) the execution-ordered events fully
interleave, and:

- a helper subtest's `parentId` matches an **open test in several processes at
  once** — a reporter picking any of them cross-attributes the subtest to the
  wrong file's tree;
- two different tests with the same `(file, testId)` become indistinguishable —
  a reporter keying on that pair silently merges them and loses one;
- when the true parent has already completed, nothing with that `testId`
  is open anymore, and the subtest cannot be attached anywhere at all.

## Why reporters cannot solve this

The runner *has* the missing information — it deserializes each child's event
pipe separately and knows exactly which child every event came from — but it
drops that identity when re-emitting on the merged root stream. On the consumer
side there is provably nothing to correlate on: the payloads are identical.

Buffering by declaration order (what `spec`/`junit` effectively do) is not an
answer for live reporters: a file's `test:start`/`pass`/`fail` block only
flushes when the file finishes, which for long-running suites means no
hierarchy for minutes. And even a buffering reporter is stuck when a child
process **crashes** before its declaration block flushes — the eager events it
did emit can never be attributed.

A related visible symptom, even without helpers: any test defined at nesting 0
in a shared module is grouped by reporters under the *helper* file (its
`data.file`), and two entry files running the same helper merge into one
subtree, because nothing on the events names the entry file.

## Proposed fix

Stamp process identity on forwarded events. Either of:

1. **`entryFile` (or `processId`) on every event forwarded from a child
   process** — the runner knows it at deserialization time; reporters get exact
   live attribution, crash-truncated runs stay attributable, and shared-helper
   tests can be grouped under the file that actually ran them. This
   complements `data.file` (definition site) rather than replacing it — both
   are useful.
2. Alternatively (weaker): make `testId` globally unique in the merged stream
   by having the runner remap child ids into the root counter space (it already
   assigns root-space ids to the file-wrapper tests). This fixes correlation
   but not entry-file grouping, and changes existing id semantics.

Option 1 is additive, backwards-compatible, and consistent with the direction
of https://github.com/nodejs/node/pull/63435, which added `parentId` precisely
"to track lineage when concurrent siblings at the same nesting level
interleave" — `parentId` solved in-process lineage; this is the cross-process
half of the same problem.

## Environment

- Reproduced on Node v26.4.0 and v24.16.0 (macOS; originally observed on a
  Linux CI runner), default `--test` isolation. On v24.16.0 the twin events are
  byte-identical *and* carry no `parentId` (pre-#63435), so even in-process
  lineage is missing there.
- Not reproducible with `--test-isolation=none` (single process, globally
  unique `testId`s) — which is also a hint that the merged-stream contract is
  what's incomplete.
