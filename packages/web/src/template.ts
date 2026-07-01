const DARK = `
  --bg:#0d0e12; --panel:#15171e; --panel-2:#1a1d26; --raise:#20242f; --inset:#0a0b0e;
  --fg:#eceef3; --dim:#9aa1ad; --faint:#646b78;
  --line:rgba(255,255,255,.08); --line-2:rgba(255,255,255,.14);
  --row-hover:rgba(255,255,255,.04);
  --accent:#8b7cff; --accent-ink:#0c0a1f;
  --st-passed:#34d27b; --st-failed:#fb5a6a; --st-skipped:#8a93a1; --st-todo:#7c9cff; --st-running:#ffb13d; --st-queued:#5d6573;
  --soft-passed:rgba(52,210,123,.15); --soft-failed:rgba(251,90,106,.16); --soft-skipped:rgba(138,147,161,.16); --soft-todo:rgba(124,156,255,.16); --soft-running:rgba(255,177,61,.17); --soft-queued:rgba(93,101,115,.18);
  --fail-tint:rgba(251,90,106,.07);
`;

const LIGHT = `
  --bg:#f6f7f9; --panel:#ffffff; --panel-2:#f4f6f8; --raise:#eef1f4; --inset:#f8f9fb;
  --fg:#161b22; --dim:#5a636f; --faint:#9099a5;
  --line:rgba(17,24,33,.10); --line-2:rgba(17,24,33,.18);
  --row-hover:rgba(17,24,33,.035);
  --accent:#6357e6; --accent-ink:#ffffff;
  --st-passed:#16a34a; --st-failed:#e23744; --st-skipped:#697381; --st-todo:#3f63d6; --st-running:#bf7400; --st-queued:#97a0ad;
  --soft-passed:rgba(22,163,74,.12); --soft-failed:rgba(226,55,68,.10); --soft-skipped:rgba(105,115,129,.12); --soft-todo:rgba(63,99,214,.11); --soft-running:rgba(191,116,0,.13); --soft-queued:rgba(151,160,173,.14);
  --fail-tint:rgba(226,55,68,.05);
`;

