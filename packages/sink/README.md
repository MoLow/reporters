# @reporters/sink

Delivery sinks for [`@reporters/mux`](https://www.npmjs.com/package/@reporters/mux):
upload a `node:test` run's NDJSON somewhere a browser can fetch it, so the hosted
viewer at **https://molow.github.io/reporters/** can render CI runs — live-ish
while the run streams (periodic re-upload), durable after.

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
