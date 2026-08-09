const DARK = `
  --bg:#0d0e12; --panel:#15171e; --panel-2:#1a1d26; --raise:#20242f; --inset:#0a0b0e;
  --fg:#eceef3; --dim:#9aa1ad; --faint:#646b78;
  --line:rgba(255,255,255,.08); --line-2:rgba(255,255,255,.14);
  --row-hover:rgba(255,255,255,.04);
  --accent:#8b7cff; --accent-ink:#0c0a1f; --accent-soft:rgba(139,124,255,.16); --scrim:rgba(4,5,8,.55);
  --st-passed:#34d27b; --st-failed:#fb5a6a; --st-skipped:#8a93a1; --st-todo:#7c9cff; --st-running:#ffb13d; --st-queued:#5d6573;
  --st-cancelled:#8a93a1;
  --soft-passed:rgba(52,210,123,.15); --soft-failed:rgba(251,90,106,.16); --soft-skipped:rgba(138,147,161,.16); --soft-todo:rgba(124,156,255,.16); --soft-running:rgba(255,177,61,.17); --soft-queued:rgba(93,101,115,.18);
  --fail-tint:rgba(251,90,106,.07);
  --carry-fg:#a2a9b5; --carry-bg:rgba(255,255,255,.06); --carry-border:rgba(255,255,255,.14);
  --tip-bg:#eceef3; --tip-fg:#15171e; --tip-border:rgba(2,21,30,.12); --tip-shadow:0 12px 30px rgba(0,0,0,.5);
  --ansi-black:#5d6573; --ansi-red:#fb5a6a; --ansi-green:#34d27b; --ansi-yellow:#ffb13d; --ansi-blue:#7c9cff; --ansi-magenta:#c792ea; --ansi-cyan:#56d4dd; --ansi-white:#c4c9d4;
  --ansi-bright-black:#8a93a1; --ansi-bright-red:#ff8087; --ansi-bright-green:#66e0a3; --ansi-bright-yellow:#ffca6a; --ansi-bright-blue:#a3b8ff; --ansi-bright-magenta:#e0aaff; --ansi-bright-cyan:#8be9fd; --ansi-bright-white:#ffffff;
  --ansi-bold-font-weight:700; --ansi-dim-opacity:.6;
`;

const LIGHT = `
  --bg:#f6f7f9; --panel:#ffffff; --panel-2:#f4f6f8; --raise:#eef1f4; --inset:#f8f9fb;
  --fg:#161b22; --dim:#5a636f; --faint:#9099a5;
  --line:rgba(17,24,33,.10); --line-2:rgba(17,24,33,.18);
  --row-hover:rgba(17,24,33,.035);
  --accent:#6357e6; --accent-ink:#ffffff; --accent-soft:rgba(99,87,230,.11); --scrim:rgba(17,24,33,.28);
  --st-passed:#16a34a; --st-failed:#e23744; --st-skipped:#697381; --st-todo:#3f63d6; --st-running:#bf7400; --st-queued:#97a0ad;
  --st-cancelled:#697381;
  --soft-passed:rgba(22,163,74,.12); --soft-failed:rgba(226,55,68,.10); --soft-skipped:rgba(105,115,129,.12); --soft-todo:rgba(63,99,214,.11); --soft-running:rgba(191,116,0,.13); --soft-queued:rgba(151,160,173,.14);
  --fail-tint:rgba(226,55,68,.05);
  --carry-fg:#586170; --carry-bg:rgba(17,24,33,.05); --carry-border:rgba(17,24,33,.14);
  --tip-bg:#161b22; --tip-fg:#f6f7f9; --tip-border:rgba(255,255,255,.08); --tip-shadow:0 10px 26px rgba(2,21,30,.34);
  --ansi-black:#161b22; --ansi-red:#e23744; --ansi-green:#16a34a; --ansi-yellow:#bf7400; --ansi-blue:#3f63d6; --ansi-magenta:#9333ea; --ansi-cyan:#0e7490; --ansi-white:#5a636f;
  --ansi-bright-black:#697381; --ansi-bright-red:#dc2626; --ansi-bright-green:#15803d; --ansi-bright-yellow:#a16207; --ansi-bright-blue:#2947c0; --ansi-bright-magenta:#7e22ce; --ansi-bright-cyan:#0891b2; --ansi-bright-white:#161b22;
  --ansi-bold-font-weight:700; --ansi-dim-opacity:.6;
`;

