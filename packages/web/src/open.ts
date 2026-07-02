import { spawn } from 'node:child_process';

/** Best-effort: the single file this reporter is being written to, parsed from
 *  `--test-reporter-destination`. It's a Node CLI option, so it lives in
 *  execArgv (before the test files), not argv. Undefined if there are none/many
 *  (ambiguous) or the destination is a stream (stdout/stderr). When the reporter
 *  runs through `@reporters/mux` there is no such flag, so this is undefined —
 *  which is how the reporter knows it is not standalone. */
export function soleFileDestination(execArgv: string[] = process.execArgv): string | undefined {
  const flag = '--test-reporter-destination';
  const dests: string[] = [];
  for (let i = 0; i < execArgv.length; i += 1) {
    if (execArgv[i] === flag && execArgv[i + 1]) dests.push(execArgv[i + 1]);
    else if (execArgv[i].startsWith(`${flag}=`)) dests.push(execArgv[i].slice(flag.length + 1));
  }
  const files = dests.filter((d) => d && d !== 'stdout' && d !== 'stderr');
  return files.length === 1 ? files[0] : undefined;
}

export function isCI(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.CI || env.CONTINUOUS_INTEGRATION || env.GITHUB_ACTIONS || env.GITLAB_CI || env.BUILDKITE);
}

/**
 * Whether to open a live browser view. An explicit `open` option wins (mux
 * passes `open: false` via the reporter's declared under-mux defaults — the
 * sink owns viewing there); then the `REPORTERS_OPEN=1|0` env override;
 * otherwise the default is to open on an interactive terminal (a TTY) and not
 * in CI.
 */
export function shouldOpen(
  open: boolean | undefined,
  env: NodeJS.ProcessEnv = process.env,
  isTTY: boolean = Boolean(process.stdout.isTTY),
): boolean {
  if (open !== undefined) return open;
  const flag = env.REPORTERS_OPEN;
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return isTTY && !isCI(env);
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

/** Indirection so tests can observe the open without launching a browser. */
export const internals = { openInBrowser };
