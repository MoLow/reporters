import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { isCI } from './profile.ts';

/**
 * Whether to open a sink's viewer URL in a browser. Env `REPORTERS_OPEN=1|0`
 * forces it; otherwise a route may opt out with `open: false`; the default is
 * on locally and off in CI.
 */
export function shouldOpen(routeOpen: boolean | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.REPORTERS_OPEN;
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  if (routeOpen === false) return false;
  return !isCI(env);
}

/** The platform command to open a URL in the default browser. */
export function openCommand(url: string, platform: NodeJS.Platform = process.platform): [string, string[]] {
  if (platform === 'darwin') return ['open', [url]];
  if (platform === 'win32') return ['cmd', ['/c', 'start', '', url]];
  return ['xdg-open', [url]];
}

/* c8 ignore start -- spawning a real browser isn't unit-testable */
function openInBrowser(url: string): void {
  const [cmd, args] = openCommand(url);
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => { /* no browser / headless — ignore */ });
    child.unref();
  } catch { /* ignore */ }
}
/* c8 ignore stop */

/**
 * Surface a sink's viewer URL: always a stderr hint, and on GitHub Actions
 * (GITHUB_STEP_SUMMARY set) also a "View report" link in the job summary.
 */
export function announce(url: string, env: NodeJS.ProcessEnv = process.env): void {
  process.stderr.write(`\n@reporters/mux: report at ${url}\n`);
  if (env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(env.GITHUB_STEP_SUMMARY, `\n[View report](${url})\n`);
    } catch { /* summary unavailable — the stderr hint already landed */ }
  }
}

/** Indirection so tests can observe opens/announces without side effects. */
export const internals = { openInBrowser, announce };
