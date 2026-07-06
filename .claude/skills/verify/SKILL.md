---
name: verify
description: Verify @reporters changes by driving the real web viewer over a served NDJSON log
---

# Verifying reporter/viewer changes

The surface for tree-core/web changes is the browser viewer rendering a real
NDJSON stream. Don't stop at unit tests — serve a log and look at pixels.

## Build

```bash
yarn build          # or: yarn workspace @reporters/web build (needs tree-core built first)
```

## Serve a log (including mid-run truncations)

`startViewerServer` is exported from `packages/web/src/server.ts`; in the built
output it lives in `packages/web/dist/chunk-*.js` (NOT re-exported from
`dist/index.js`). Minimal harness:

```js
import { startViewerServer } from '<repo>/packages/web/dist/chunk-KDWFRAWN.js'; // check chunk name after build
const server = await startViewerServer();
server.push(ndjsonText);           // push a truncated prefix to reproduce a mid-run state
console.log(server.url);           // http://127.0.0.1:<port>/?src=/run.ndjson&poll=250
setInterval(() => {}, 1 << 30);    // keep alive
```

Truncate a real log by wall-clock: parse each line's `t`, keep lines with
`t <= firstT + offsetMs`. Real corpus logs live in ~/Desktop or ~/Downloads
(report.ndjson from eon-service runs).

## Drive

Playwright MCP: navigate to the server URL, `scrollIntoView` a target row,
screenshot. Useful checks via browser_evaluate:

- header text: `document.querySelector('header').innerText`
- running rows: `document.querySelectorAll('[data-stc="running"], [data-running="true"]').length`

## Gotchas

- Console fills with 416 errors while polling a non-growing buffer — expected
  (the live poller probes past the end); not a bug.
- Screenshots default into the repo root; move them to .playwright-mcp/ (untracked).
- Store-level replays (createTreeStore over the log, diff snapshots per event)
  are the fast way to localize a rendering bug before opening the browser.
