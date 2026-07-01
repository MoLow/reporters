import { test } from 'node:test';
import assert from 'node:assert';
import { isCI, resolveProfileName, resolveProfile } from '../src/profile.ts';
import type { MuxConfig } from '../src/types.ts';

const config: MuxConfig = {
  local: [{ reporter: 'x', sink: 'stdout' }],
  ci: [{ reporter: 'y', sink: 'stderr' }],
};

test('isCI detects common CI environments', () => {
  assert.strictEqual(isCI({}), false);
  assert.strictEqual(isCI({ CI: 'true' }), true);
  assert.strictEqual(isCI({ GITHUB_ACTIONS: 'true' }), true);
});

test('resolveProfileName: explicit env wins, else CI-based default', () => {
  assert.strictEqual(resolveProfileName({}), 'local');
  assert.strictEqual(resolveProfileName({ CI: 'true' }), 'ci');
  assert.strictEqual(resolveProfileName({ CI: 'true', REPORTERS_PROFILE: 'local' }), 'local');
  assert.strictEqual(resolveProfileName({ REPORTERS_PROFILE: 'custom' }), 'custom');
});

test('resolveProfile returns the matching routes', () => {
  assert.deepStrictEqual(resolveProfile(config, {}), config.local);
  assert.deepStrictEqual(resolveProfile(config, { CI: 'true' }), config.ci);
});

test('resolveProfile throws a helpful error for a missing profile', () => {
  assert.throws(
    () => resolveProfile(config, { REPORTERS_PROFILE: 'nope' }),
    /no profile "nope".*available: local, ci/s,
  );
  // an empty config reports "none" as the available list
  assert.throws(
    () => resolveProfile({}, { REPORTERS_PROFILE: 'nope' }),
    /available: none/,
  );
});

test('isCI detects the remaining CI environment variables', () => {
  assert.strictEqual(isCI({ CONTINUOUS_INTEGRATION: 'true' }), true);
  assert.strictEqual(isCI({ GITLAB_CI: 'true' }), true);
  assert.strictEqual(isCI({ BUILDKITE: 'true' }), true);
});