export const STYLES = `
:root {
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
:root[data-theme="dark"] {${DARK}}
:root[data-theme="light"] {${LIGHT}}
@media (prefers-color-scheme: dark) { :root:not([data-theme]) {${DARK}} }
@media (prefers-color-scheme: light) { :root:not([data-theme]) {${LIGHT}} }

* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  background: var(--bg); color: var(--fg);
  font-family: var(--sans); font-size: 14px; line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
#root { height: 100%; }
button { font-family: inherit; } input { font-family: inherit; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }
::-webkit-scrollbar { width: 11px; height: 11px; }
::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 7px; border: 3px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-track { background: transparent; }

/* status color helpers */
[data-stc="passed"]{color:var(--st-passed)} [data-stc="failed"]{color:var(--st-failed)} [data-stc="skipped"]{color:var(--st-skipped)} [data-stc="todo"]{color:var(--st-todo)} [data-stc="running"]{color:var(--st-running)} [data-stc="queued"]{color:var(--st-queued)}
[data-stf="passed"]{background:var(--st-passed)} [data-stf="failed"]{background:var(--st-failed)} [data-stf="skipped"]{background:var(--st-skipped)} [data-stf="todo"]{background:var(--st-todo)} [data-stf="running"]{background:var(--st-running)} [data-stf="queued"]{background:var(--st-queued)}
[data-soft="passed"]{background:var(--soft-passed);color:var(--st-passed)} [data-soft="failed"]{background:var(--soft-failed);color:var(--st-failed)} [data-soft="skipped"]{background:var(--soft-skipped);color:var(--st-skipped)} [data-soft="todo"]{background:var(--soft-todo);color:var(--st-todo)} [data-soft="running"]{background:var(--soft-running);color:var(--st-running)} [data-soft="queued"]{background:var(--soft-queued);color:var(--st-queued)}

/* motion */
@keyframes pspin { to { transform: rotate(360deg); } }
@keyframes ppulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
[data-spin="true"] { display: inline-block; animation: pspin 1s linear infinite; }
[data-pulse="true"] { animation: ppulse 1.5s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { [data-spin="true"], [data-pulse="true"] { animation: none; } }

/* app shell */
.app { height: 100%; display: flex; flex-direction: column; }
.app[data-dense="false"] { --rh: 34px; --fs: 13.5px; --ind: 20px; }
.app[data-dense="true"]  { --rh: 26px; --fs: 12.5px; --ind: 15px; }
.loading { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--faint); font-size: 13px; }

/* header */
.hdr { flex: none; background: var(--panel); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 5; }
.hdr-row { display: flex; align-items: center; gap: 16px; padding: 15px 18px 13px; flex-wrap: wrap; }
.verdict { display: inline-flex; align-items: center; gap: 9px; padding: 8px 15px 8px 12px; border-radius: 12px; }
.verdict-glyph { font-size: 17px; font-weight: 800; line-height: 1; }
.verdict-text { display: flex; flex-direction: column; line-height: 1.15; }
.verdict-main { font-size: 15px; font-weight: 700; letter-spacing: .01em; }
.verdict-sub { font-size: 11px; opacity: .85; }
.chips { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.chip-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.chip-label { opacity: .7; font-weight: 500; }
.tools { margin-left: auto; display: flex; gap: 9px; align-items: center; }
.search { position: relative; display: flex; align-items: center; }
.search svg { position: absolute; left: 11px; color: var(--faint); pointer-events: none; }
.search input { background: var(--panel-2); border: 1px solid var(--line); color: var(--fg); font-size: 13px; padding: 8px 12px 8px 32px; border-radius: 10px; width: 188px; outline: none; }
.btn { background: var(--panel-2); border: 1px solid var(--line); color: var(--dim); border-radius: 10px; padding: 8px 11px; font-size: 12px; cursor: pointer; transition: background .13s, color .13s; }
.btn:hover { background: var(--raise); color: var(--fg); }
.hdr-bar-row { padding: 0 18px 13px; display: flex; align-items: center; gap: 14px; }
.bar { flex: 1; min-width: 220px; height: 9px; display: flex; gap: 2px; border-radius: 999px; overflow: hidden; background: var(--panel-2); }
.bar > span { height: 100%; }

/* tree */
.tree { flex: 1; overflow: auto; min-height: 0; padding: 8px 10px 28px; }
.row { display: flex; align-items: center; gap: 8px; min-height: var(--rh); padding: 0 12px; border-radius: 9px; }
.row[data-clickable="true"] { cursor: pointer; }
.row:hover { background: var(--row-hover); }
.row[data-fail="true"] { background: var(--fail-tint); }
.guides { display: flex; flex: none; align-self: stretch; }
.guide { width: var(--ind); align-self: stretch; border-left: 1px solid var(--line); }
.caret { width: 16px; flex: none; display: flex; align-items: center; justify-content: center; color: var(--faint); font-size: 10px; }
.dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.cglyph { font-size: 13px; font-weight: 700; width: 14px; flex: none; text-align: center; }
.name { font-size: var(--fs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.name[data-kind="file"] { font-family: var(--mono); font-weight: 700; }
.name[data-kind="suite"] { font-weight: 600; }
.name[data-kind="test"] { font-weight: 450; }
.diagbadge { flex: none; font-size: 10px; font-weight: 600; border-radius: 6px; padding: 1px 6px; }
.spacer { flex: 1; min-width: 10px; }
.pills { display: inline-flex; gap: 5px; flex: none; margin-right: 9px; }
.pill { font-size: 11px; font-weight: 700; border-radius: 999px; padding: 1px 8px; font-variant-numeric: tabular-nums; }
.dur { flex: none; color: var(--faint); font-size: 11.5px; font-family: var(--mono); min-width: 54px; text-align: right; font-variant-numeric: tabular-nums; }

/* diagnostics */
.diag { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--panel-2); }
.diag-sec { display: flex; }
.diag-sec + .diag-sec { border-top: 1px solid var(--line); }
.diag-bar { width: 3px; flex: none; }
.diag-body { flex: 1; min-width: 0; }
.diag-head { display: flex; align-items: center; gap: 7px; padding: 8px 13px; }
.diag-icon { font-weight: 800; font-size: 12px; }
.diag-title { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--dim); }
.diag-msg { padding: 0 14px; }
.diag-msg span { font-size: 13px; font-weight: 600; }
.diag pre { margin: 0; font-family: var(--mono); font-size: 11.5px; line-height: 1.55; }
.diag pre.stack { padding: 2px 14px 13px; color: var(--dim); overflow-x: auto; white-space: pre; }
.diag pre.text { padding: 2px 14px 13px; color: var(--fg); overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
.diag pre.text.err { color: var(--fg); }
.diag-list { padding: 2px 14px 12px; display: flex; flex-direction: column; gap: 6px; }
.diag-item { font-size: 12.5px; color: var(--fg); display: flex; gap: 9px; align-items: baseline; }
.diag-level { font-size: 9.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; flex: none; border-radius: 5px; padding: 1px 6px; }
.diag-item .txt { font-family: var(--mono); font-size: 12px; }

/* full-tree states */
.state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 13px; padding: 66px 20px; text-align: center; }
.state-icon { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; }
.state-title { font-size: 16px; color: var(--fg); font-weight: 600; }
.state-sub { font-size: 13px; color: var(--faint); max-width: 380px; line-height: 1.6; }
.state-cmd { background: var(--panel-2); border: 1px solid var(--line); color: var(--dim); padding: 9px 14px; border-radius: 10px; font-family: var(--mono); font-size: 12px; max-width: 92%; overflow-x: auto; }
.btn-primary { background: var(--accent); border: none; color: var(--accent-ink); border-radius: 10px; padding: 9px 17px; font-size: 13px; font-weight: 600; cursor: pointer; }

/* footer */
.footer { flex: none; border-top: 1px solid var(--line); background: var(--panel); padding: 8px 18px; display: flex; align-items: center; gap: 10px; color: var(--faint); font-size: 11px; }
.footer .brand { font-weight: 700; color: var(--dim); }
.legend { margin-left: auto; display: inline-flex; gap: 13px; }
.legend > span { display: inline-flex; gap: 5px; align-items: center; }
.legend .ldot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
`;

export interface HeaderOptions {
  title?: string;
}

/**
 * The opening of the streamed HTML document: inlined styles, the inlined client
 * bundle, a DOMContentLoaded fallback (so a truncated/crashed stream still
 * renders whatever arrived), and the opening of the embedded NDJSON log.
 */
export function htmlHeader(clientJs: string, opts: HeaderOptions = {}): string {
  const title = opts.title ?? 'node:test report';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<div id="root"><div class="loading">Loading report…</div></div>
<script>${clientJs}</script>
<script>document.addEventListener('DOMContentLoaded',function(){try{window.__reportersRenderEmbedded&&window.__reportersRenderEmbedded()}catch(e){console.error(e)}});</script>
<script type="application/x-ndjson" id="events">
`;
}

export const HTML_FOOTER = `</script>
<script>try{window.__reportersRenderEmbedded&&window.__reportersRenderEmbedded()}catch(e){console.error(e)}</script>
</body>
</html>
`;

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

/** NDJSON content must not contain a literal `</script` that would close the
 *  embedding script element. Escape the slash defensively. */
export function safeEventLine(line: string): string {
  return line.replace(/<\/(script)/gi, '<\\/$1');
}