export const STYLES = `
:root {
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --ease-out: cubic-bezier(.2,.6,.2,1);
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
/* pointer-origin focus (tagged in TreeView) never paints the keyboard ring */
[data-pointer]:focus-visible { outline: none; }
::-webkit-scrollbar { width: 11px; height: 11px; }
::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 7px; border: 3px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-track { background: transparent; }

/* status color helpers */
[data-stc="passed"]{color:var(--st-passed)} [data-stc="failed"]{color:var(--st-failed)} [data-stc="skipped"]{color:var(--st-skipped)} [data-stc="todo"]{color:var(--st-todo)} [data-stc="running"]{color:var(--st-running)} [data-stc="queued"]{color:var(--st-queued)} [data-stc="cancelled"]{color:var(--st-cancelled)}
[data-stf="passed"]{background:var(--st-passed)} [data-stf="failed"]{background:var(--st-failed)} [data-stf="skipped"]{background:var(--st-skipped)} [data-stf="todo"]{background:var(--st-todo)} [data-stf="running"]{background:var(--st-running)} [data-stf="queued"]{background:var(--st-queued)}
[data-soft="passed"]{background:var(--soft-passed);color:var(--st-passed)} [data-soft="failed"]{background:var(--soft-failed);color:var(--st-failed)} [data-soft="skipped"]{background:var(--soft-skipped);color:var(--st-skipped)} [data-soft="todo"]{background:var(--soft-todo);color:var(--st-todo)} [data-soft="running"]{background:var(--soft-running);color:var(--st-running)} [data-soft="queued"]{background:var(--soft-queued);color:var(--st-queued)}

/* motion */
@keyframes pspin { to { transform: rotate(360deg); } }
@keyframes ppulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
[data-spin="true"] { display: inline-block; animation: pspin 1s linear infinite; }
[data-pulse="true"] { animation: ppulse 1.5s ease-in-out infinite; }

/* live viewer: rows arriving, running, and settling (§9) */
@keyframes rowEnter { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes rowPulse { 0%,100% { background: transparent; } 50% { background: var(--row-hover); } }
@keyframes settlePop { 0% { transform: scale(.6); opacity: .4; } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
@keyframes failFlash { from { background: var(--soft-failed); } to { background: transparent; } }

.row-enter { animation: rowEnter 220ms var(--ease-out) both; }
/* a running row pulses faintly once it has settled onto the screen (not while entering) */
.row[data-running="true"]:not(.row-enter) { animation: rowPulse 1.6s ease-in-out infinite; }
/* a ring spinner in the status-dot slot for a running test */
.spinner { width: 10px; height: 10px; flex: none; border-radius: 50%; border: 2px solid var(--soft-running); border-top-color: var(--st-running); animation: spin .8s linear infinite; }
/* indicators cross-fade their color, so even a plain status swap eases */
.indicator { transition: color 200ms var(--ease-out), background-color 200ms var(--ease-out); }
.settle-passed .indicator, .settle-failed .indicator, .settle-todo .indicator, .settle-skipped .indicator { animation: settlePop 300ms var(--ease-out); }
/* failures earn one extra beat: a single row tint flash, never a loop */
.settle-failed { animation: failFlash 500ms var(--ease-out); }
/* the summary bar slides as counts shift queued -> settled */
.bar > span { transition: flex-grow 300ms var(--ease-out); }
.verdict { transition: background-color 200ms var(--ease-out), color 200ms var(--ease-out); }

@media (prefers-reduced-motion: reduce) {
  [data-spin="true"], [data-pulse="true"], .spinner,
  .row-enter, .row[data-running="true"]:not(.row-enter),
  .settle-passed .indicator, .settle-failed .indicator, .settle-todo .indicator, .settle-skipped .indicator,
  .settle-failed { animation: none; }
  .caret, .collapsible, .collapsible > .inner > .diag, .btn, .btn-primary, .indicator, .bar > span, .verdict { transition: none; }
  /* keep a running test legible without motion: a static amber ring */
  .spinner { border-color: var(--soft-running); border-top-color: var(--st-running); }
}

/* app shell */
.app { height: 100%; display: flex; flex-direction: column; --diag-mr: 12px; --diag-gap: 18px; }
/* Row density. Compact is the shipping default — a real run is hundreds of
   rows, and the tree is for scanning them. */
.app, .app[data-dense="compact"] { --rh: 26px; --fs: 12.5px; --ind: 15px; }
.app[data-dense="cozy"] { --rh: 34px; --fs: 13.5px; --ind: 20px; }
.loading { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--faint); font-size: 13px; }

/* header */
.hdr { flex: none; background: var(--panel); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 5; }
.hdr-row { display: flex; align-items: center; gap: 16px; padding: 13px 18px 11px; flex-wrap: wrap; }
.verdict { display: inline-flex; align-items: center; gap: 9px; padding: 6px 13px 6px 10px; border-radius: 11px; }
.verdict-glyph { font-size: 15px; font-weight: 800; line-height: 1; }
.verdict-text { display: flex; flex-direction: column; line-height: 1.15; }
.verdict-main { font-size: 14px; font-weight: 700; letter-spacing: .01em; }
/* secondary text stays neutral ink; the saturated status color is reserved
   for the glyph and status word (designer contrast ruling) */
.verdict-sub { font-size: 11px; color: var(--dim); font-variant-numeric: tabular-nums; }
.chips { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; gap: 7px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid transparent; cursor: pointer; font-family: inherit; }
.chip:hover { filter: brightness(1.12); }
.chip[data-active] { border-color: currentColor; }
.chip-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
/* the count keeps the status color; the label word gets full-contrast ink
   (color-on-tint failed WCAG AA for the muted variants) */
.chip-label { color: var(--dim); font-weight: 500; }
.tools { margin-left: auto; display: flex; gap: 9px; align-items: center; }
.search { position: relative; display: flex; align-items: center; }
.search svg { position: absolute; left: 11px; color: var(--faint); pointer-events: none; }
.search input { background: var(--panel-2); border: 1px solid var(--line); color: var(--fg); font-size: 13px; padding: 7px 12px 7px 32px; border-radius: 10px; width: 188px; outline: none; }
.btn { display: inline-flex; align-items: center; gap: 6px; background: var(--panel-2); border: 1px solid var(--line); color: var(--dim); border-radius: 10px; padding: 7px 11px; font-size: 12px; cursor: pointer; transition: background .13s, color .13s, transform .13s; }
.btn[data-on="true"] { color: var(--fg); border-color: var(--line-2); background: var(--raise); }
.btn:hover { background: var(--raise); color: var(--fg); }
.btn:active { transform: scale(.97); }
.hdr-bar-row { padding: 0 18px 13px; display: flex; align-items: center; gap: 14px; }
.bar { flex: 1; min-width: 220px; height: 8px; display: flex; gap: 2px; border-radius: 999px; overflow: hidden; background: var(--panel-2); }
.bar > span { height: 100%; }

/* tree */
.tree { flex: 1; overflow: auto; min-height: 0; padding: 7px 10px 26px; }
.row[data-sel="true"] { background: var(--accent-soft); }
/* the row's log button: idle it is quiet, active it is the popup's anchor */
.logbtn { display: inline-flex; align-items: center; gap: 4px; flex: none; background: transparent; border: 1px solid transparent; color: var(--faint); border-radius: 7px; padding: 2px 7px; line-height: 16px; font-family: inherit; cursor: pointer; transition: background .13s, color .13s, border-color .13s; }
.logbtn:hover { color: var(--fg); background: var(--row-hover); }
.logbtn[data-on] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.logbtn-n { font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
/* one-line "what broke", under the row that broke */
.errline { display: flex; align-items: center; gap: 7px; margin: 1px 10px 3px; padding: 3px 10px; border-radius: 8px; background: var(--fail-tint); cursor: pointer; }
.errline:hover { background: var(--soft-failed); }
.errline-x { flex: none; font-size: 11px; font-weight: 800; color: var(--st-failed); }
.errline-msg { flex: 1; min-width: 0; font-family: var(--mono); font-size: 12px; color: var(--st-failed); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.errline-open { flex: none; font-size: 11px; font-weight: 600; color: var(--st-failed); opacity: .7; }
.row { display: flex; align-items: center; gap: 8px; min-height: var(--rh); padding: 0 10px 0 12px; border-radius: 9px; position: relative; isolation: isolate; }
.row[data-clickable="true"] { cursor: pointer; }
.row[data-fail="true"] { background: var(--fail-tint); }
/* Hover is a layer over the row background, never another writer of it: the
   running pulse animates that background (and an animated value outranks any
   rule), the fail tint sets it, and either would swallow the hover cue. The
   row isolates so this negative layer lands above its own background and
   below its content. */
.row::before { content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; background: var(--row-hover); opacity: 0; pointer-events: none; }
.row:hover::before { opacity: 1; }
.guides { display: flex; flex: none; align-self: stretch; }
.guide { width: var(--ind); align-self: stretch; border-left: 1px solid var(--line); }
.caret { width: 14px; flex: none; display: flex; align-items: center; justify-content: center; color: var(--faint); font-size: 10px; transition: transform 160ms var(--ease-out); }
.caret[data-open="true"] { transform: rotate(90deg); }
.cglyph { font-size: 13px; font-weight: 700; width: 14px; flex: none; text-align: center; }
/* A test's status mark: one result, so a dot rather than a verdict glyph. */
.tdot { width: 9px; height: 9px; border-radius: 50%; flex: none; margin: 0 2.5px; }
.name { font-size: var(--fs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.name[data-kind="file"] { font-family: var(--mono); font-weight: 700; }
.name[data-kind="suite"] { font-weight: 600; }
.name[data-kind="test"] { font-weight: 450; }
/* passive badge on a node row (right after the name): output exists inside
   this node — never a control */
.outbadge { flex: none; color: var(--faint); font-size: 11px; font-weight: 700; margin-left: 2px; }
.failchip { flex: none; font-size: 10.5px; font-weight: 700; border-radius: 6px; padding: 1px 7px; }
.todotag { flex: none; font-size: 10.5px; font-weight: 600; border-radius: 6px; padding: 1px 7px; }
.spacer { flex: 1; min-width: 10px; }
.pills { display: inline-flex; gap: 5px; flex: none; margin-right: 9px; }
.pill { font-size: 11px; font-weight: 700; border-radius: 999px; padding: 1px 8px; font-variant-numeric: tabular-nums; }
.carry-gut { flex: none; min-width: 44px; display: flex; justify-content: flex-end; }
.carry-chip { display: inline-flex; align-items: center; gap: 3px; color: var(--carry-fg); background: var(--carry-bg); border: 1px solid var(--carry-border); border-radius: 999px; padding: 1px 7px; font-size: 10.5px; font-weight: 600; font-family: var(--mono); font-variant-numeric: tabular-nums; }
.carry-sum { flex: none; font-size: 11px; color: var(--dim); font-variant-numeric: tabular-nums; }
.dur { flex: none; color: var(--faint); font-size: 11.5px; font-family: var(--mono); min-width: 54px; text-align: right; font-variant-numeric: tabular-nums; }
.dur[data-carried="true"] { font-style: italic; }
.node-actions { flex: none; display: inline-flex; align-items: center; gap: 4px; }
.header-actions { flex: none; display: inline-flex; align-items: center; gap: 4px; }

/* shared floating tooltip: one body-level fixed node (client/tooltip.ts), so
   no overflow container or sticky-header stacking context can clip or cover
   it; opaque INVERTED surface — a tooltip is a layer, not a chip */
.rt-tooltip { position: fixed; top: 0; left: 0; z-index: 99999; display: none; opacity: 0; pointer-events: none; max-width: 300px; overflow-wrap: anywhere; font: 600 11.5px/1.45 var(--sans); padding: 6px 10px; border-radius: 8px; background: var(--tip-bg); color: var(--tip-fg); border: 1px solid var(--tip-border); box-shadow: var(--tip-shadow); transition: opacity .12s ease; }
@media (prefers-reduced-motion: reduce) { .rt-tooltip { transition: none; } }

/* logs popup: one node's Error / Output / Messages, over the tree */
@keyframes ppop { from { opacity: 0; transform: translateX(-50%) translateY(6px) scale(.985); } to { opacity: 1; transform: translateX(-50%); } }
.treewrap { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.scrim { position: absolute; inset: 0; background: var(--scrim); z-index: 8; }
.pop { position: absolute; top: 16px; bottom: 20px; left: 50%; transform: translateX(-50%); width: min(1440px, calc(100% - 48px)); z-index: 9; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 26px 70px rgba(9,12,20,.28), 0 2px 10px rgba(9,12,20,.12); display: flex; flex-direction: column; overflow: hidden; outline: none; animation: ppop 160ms cubic-bezier(.2,.7,.3,1) both; }
@media (prefers-reduced-motion: reduce) { .pop { animation: none; } }
@media (max-width: 640px) { .pop { top: 0; bottom: 0; width: 100%; max-width: 100%; border: none; border-radius: 0; } }
.pop-head { display: flex; align-items: center; gap: 10px; padding: 12px 12px 11px 16px; border-bottom: 1px solid var(--line); }
.pop-badge { width: 22px; height: 22px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; }
.pop-heading { flex: 1; min-width: 0; }
.pop-title { font-size: 13.5px; font-weight: 650; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pop-path { font-size: 11.5px; font-family: var(--mono); color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pop-tools { flex: none; display: flex; gap: 6px; align-items: center; }
.pbtn { background: var(--panel-2); border: 1px solid var(--line); color: var(--dim); border-radius: 9px; padding: 6px 11px; font-size: 12px; font-family: inherit; cursor: pointer; transition: background .13s, color .13s, border-color .13s; }
.pbtn:hover { background: var(--raise); color: var(--fg); }
.pbtn[data-on] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.pbtn-x { padding: 6px 9px; }
.pop-tabs { display: flex; gap: 4px; padding: 8px 14px; background: var(--panel-2); border-bottom: 1px solid var(--line); }
.pop-tab { background: transparent; border: none; color: var(--dim); font-family: inherit; font-size: 12px; font-weight: 500; border-radius: 8px; padding: 5px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.pop-tab:hover { background: var(--raise); }
.pop-tab[data-on] { background: var(--accent); color: var(--accent-ink); font-weight: 650; }
.pop-tab-n { opacity: .6; font-variant-numeric: tabular-nums; }
.pop-body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; background: var(--inset); }
.pop-msg { padding: 14px 16px 0; }
.pop-msg span { font-size: 13px; font-weight: 650; }
.pop-body pre { margin: 0; font-family: var(--mono); font-size: 12px; line-height: 1.65; }
.pop-body pre.stack { padding: 11px 16px 22px; color: var(--dim); white-space: pre; }
.pop-body pre.stack[data-wrap] { white-space: pre-wrap; word-break: break-word; }
.frame[data-kind="internal"] { color: var(--faint); }
.stack-loc { color: var(--ansi-cyan); }
/* merged stdout+stderr: one block, per-line stream tagging */
.out { padding: 12px 16px 22px; }
.out-line { position: relative; padding-left: 12px; font-family: var(--mono); font-size: 12px; line-height: 1.65; color: var(--fg); white-space: pre; }
.out[data-wrap] .out-line { white-space: pre-wrap; word-break: break-word; }
.out-line[data-err]::before { content: ""; position: absolute; left: 0; top: 3px; bottom: 3px; width: 2px; border-radius: 1px; background: var(--st-failed); }
.diag-list { padding: 12px 16px 22px; display: flex; flex-direction: column; gap: 6px; }
.diag-item { font-size: 12.5px; color: var(--fg); display: flex; gap: 9px; align-items: baseline; }
/* huge logs stay smooth: offscreen lines skip layout/paint but remain scrollable (§10b) */
.out-line, .diag-item { content-visibility: auto; contain-intrinsic-size: auto 19px; }
.diag-level { font-size: 9.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; flex: none; border-radius: 5px; padding: 1px 6px; }
.diag-item .txt { font-family: var(--mono); font-size: 12px; white-space: pre; }
.diag-list[data-wrap] .diag-item .txt { white-space: pre-wrap; word-break: break-word; }
.diag-payload { margin-left: 7px; opacity: .68; word-break: break-all; }
.pop-body a { color: var(--st-todo); text-decoration: underline; text-underline-offset: 2px; word-break: break-all; }
.pop-body a:hover { filter: brightness(1.15); }

/* full-tree states */
.state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 13px; padding: 66px 20px; text-align: center; }
.state-icon { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; }
.state-title { font-size: 16px; color: var(--fg); font-weight: 600; }
.state-sub { font-size: 13px; color: var(--faint); max-width: 380px; line-height: 1.6; }
.state-cmd { background: var(--panel-2); border: 1px solid var(--line); color: var(--dim); padding: 9px 14px; border-radius: 10px; font-family: var(--mono); font-size: 12px; max-width: 92%; overflow-x: auto; }
.btn-primary { background: var(--accent); border: none; color: var(--accent-ink); border-radius: 10px; padding: 9px 17px; font-size: 13px; font-weight: 600; cursor: pointer; transition: filter .13s, transform .13s; }
.btn-primary:hover { filter: brightness(1.06); }
.btn-primary:active { transform: scale(.97); }

/* footer */
.footer { flex: none; border-top: 1px solid var(--line); background: var(--panel); padding: 8px 18px; display: flex; align-items: center; gap: 10px; color: var(--faint); font-size: 11px; }
.footer .brand { font-weight: 700; color: var(--dim); }
.legend { margin-left: auto; display: inline-flex; gap: 13px; }
.legend > span { display: inline-flex; gap: 5px; align-items: center; }
.legend .ldot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

/* mobile (~phone widths): reclaim the indent budget, let names wrap, keep
   everything on-screen, and pad tap targets */
@media (max-width: 640px) {
  /* Touch targets win over density: 40px rows at any data-dense setting, so
     this must out-specify the .app[data-dense=…] rules above. */
  .app, .app[data-dense] { --ind: 12px; --rh: 40px; --fs: 13px; --diag-mr: 8px; --diag-gap: 8px; }
  .guide { border-left: none; }
  .tree { padding: 6px 4px 24px; }
  .row { padding: 0 8px; gap: 6px; }
  .name { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
  .dur { min-width: 0; }
  .pills { margin-right: 4px; }
  .caret { width: 20px; align-self: stretch; }
  /* one content column: headline row, breakdown pills, controls, progress bar —
     stacked on a single 12px gutter and spacing step */
  .hdr-row { flex-direction: column; align-items: stretch; gap: 12px; padding: 12px 12px 0; }
  .verdict { align-self: flex-start; }
  .chips { gap: 8px; }
  .tools { margin-left: 0; }
  .search { flex: 1; }
  .search input { width: 100%; min-height: 44px; }
  .tools .btn { min-height: 44px; min-width: 44px; justify-content: center; }
  .hdr-bar-row { padding: 12px 12px; }
  .bar { min-width: 0; }
  .pop-head { flex-wrap: wrap; row-gap: 8px; padding: 10px 12px; }
  .pop-tools { flex: 1 1 100%; justify-content: flex-end; }
  .pbtn { min-height: 34px; }
  .pop-msg { padding: 12px 12px 0; }
  .pop-body pre.stack { padding: 9px 12px 18px; }
  .out, .diag-list { padding: 10px 12px 18px; }
  .logbtn { min-height: 30px; }
  .footer { flex-wrap: wrap; row-gap: 5px; padding: 8px 12px; }
  .legend { margin-left: 0; flex-basis: 100%; flex-wrap: wrap; gap: 5px 12px; }
}
`;
