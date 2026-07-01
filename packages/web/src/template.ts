export const STYLES = `
:root {
  --bg: #0a0c11; --surface: #0f131a; --surface-2: #151b24; --border: #202833;
  --guide: #1b222c; --text: #dbe2ec; --muted: #6c7787; --accent: #7aa2f7;
  --passed: #3fb950; --failed: #f85149; --skipped: #d8a020;
  --todo: #b083f0; --running: #58a6ff; --queued: #6c7787;
  --shadow: 0 1px 0 rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.25);
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #f6f8fb; --surface: #ffffff; --surface-2: #eef2f7; --border: #dde4ec;
    --guide: #e6ebf2; --text: #1b2733; --muted: #69727f; --accent: #2f5fd0;
    --passed: #1a7f37; --failed: #cf222e; --skipped: #9a6700;
    --todo: #8250df; --running: #0969da; --queued: #8b949e;
    --shadow: 0 1px 2px rgba(31,41,55,.08), 0 8px 24px rgba(31,41,55,.06);
  }
}
* { box-sizing: border-box; }
html { color-scheme: dark light; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 13px; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
.font-ui { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.app { max-width: 1040px; margin: 0 auto; padding: 0 20px 96px; }

/* ---- status bar ---- */
.statusbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 14px 16px; margin: 0 -16px 18px;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.brand {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-weight: 700; letter-spacing: -.01em; font-size: 14px; color: var(--muted);
}
.brand b { color: var(--text); }
.verdict {
  font-family: system-ui, -apple-system, sans-serif;
  display: inline-flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 12px; letter-spacing: .08em; text-transform: uppercase;
  padding: 5px 12px; border-radius: 999px; border: 1px solid transparent;
}
.verdict .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.verdict.v-passed { color: var(--passed); background: color-mix(in srgb, var(--passed) 14%, transparent); border-color: color-mix(in srgb, var(--passed) 35%, transparent); }
.verdict.v-failed { color: var(--failed); background: color-mix(in srgb, var(--failed) 14%, transparent); border-color: color-mix(in srgb, var(--failed) 35%, transparent); }
.verdict.v-running { color: var(--running); background: color-mix(in srgb, var(--running) 14%, transparent); border-color: color-mix(in srgb, var(--running) 35%, transparent); }
.chips { display: flex; align-items: center; gap: 12px; }
.chip { display: inline-flex; align-items: baseline; gap: 5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.chip .g { font-size: 12px; }
.chip.c-passed { color: var(--passed); } .chip.c-failed { color: var(--failed); }
.chip.c-skipped { color: var(--skipped); } .chip.c-todo { color: var(--todo); }
.chip.c-running { color: var(--running); }
.meter { flex: 1 1 160px; min-width: 100px; height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; display: flex; }
.meter > span { height: 100%; }
.dur { color: var(--muted); font-variant-numeric: tabular-nums; }
.search {
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
  border-radius: 8px; padding: 7px 11px; font-size: 13px; width: 160px; transition: border-color .15s, box-shadow .15s;
}
.search:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }
.search::placeholder { color: var(--muted); }

/* ---- tree ---- */
.children { margin-left: 9px; padding-left: 15px; border-left: 1px solid var(--guide); }
.row {
  position: relative; display: flex; align-items: center; gap: 8px;
  padding: 3px 10px 3px 8px; border-radius: 7px; margin-left: -8px;
  border-left: 2px solid transparent;
}
.row.clickable { cursor: pointer; }
.row.clickable:hover { background: var(--surface); }
.row.status-failed { border-left-color: color-mix(in srgb, var(--failed) 55%, transparent); }
.row.status-running { border-left-color: color-mix(in srgb, var(--running) 55%, transparent); }
.twist { width: .9em; flex: 0 0 auto; color: var(--muted); font-size: 11px; }
.glyph { width: 1.1em; flex: 0 0 auto; text-align: center; }
.name { flex: 1 1 auto; white-space: pre-wrap; word-break: break-word; }
.name.file { font-family: system-ui, -apple-system, sans-serif; font-weight: 650; letter-spacing: -.01em; }
.tally { color: var(--muted); font-size: 12px; }
.status-passed > .glyph, .row.status-passed .glyph { color: var(--passed); }
.status-failed .glyph { color: var(--failed); }
.status-skipped .glyph { color: var(--skipped); }
.status-todo .glyph { color: var(--todo); }
.status-running .glyph { color: var(--running); }
.status-queued .glyph { color: var(--queued); }
.row.status-running .glyph { animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }

/* ---- diagnostics ---- */
.diag {
  margin: 6px 0 8px 6px; padding: 12px 14px; background: var(--surface);
  border: 1px solid var(--border); border-left: 3px solid var(--border);
  border-radius: 8px; overflow-x: auto; box-shadow: var(--shadow);
}
.diag.has-error { border-left-color: var(--failed); }
.diag section + section { margin-top: 12px; }
.diag .label {
  font-family: system-ui, -apple-system, sans-serif;
  color: var(--muted); font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .09em; margin-bottom: 5px;
}
.diag pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 12.5px; }
.diag pre.err { color: var(--failed); }
.empty {
  font-family: system-ui, -apple-system, sans-serif;
  color: var(--muted); padding: 64px 24px; text-align: center; font-size: 15px;
}
.empty code { font-family: ui-monospace, monospace; background: var(--surface-2); padding: 2px 6px; border-radius: 5px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
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
<div id="root"><div class="empty">Loading test report…</div></div>
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
