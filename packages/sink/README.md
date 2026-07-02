![tests](https://github.com/MoLow/reporters/actions/workflows/test.yaml/badge.svg?branch=main) [![codecov](https://codecov.io/gh/MoLow/reporters/branch/main/graph/badge.svg?token=0LFVC8SCQV)](https://codecov.io/gh/MoLow/reporters)

# CI Delivery Sinks

Give every CI run a shareable, browsable report URL.

`@reporters/sink` provides delivery sinks for
[`@reporters/mux`](https://github.com/MoLow/reporters/tree/main/packages/mux):
they upload a run's NDJSON event log somewhere a browser can fetch it — a GitHub
gist or an S3 bucket — so the hosted viewer at
**https://molow.github.io/reporters/** can render the run. Live-ish while the
run streams (periodic re-upload), durable after. The report link lands right in
your test output and, on GitHub Actions, in the job summary:

![a mux run printing the shareable report URL, followed by the CI log](https://raw.githubusercontent.com/MoLow/reporters/88901486cc58a9c706d5de24b44c8dd0630bf369/packages/sink/assets/cli.gif)

…and opening that link shows the full interactive tree — failures expanded with
their assertion diffs ([live example](https://molow.github.io/reporters/?src=https://raw.githubusercontent.com/MoLow/reporters/88901486cc58a9c706d5de24b44c8dd0630bf369/packages/web/assets/demo-run.ndjson)):

[![the hosted viewer rendering the delivered run](https://raw.githubusercontent.com/MoLow/reporters/88901486cc58a9c706d5de24b44c8dd0630bf369/packages/web/assets/viewer.png)](https://molow.github.io/reporters/?src=https://raw.githubusercontent.com/MoLow/reporters/88901486cc58a9c706d5de24b44c8dd0630bf369/packages/web/assets/demo-run.ndjson)

## Usage

```js
// mux.config.js
import { gist, s3 } from '@reporters/sink';

export default {
  ci: [
    { reporter: '@reporters/gh',  sink: 'stdout' },
    { reporter: '@reporters/web', sink: gist() },
    // or, in your own bucket:
    // { reporter: '@reporters/web', sink: s3({ bucket: 'ci-reports' }) },
  ],
};
```

When a sink exposes a viewer URL, `@reporters/mux` prints it to stderr and — on
GitHub Actions — adds a **View report** link to the job summary.

## `gist(options?)`

Creates a (secret, by default) gist and PATCHes it as the run grows. The viewer
polls the gist's raw URL. **Only active on GitHub Actions** — anywhere else it
prints one error to stderr and does nothing (pass `token` explicitly to use it
elsewhere), so an eagerly-evaluated config never breaks a local run.

> **Token:** the workflow's built-in `GITHUB_TOKEN` is an app installation
> token and **cannot create gists**. Create a (classic) personal access token
> with the `gist` scope, store it as a repository secret, and expose it to the
> test step:
>
> ```yaml
> - run: yarn test
>   env:
>     GH_TOKEN: ${{ secrets.GIST_TOKEN }}
> ```
>
> Without a usable token the sink prints an error and skips; a failed gist
> creation is also skipped, not fatal — delivery is best-effort and never
> fails the run.

- `token` — defaults to `GITHUB_TOKEN` / `GH_TOKEN`.
- `public` (default `false`), `filename` (`run.ndjson`), `description`,
  `viewerBase`, `flushMs` (2000).

## `s3(options)`

Uploads to S3 or any S3-compatible store and signs a presigned GET the viewer
reads back. Requires the AWS SDK (an optional peer dependency):

```bash
npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- `bucket` (required); `key` — defaults to
  `reporters/${GITHUB_RUN_ID ?? randomUUID()}.ndjson`.
- `region`, `endpoint` (R2 / MinIO / GCS), `credentials` — default to the SDK's
  provider chain (env, OIDC, instance role).
- `expiresIn` — presigned GET expiry in seconds (default 7 days).
- `viewerBase`, `flushMs` (2000).

The hosted viewer fetches the presigned GET **cross-origin**, so the bucket
needs a CORS rule for it:

```json
[{
  "AllowedOrigins": ["https://molow.github.io"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["Range"],
  "ExposeHeaders": ["Content-Range", "Accept-Ranges", "Content-Length"]
}]
```

## `remoteSink(options)`

The engine both are built on — bring your own transport:

```ts
remoteSink({
  start?: () => Promise<void>,           // one-time setup
  upload: (body: Buffer) => Promise<void>, // re-upload the full growing buffer
  viewerUrl: () => string | undefined,   // where a human views the run
  flushMs?: number,                       // re-upload cadence (default 2000)
})
```

Uploads are coalesced (never overlapping, only when the buffer changed) and a
final upload runs on close, so the last bytes always land.
