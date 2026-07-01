# @reporters/mux

Environment-aware routing for `node:test` reporters. Register it once; it reads a
`mux.config` file, picks the active **profile** (`ci` vs `local`, auto-detected),
tees the test-event stream to every configured **reporter**, and pipes each
reporter's output into its **sink** (`stdout`/`stderr`/a file, or a custom sink
such as `@reporters/web`'s local HTTP server).

```bash
node --test --test-reporter=@reporters/mux
```

## Config

Create a `mux.config.js` (or `.mjs`/`.ts`), discovered by walking up from the
current directory. It default-exports a map of profile name → routes:

```js
import { httpServer } from '@reporters/web/sink';
import live from '@reporters/live';

export default {
  local: [
    { reporter: live,             sink: 'stdout' },
    { reporter: '@reporters/web', sink: httpServer() }, // serves localhost, opens the browser
  ],
  ci: [
    { reporter: '@reporters/gh',  sink: 'stdout' },
    { reporter: '@reporters/web', sink: 'run.ndjson' }, // archive NDJSON as a CI artifact
  ],
};
```

Both async-generator reporters (like `@reporters/live`, `@reporters/web`) and
Transform-stream reporters (like `@reporters/gh`) are supported as route reporters.

### Route fields

- `reporter` — a reporter function, a Transform/Duplex stream, or a module specifier `mux` will `import()`.
- `options` — optional 2nd-arg object passed to the reporter (e.g.
  `@reporters/web` accepts `{ open: boolean }`); most reporters need none.
- `sink` — `'stdout'`, `'stderr'`, a file path, or a `Sink` object.
- `open` — open the sink's viewer URL in a browser. Defaults to on locally, off
  in CI. `open: false` opts out; `REPORTERS_OPEN=1|0` forces it.

### Profile resolution

`REPORTERS_PROFILE` if set; otherwise `ci` when a CI environment is detected
(`CI`, `GITHUB_ACTIONS`, `GITLAB_CI`, `BUILDKITE`, …), else `local`.

## Sinks

A sink decides where a reporter's bytes go — and, for viewers, where a human
looks:

```ts
interface Sink {
  start?(): Promise<void>;
  write(chunk: string | Buffer): void | Promise<void>;
  flush?(): Promise<void>;
  close(): Promise<void>;
  viewerUrl?(): string | undefined;
}
```

Built in: `'stdout'`, `'stderr'`, and file paths. `@reporters/web` ships a
`httpServer()` sink. (An `s3://` sink and hosted-viewer open are planned.)
