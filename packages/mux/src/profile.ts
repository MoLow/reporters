import type { MuxConfig, Route } from './types.ts';

export function isCI(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.CI || env.CONTINUOUS_INTEGRATION || env.GITHUB_ACTIONS || env.GITLAB_CI || env.BUILDKITE,
  );
}

/** `REPORTERS_PROFILE` if set, else `ci` under CI, else `local`. */
export function resolveProfileName(env: NodeJS.ProcessEnv = process.env): string {
  return env.REPORTERS_PROFILE || (isCI(env) ? 'ci' : 'local');
}

export function resolveProfile(config: MuxConfig, env: NodeJS.ProcessEnv = process.env): Route[] {
  const name = resolveProfileName(env);
  const routes = config[name];
  if (!routes) {
    const available = Object.keys(config).join(', ') || 'none';
    throw new Error(`mux: no profile "${name}" in config (available: ${available})`);
  }
  return routes;
}
