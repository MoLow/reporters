import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  carriedAttempt, formatDuration, isCarried, todoLabel, type Counts, type TestNode, type TestStatus, type TreeSnapshot,
} from '@reporters/tree-core';
import {
  buildRows, collectContainerKeys, computeMatches, displayName, isContainer, isSectionOpen, liveNodeDuration, reasonOf, realError, type FlatRow, type LiveClock,
} from './rowModel.ts';

// node:test captures colored output verbatim; render the ANSI SGR codes as real
// colors (mapped to the theme's --ansi-* vars) rather than stripping them.
import { AnsiSpan } from './ansi.ts';
import {
  classifyFrame, extractLevel, formatCount, levelSeverity, splitUrls, stripAnsi, type StackLine,
} from './format.ts';
import { parseFilterState, serializeFilterState, type FilterState } from './urlState.ts';

const GLYPH: Record<TestStatus, string> = {
  passed: '✓', failed: '✕', skipped: '⊘', todo: '◇', running: '◐', queued: '○',
};
const STATUS_ORDER: TestStatus[] = ['passed', 'failed', 'skipped', 'todo', 'running', 'queued'];
const STATUS_LABEL: Record<TestStatus, string> = {
  passed: 'passed', failed: 'failed', skipped: 'skipped', todo: 'todo', running: 'running', queued: 'queued',
};

function pct(n: number, total: number): string {
  const tenths = Math.round((n / Math.max(total, 1)) * 1000) / 10;
  return `${tenths % 1 === 0 ? tenths.toFixed(0) : tenths}%`;
}

function chipTip(s: TestStatus, n: number, total: number): string {
  return `${n} ${STATUS_LABEL[s]} · ${pct(n, total)} of the run`;
}

function shortReason(reason: string): string {
  const plain = stripAnsi(reason).replace(/\s+/g, ' ').trim();
  return plain.length > 90 ? `${plain.slice(0, 89)}…` : plain;
}

function statusTip(node: TestNode, status: TestStatus, ms: number): string | undefined {
  const reason = reasonOf(node);
  switch (status) {
    case 'passed': return `Passed in ${formatDuration(ms) || '—'}`;
    case 'failed': return 'Failed';
    case 'skipped': return reason ? `Skipped — ${shortReason(reason)}` : 'Skipped';
    case 'todo': return reason ? `Todo — ${shortReason(reason)}` : 'Todo — does not fail the run';
    case 'queued': return 'Queued — waiting to run';
    default: return undefined;
  }
}

interface OutLine { stream: 'out' | 'err'; text: string; }

interface DiagBlock {
  key: string;
  title: string;
  icon: string;
  sev: TestStatus;
  kind: 'error' | 'output' | 'list' | 'text';
  /** Header count (`Output · 1.9k lines`), also surfaced on the row chip. */
  count?: { n: number; unit: string };
  /** Row-chip text when it should differ from the title (e.g. the trimmed skip reason). */
  chip?: string;
  /** ANSI-stripped plain text for the Copy button. */
  copyText: string;
  message?: string;
  stack?: string;
  text?: string;
  lines?: OutLine[];
  items?: { level: string; sev: TestStatus; text: string }[];
}

/** stdout + stderr merged into one line list, stream-tagged (ANSI kept — the
 *  renderer colors it). */
function outputLines(node: TestNode): OutLine[] {
  const lines: OutLine[] = [];
  const add = (chunks: string[], stream: 'out' | 'err'): void => {
    if (chunks.length === 0) return;
    for (const line of chunks.join('').split('\n')) lines.push({ stream, text: line });
  };
  add(node.stdout, 'out');
  add(node.stderr, 'err');
  while (lines.length > 0 && lines[lines.length - 1].text === '') lines.pop();
  return lines;
}

function linkifyDom(rootEl: HTMLElement): void {
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.parentElement?.closest('a')) textNodes.push(n as Text);
  }
  for (const textNode of textNodes) {
    const segments = splitUrls(textNode.data);
    if (!segments.some((s) => s.kind === 'url')) continue;
    const frag = document.createDocumentFragment();
    for (const seg of segments) {
      if (seg.kind === 'url') {
        const a = document.createElement('a');
        a.href = seg.text;
        a.target = '_blank';
        a.rel = 'noreferrer';
        // Long URLs (presigned links, trace endpoints) would wrap across many
        // lines and bury the message — middle-truncate the label, keep the href.
        a.textContent = seg.text.length > 64 ? `${seg.text.slice(0, 42)}…${seg.text.slice(-18)}` : seg.text;
        if (seg.text.length > 64) a.setAttribute('data-tip', seg.text);
        frag.appendChild(a);
      } else {
        frag.appendChild(document.createTextNode(seg.text));
      }
    }
    textNode.replaceWith(frag);
  }
}

const FrameText = ({ frame }: { frame: StackLine }) => (frame.loc ? (
  <>
    {frame.loc.pre}
    <span className="stack-loc">{frame.loc.location}</span>
    {frame.loc.post}
  </>
) : <>{frame.text === '' ? ' ' : frame.text}</>);

// AnsiSpan plus a DOM post-pass that wraps http(s) URLs in links — post-render
// so ANSI color state stays intact across the link boundary. Lines that look
// like stack frames (also inside log messages) get node-style frame coloring.
// Memoized: a live run re-renders the whole tree 4×/s, and re-rendering a
// rendered log would re-split it and re-run the linkify pass for nothing.
const Ansi = React.memo(({ text }: { text: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (ref.current) linkifyDom(ref.current); });
  return (
    <span ref={ref}>
      {text.split('\n').map((line, i) => {
        const frame = classifyFrame(line);
        return (
          // eslint-disable-next-line react/no-array-index-key
          <React.Fragment key={i}>
            {i > 0 ? '\n' : null}
            {frame ? (
              <span className="frame" data-kind={frame.kind}><FrameText frame={frame} /></span>
            ) : <AnsiSpan text={line} />}
          </React.Fragment>
        );
      })}
    </span>
  );
});

function Stack({ stack }: { stack: string }) {
  return (
    <pre className="stack"><Ansi text={stack} /></pre>
  );
}

// At most three sections per test — Error, Output, Diagnostics (plus a reason
// for skipped/todo). stdout+stderr collapse into one Output block; text keeps
// its ANSI (colored at render); synthetic container rollups never render an Error.
function computeDiagBlocks(node: TestNode): DiagBlock[] {
  const blocks: DiagBlock[] = [];
  const error = realError(node);
  if (error) {
    const stack = error.stack ?? error.message;
    blocks.push({
      key: 'error', title: 'Error', icon: '✕', sev: 'failed', kind: 'error',
      message: error.message, stack, copyText: stripAnsi(stack),
    });
  }
  const lines = outputLines(node);
  if (lines.length > 0) {
    blocks.push({
      key: 'output', title: 'Output', icon: '›', sev: 'skipped', kind: 'output', lines,
      count: { n: lines.length, unit: lines.length === 1 ? 'line' : 'lines' },
      copyText: stripAnsi(lines.map((l) => l.text).join('\n')),
    });
  }
  if (node.diagnostics.length > 0) {
    const items = node.diagnostics.map((d) => {
      const level = extractLevel(d.message) ?? d.level;
      return { level, sev: levelSeverity(level), text: d.message };
    });
    const sev: TestStatus = items.some((i) => i.sev === 'failed') ? 'failed'
      : items.some((i) => i.sev === 'running') ? 'running' : 'skipped';
    blocks.push({
      key: 'diag', title: 'Diagnostics', icon: '◇', sev, kind: 'list', items,
      copyText: stripAnsi(node.diagnostics.map((d) => d.message).join('\n')),
    });
  }
  const reason = reasonOf(node);
  if (reason) {
    const plain = stripAnsi(reason).replace(/\s+/g, ' ').trim();
    const label = `${node.status === 'skipped' ? 'Skipped' : 'Todo'}: ${plain}`;
    blocks.push({
      key: 'reason', title: node.status === 'skipped' ? 'why skipped' : 'why todo',
      chip: label.length > 40 ? `${label.slice(0, 39)}…` : label,
      icon: '⊘', sev: 'skipped', kind: 'text', text: reason, copyText: stripAnsi(reason),
    });
  }
  return blocks;
}

// Blocks are needed by both the row chips and the open panel; splitting a huge
// log into lines twice per render would hurt, so cache per snapshot node.
const blocksCache = new WeakMap<TestNode, DiagBlock[]>();
function diagBlocks(node: TestNode): DiagBlock[] {
  let blocks = blocksCache.get(node);
  if (!blocks) { blocks = computeDiagBlocks(node); blocksCache.set(node, blocks); }
  return blocks;
}

function computeTheme(): 'dark' | 'light' {
  try {
    const forced = new URLSearchParams(window.location.search).get('theme');
    if (forced === 'dark' || forced === 'light') return forced;
  } catch { /* location may be unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function currentSearch(): string {
  try { return window.location.search; } catch { return ''; }
}

/** Shareable filter state: `?q`, `?status` and `?rerun` mirror the search box,
 *  status chips and Only re-run. Discrete toggles push a history entry
 *  immediately, typing debounces into one entry, and Back/Forward restore the
 *  previous filters. */
function useUrlFilters() {
  const [query, setQuery] = useState(() => parseFilterState(currentSearch()).query);
  const [statuses, setStatuses] = useState<ReadonlySet<TestStatus>>(() => parseFilterState(currentSearch()).statuses);
  const [onlyRerun, setOnlyRerun] = useState(() => parseFilterState(currentSearch()).onlyRerun);
  const state: FilterState = { query, statuses, onlyRerun };
  const stateRef = useRef(state);
  stateRef.current = state;
  const sync = () => {
    const search = currentSearch();
    const next = serializeFilterState(stateRef.current, search);
    // Compare canonical forms so encoding quirks (%20 vs +) never push.
    if (next === serializeFilterState(parseFilterState(search), search)) return;
    try {
      window.history.pushState(null, '', `${window.location.pathname}${next}${window.location.hash}`);
    } catch { /* history may be unavailable (sandboxed iframe) */ }
  };
  useEffect(sync, [statuses, onlyRerun]);
  useEffect(() => {
    const id = setTimeout(sync, 400);
    return () => clearTimeout(id);
  }, [query]);
  useEffect(() => {
    const onPop = () => {
      const s = parseFilterState(currentSearch());
      setQuery(s.query);
      setStatuses(s.statuses);
      setOnlyRerun(s.onlyRerun);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return {
    query, setQuery, statuses, setStatuses, onlyRerun, setOnlyRerun,
  };
}

function useTheme(): ['dark' | 'light', () => void] {
  const [theme, setTheme] = useState<'dark' | 'light'>(computeTheme);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return [theme, toggle];
}

const ThemeIcon = ({ theme }: { theme: 'dark' | 'light' }) => (theme === 'dark' ? (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
) : (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8" strokeLinecap="round" />
  </svg>
));

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.5" y2="16.5" />
  </svg>
);

const CarryIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 2.6-6.4" />
    <path d="M3 4v5h5" />
  </svg>
);

function BlockContent({ block }: { block: DiagBlock }) {
  return (
    <>
      {block.kind === 'error' ? (
        <>
          <div className="diag-msg" data-stc="failed"><Ansi text={block.message!} /></div>
          <Stack stack={block.stack!} />
        </>
      ) : null}
      {block.kind === 'output' ? (
        <div className="out">
          {block.lines!.map((line, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div className="out-line" data-err={line.stream === 'err' ? 'true' : undefined} key={i}>
              <Ansi text={line.text === '' ? ' ' : line.text} />
            </div>
          ))}
        </div>
      ) : null}
      {block.kind === 'text' ? (
        <pre className="text"><Ansi text={block.text!} /></pre>
      ) : null}
      {block.kind === 'list' ? (
        <div className="diag-list">
          {block.items!.map((item, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div className="diag-item" key={i}>
              <span className="diag-level" data-soft={item.sev}>{item.level}</span>
              <span className="txt"><Ansi text={item.text} /></span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <button type="button" className="hbtn" onClick={copy} data-tip="Copy to clipboard" aria-label="Copy to clipboard">
      {copied ? '✓' : '⧉'}
      <span className="hbtn-label">{copied ? ' Copied' : ' Copy'}</span>
    </button>
  );
}

/** One section: sticky header with controls above the capped scroll region
 *  (§10a). A settled log opens at the top — logs read top-to-bottom; only a
 *  still-running log tail-follows, and stops the moment the reader scrolls up
 *  or the test settles (§11a). */
/** One boxed panel section (design demo): its header is the disclosure for
 *  just this section — caret + name on the left, the toolbar on the right —
 *  and the capped log body collapses beneath it. */
function DiagSection({
  block, node, open, onToggle,
}: {
  block: DiagBlock; node: TestNode; open: boolean; onToggle: () => void;
}) {
  const [modal, setModal] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  // Lazy-mount the body, but keep it once opened so collapse animates and
  // scroll survives.
  const everOpen = useRef(open);
  if (open) everOpen.current = true;
  const running = node.status === 'running';
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !running || !open) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (!pinned.current || nearBottom) { el.scrollTop = el.scrollHeight; pinned.current = true; }
  });
  const jump = (toEnd: boolean) => {
    const el = bodyRef.current;
    if (el) el.scrollTop = toEnd ? el.scrollHeight : 0;
  };
  const long = (block.lines?.length ?? block.items?.length ?? 0) > 20;
  return (
    <div className="diag-sec" data-open={open ? 'true' : undefined}>
      <span className="diag-bar" data-stf={block.sev} />
      <div className="diag-body">
        <div
          className="diag-head"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} ${block.title.toLowerCase()} of ${displayName(node)}`}
          onClick={() => { if (!selectionClick()) onToggle(); }}
          onMouseDown={markPointerFocus}
          onBlur={clearPointerFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
            else if (e.key === 'ArrowRight' && !open) { e.preventDefault(); onToggle(); }
            else if (e.key === 'ArrowLeft' && open) { e.preventDefault(); onToggle(); }
          }}
        >
          <span className="caret" data-open={open ? 'true' : undefined}>▸</span>
          <span className="diag-icon" data-stc={block.sev}>{block.icon}</span>
          <span className="diag-title">{block.chip ?? block.title}</span>
          {block.count ? <span className="diag-count">· {formatCount(block.count.n)} {block.count.unit}</span> : null}
          <div
            className="diag-tools"
            // Toolbar clicks act on the section, never toggle it.
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
            onClick={(e) => e.stopPropagation()}
          >
            {open && long ? (
              <>
                <button type="button" className="hbtn" onClick={() => jump(false)} data-tip="Jump to top" aria-label="Jump to top">⤒</button>
                <button type="button" className="hbtn" onClick={() => jump(true)} data-tip="Jump to end" aria-label="Jump to end">⤓</button>
              </>
            ) : null}
            <CopyButton text={block.copyText} />
            <button type="button" className="hbtn" onClick={() => setModal(true)} data-tip="Open full log" aria-label="Open full log">⤢<span className="hbtn-label"> Full log</span></button>
            {open ? (
              <button type="button" className="hbtn hbtn-collapse" onClick={onToggle} data-tip="Collapse this section">Collapse</button>
            ) : null}
          </div>
        </div>
        <div className={`collapsible${open ? ' open' : ''}`}>
          <div className="inner">
            {everOpen.current ? (
              <div className="log-body" ref={bodyRef}><BlockContent block={block} /></div>
            ) : null}
          </div>
        </div>
      </div>
      {modal ? (
        <LogModal title={`${block.title} — ${displayName(node)}`} block={block} onClose={() => setModal(false)} />
      ) : null}
    </div>
  );
}

function LogModal({ title, block, onClose }: { title: string; block: DiagBlock; onClose: () => void }) {
  // Lines stay whole by default — the modal exists for room; wrapping is opt-in
  // (§11b) — except on a phone, where horizontal-scrolling a stack trace is
  // worse than wrapped lines, so Wrap starts on.
  const [wrap, setWrap] = useState(() => window.matchMedia?.('(max-width: 640px)').matches ?? false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    boxRef.current?.focus();
    return () => prev?.focus?.();
  }, []);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const focusables = boxRef.current?.querySelectorAll<HTMLElement>('button, a[href], input');
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal${wrap ? ' wrap' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={boxRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="modal-head">
          <span className="diag-icon" data-stc={block.sev}>{block.icon}</span>
          <span className="modal-title">{title}</span>
          {block.count ? <span className="diag-count">{formatCount(block.count.n)} {block.count.unit}</span> : null}
          <div className="diag-tools">
            <CopyButton text={block.copyText} />
            <button type="button" className="hbtn" data-on={wrap ? 'true' : undefined} onClick={() => setWrap(!wrap)} data-tip="Toggle line wrapping">Wrap</button>
            <button type="button" className="hbtn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="modal-body"><BlockContent block={block} /></div>
      </div>
    </div>
  );
}

/** A node's own-output region (design demo): a stack of boxed, independently
 *  collapsible panel sections — a panel, never a tree node. */
function OutputPanel({
  row, overrides, toggle, enter,
}: {
  row: FlatRow;
  overrides: Map<string, boolean>;
  toggle: (key: string, current: boolean) => void;
  enter: number | null;
}) {
  const { node, depth } = row;
  const blocks = diagBlocks(node);
  const style: React.CSSProperties = {
    margin: `4px var(--diag-mr) 7px calc(${depth} * var(--ind) + var(--diag-gap))`,
    ...(enter !== null ? { animationDelay: `${Math.min(enter, 8) * 18}ms` } : {}),
  };
  return (
    <div
      className={`diag${enter !== null ? ' row-enter' : ''}`}
      role="group"
      aria-label={`Output of ${displayName(node)}`}
      style={style}
    >
      {blocks.map((block) => (
        <DiagSection
          block={block}
          node={node}
          open={isSectionOpen(node, block.key, overrides)}
          onToggle={() => toggle(`${node.key}::diag:${block.key}`, isSectionOpen(node, block.key, overrides))}
          key={block.key}
        />
      ))}
    </div>
  );
}

/** True for a beat after a node settles out of `running`, to fire a settle pop. */
function useSettle(status: TestStatus): boolean {
  const prev = useRef(status);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (prev.current === 'running' && status !== 'running') {
      setSettled(true);
      const timer = setTimeout(() => setSettled(false), 500);
      prev.current = status;
      return () => clearTimeout(timer);
    }
    prev.current = status;
    return undefined;
  }, [status]);
  return settled;
}

const trimTag = (s: string): string => (s.length > 32 ? `${s.slice(0, 31)}…` : s);

/** Focus that arrived from a pointer press gets tagged so CSS can skip the
 *  ring (Safari matches :focus-visible on clicked tabindex elements); we
 *  can't preventDefault the mousedown instead — that blocks text selection. */
const markPointerFocus = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.dataset.pointer = 'true'; };
const clearPointerFocus = (e: React.FocusEvent<HTMLElement>) => { delete e.currentTarget.dataset.pointer; };

/** A click that ends a text-selection drag shouldn't also fire the row's
 *  toggle — the toggle would reflow the tree and destroy the selection. */
const selectionClick = (): boolean => {
  const sel = window.getSelection();
  return sel != null && !sel.isCollapsed && sel.toString() !== '';
};

/** Stable identity for enter-animation bookkeeping and React keys — a node row
 *  and its nested output row share a node but are distinct rows. */
const rowKey = (row: FlatRow): string => (row.kind === 'output' ? `${row.node.key}::out` : row.node.key);

/** Embedder hook: render custom trailing content (e.g. action buttons) for a
 *  tree row. Called for every node — containers and tests alike — on every
 *  render, so it must be cheap; return null to render nothing for a node. */
export type RenderNodeActions = (node: TestNode) => React.ReactNode;

/** Embedder hook: render custom content in the header toolbar, after the
 *  built-in buttons. Called on every render, so it must be cheap. */
export type RenderHeaderActions = () => React.ReactNode;

interface RowViewProps {
  row: FlatRow;
  toggle: (key: string, current: boolean) => void;
  /** Stagger index for the enter animation, or null when the row shouldn't animate in. */
  enter: number | null;
  /** Shared clock (performance.now) + per-node running-start map, for live duration ticking. */
  now: number;
  since: Map<string, number>;
  /** The stream's stamp clock, when the log carries writer stamps. */
  clock: LiveClock | null;
  /** The run has carried tests — reserve the attempt gutter on every row. */
  carriedRun: boolean;
  /** The only-re-run filter is active (collapsed pills show re-run counts). */
  onlyRerun: boolean;
  renderNodeActions?: RenderNodeActions;
}

function RowView({
  row, toggle, enter, now, since, clock, carriedRun, onlyRerun, renderNodeActions,
}: RowViewProps) {
  const {
    node, depth, status, expandable, expanded, hasDiag,
  } = row;
  const settled = useSettle(status);
  // One disclosure per row: expanding reveals the node's region (its own
  // output header first, then children). Same gesture for every node type.
  const activate = () => { if (expandable) toggle(node.key, expanded); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    else if (e.key === 'ArrowRight' && expandable && !expanded) { e.preventDefault(); activate(); }
    else if (e.key === 'ArrowLeft' && expandable && expanded) { e.preventDefault(); activate(); }
  };

  const counts = node.counts;
  const isTest = node.type === 'test';
  const container = isContainer(node);
  const nameColor = isTest && status === 'failed' ? 'var(--st-failed)'
    : isTest && (status === 'skipped' || status === 'todo' || status === 'queued') ? 'var(--dim)'
      : 'var(--fg)';
  const carried = isTest && !container && node.passedOnAttempt != null;
  const rollupMark = container && isCarried(node);
  const markAttempt = carried ? node.passedOnAttempt : rollupMark ? carriedAttempt(node) : undefined;
  const carryTip = carried
    ? `Carried from attempt ${node.passedOnAttempt! + 1} · not executed this run`
    : rollupMark
      ? `All ${counts.carried} tests carried${markAttempt != null ? ` from attempt ${markAttempt + 1}` : ''} · not run this attempt`
      : undefined;

  const rowClass = `row${enter !== null ? ' row-enter' : ''}${settled ? ` settle-${status}` : ''}`;
  const rowStyle = enter !== null ? { animationDelay: `${Math.min(enter, 8) * 18}ms` } : undefined;
  const hasError = hasDiag && diagBlocks(node).some((b) => b.key === 'error');
  const ms = liveNodeDuration(node, now, since, clock);
  const durTip = carried || rollupMark
    ? `${formatDuration(ms) || '—'} — measured on ${markAttempt != null ? `attempt ${markAttempt + 1}` : 'an earlier attempt'}`
    : status !== 'running' && ms >= 1000 ? `${Math.round(ms).toLocaleString('en-US')} ms` : undefined;

  return (
    <div
      className={rowClass}
      style={rowStyle}
      role="treeitem"
      aria-expanded={expandable ? expanded : undefined}
      aria-label={`${displayName(node)}, ${status}${container ? `, ${counts.total} tests` : ''}`}
      tabIndex={0}
      data-clickable={expandable}
      data-fail={isTest && status === 'failed'}
      data-running={status === 'running' ? 'true' : undefined}
      onClick={expandable ? () => { if (!selectionClick()) activate(); } : undefined}
      onMouseDown={markPointerFocus}
      onBlur={clearPointerFocus}
      onKeyDown={onKeyDown}
    >
      <span className="guides">
        {Array.from({ length: depth }, (_, i) => <span className="guide" key={i} />)}
      </span>
      <span className="caret" data-open={expandable && expanded ? 'true' : undefined}>{expandable ? '▸' : ''}</span>
      {isTest && status === 'running' ? (
        <span className="spinner indicator" />
      ) : (
        // One visual language for pass/fail at every level: containers and leaf
        // tests both use the status glyph (design mobile-review ruling).
        <span className="cglyph indicator" data-stc={status} data-spin={!isTest && status === 'running' ? 'true' : undefined} data-tip={!container ? statusTip(node, status, ms) : undefined}>{GLYPH[status]}</span>
      )}
      <span className="name" data-kind={node.type} data-tip-clipped={node.type === 'file' ? node.file ?? displayName(node) : displayName(node)} style={{ color: nameColor }}>{displayName(node)}</span>
      {hasDiag ? (
        // Passive badge (never a control): output exists inside this node.
        <span className="outbadge" data-stc={hasError ? 'failed' : undefined} data-tip={hasError ? 'Has error output — expand the row to view' : 'Has output — expand the row to view'}>
          {hasError ? '✕' : '◇'}
        </span>
      ) : null}
      {todoLabel(node) ? (
        <span className="todotag" data-soft="todo"># {trimTag(todoLabel(node)!)}</span>
      ) : typeof node.skip === 'string' && node.skip ? (
        <span className="todotag" data-soft="skipped">⊘ {trimTag(node.skip)}</span>
      ) : null}
      <span className="spacer" />
      {renderNodeActions ? (
        // Custom content is interactive on its own terms: clicks and keys
        // inside must never toggle the row's disclosure.
        <span
          className="node-actions"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {renderNodeActions(node)}
        </span>
      ) : null}
      {container && !expanded ? (
        <span className="pills">
          {STATUS_ORDER.filter((s) => (s === 'passed' && onlyRerun ? counts.passed - counts.carried : counts[s]) > 0).map((s) => (
            <span className="pill" data-soft={s} data-tip={`${s === 'passed' && onlyRerun ? counts.passed - counts.carried : counts[s]} ${STATUS_LABEL[s]}`} key={s}>{s === 'passed' && onlyRerun ? counts.passed - counts.carried : counts[s]}</span>
          ))}
        </span>
      ) : null}
      {carriedRun ? (
        <span className="carry-gut">
          {carryTip ? (
            <span className="carry-chip" data-tip={carryTip} aria-label={carryTip} tabIndex={0}>
              <CarryIcon />
              {markAttempt != null ? markAttempt + 1 : null}
            </span>
          ) : null}
        </span>
      ) : null}
      <span className="dur" data-carried={carried || rollupMark ? 'true' : undefined} data-tip={durTip}>{formatDuration(ms) || '—'}</span>
    </div>
  );
}

function Verdict({ counts, inProgress, duration }: { counts: Counts; inProgress: boolean; duration: number }) {
  const status: TestStatus = inProgress ? 'running' : counts.failed > 0 ? 'failed' : 'passed';
  const label = inProgress ? 'Running' : counts.failed > 0 ? 'Failing' : 'Passing';
  const tip = `${counts.total} ${counts.total === 1 ? 'test' : 'tests'} · ${inProgress ? 'running for' : 'finished in'} ${formatDuration(duration) || '—'}`;
  return (
    <div className="verdict" data-soft={status} data-tip={tip} tabIndex={0}>
      <span className="verdict-glyph" data-spin={inProgress ? 'true' : undefined}>{GLYPH[status]}</span>
      <div className="verdict-text">
        <span className="verdict-main">{label}</span>
        <span className="verdict-sub">
          {counts.total}
          {counts.total === 1 ? ' test' : ' tests'}
          {' · '}
          {formatDuration(duration) || '—'}
        </span>
      </div>
    </div>
  );
}

function CenteredState({
  icon, iconStatus, pulse, spin, title, children,
}: {
  icon: string; iconStatus: TestStatus; pulse?: boolean; spin?: boolean; title: string; children?: React.ReactNode;
}) {
  return (
    <div className="state">
      <div className="state-icon" data-soft={iconStatus} data-pulse={pulse ? 'true' : undefined}>
        {spin ? <span data-spin="true">{icon}</span> : icon}
      </div>
      <div className="state-title">{title}</div>
      {children}
    </div>
  );
}

export interface TreeViewProps {
  snapshot: TreeSnapshot;
  /** The viewer is still polling a live log (no final summary yet). */
  streaming?: boolean;
  /** The first fetch of the log hasn't resolved yet — we don't know if there are results. */
  pending?: boolean;
  /** The viewer's `?src=` is missing or unreachable. */
  loadError?: boolean;
  onRetry?: () => void;
  /** Render custom trailing content at the end of every tree row. */
  renderNodeActions?: RenderNodeActions;
  /** Render custom content at the end of the header toolbar. */
  renderHeaderActions?: RenderHeaderActions;
}

export function TreeView({
  snapshot, streaming = false, pending = false, loadError = false, onRetry, renderNodeActions, renderHeaderActions,
}: TreeViewProps) {
  const [theme, toggleTheme] = useTheme();
  // Filters live in the URL (?q, ?status, ?rerun) so a copied link shares the
  // same view; statuses empty = unfiltered.
  const {
    query, setQuery, statuses, setStatuses, onlyRerun, setOnlyRerun,
  } = useUrlFilters();
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const toggleStatus = (s: TestStatus) => {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };
  // Rows already painted at least once — so we only play the enter animation for
  // rows that newly arrive during a live run, never on every re-render.
  const seenRef = useRef<Set<string>>(new Set());
  // Client clock (performance.now) at which each node was first seen running —
  // the live-tick fallback for streams without writer stamps.
  const sinceRef = useRef<Map<string, number>>(new Map());
  // The newest writer stamp and when it arrived, for stamped streams.
  const clockRef = useRef<LiveClock | null>(null);
  // A steadily-incrementing tick that drives live duration re-renders.
  const [, setTick] = useState(0);

  const files = snapshot.root.children;
  const { counts } = snapshot;
  const q = query.trim().toLowerCase();
  const carriedRun = counts.carried > 0;
  const freshCount = counts.total - counts.carried;
  const runAttempt = snapshot.attempt;
  const summaryAttempt = carriedRun ? carriedAttempt(snapshot.root) : undefined;

  const matches = useMemo(
    () => (q || statuses.size > 0 || onlyRerun ? computeMatches(files, q, statuses, onlyRerun) : null),
    [files, q, statuses, onlyRerun],
  );
  const rows = useMemo(
    () => buildRows(files, {
      overrides, query: q, statuses, matches, onlyRerun,
    }),
    [files, overrides, q, statuses, matches, onlyRerun],
  );

  const toggle = (key: string, current: boolean) => {
    setOverrides((prev) => new Map(prev).set(key, !current));
  };
  const [allCollapsed, setAllCollapsed] = useState(false);
  // Logs live inside rows now, so collapsing rows inherently hides them —
  // one hierarchy, one unambiguous collapse (revised design ruling).
  const toggleAll = () => {
    const keys: string[] = [];
    collectContainerKeys(files, keys);
    const expand = allCollapsed; // currently collapsed -> expand; else collapse
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const key of keys) next.set(key, expand);
      return next;
    });
    setAllCollapsed(!allCollapsed);
  };

  const inProgress = !snapshot.summary && (streaming || counts.running > 0 || counts.queued > 0);
  // Tick a few times a second while anything is running so running durations
  // advance live instead of freezing between polls.
  useEffect(() => {
    if (!inProgress) return undefined;
    const id = setInterval(() => setTick((n) => (n + 1) % 1e6), 250);
    return () => clearInterval(id);
  }, [inProgress]);
  const now = performance.now();
  const since = sinceRef.current;
  // Fix the stream's stamp clock to the client clock each time a newer stamp
  // arrives; between polls the pair projects the writer's "now" so counters
  // tick smoothly without ever measuring against the client's own timeline.
  if (snapshot.clock && snapshot.clock.lastT !== clockRef.current?.lastT) {
    clockRef.current = { lastT: snapshot.clock.lastT, receivedAt: now };
  }
  const clock = clockRef.current;
  // The run summary carries the real wall-clock; while still running, the
  // stream's stamp range IS the run's elapsed time — first stamp to the
  // projected "now" (stamp-less logs fall back to aggregating files, which
  // ticks with the run). Project past the last stamp only while something is
  // running, so the header ticks exactly when some row ticks: a stream that
  // dies idle freezes at its last stamp. One that dies mid-test keeps ticking
  // with its running rows — from the client there is no telling that apart
  // from a long quiet test. The freeze during a zero-running gap (isolation
  // spawning the next file) lasts a process spawn and reads as a pause.
  const headerLead = counts.running > 0 && clock ? now - clock.receivedAt : 0;
  const duration = snapshot.summary?.durationMs
    ?? (snapshot.clock && clock ? clock.lastT + headerLead - snapshot.clock.firstT
      : liveNodeDuration(snapshot.root, now, since, clock));

  // Enter-animation bookkeeping: play only for rows first seen during a live run,
  // staggered within each file so a file "unfurls" rather than popping as a slab.
  const enterMap = new Map<string, number>();
  {
    const seen = seenRef.current;
    let stagger = 0;
    for (const row of rows) {
      if (row.node.type === 'file') stagger = 0;
      const key = rowKey(row);
      const firstSeen = !seen.has(key);
      seen.add(key);
      if (firstSeen && inProgress) { enterMap.set(key, stagger); stagger += 1; }
    }
  }

  if (loadError) {
    return (
      <div className="app">
        <CenteredState icon="⚠" iconStatus="failed" title="Couldn’t load the live log">
          <div className="state-sub">
            The viewer needs a <code style={{ fontFamily: 'var(--mono)', color: 'var(--st-todo)' }}>?src=</code>
            {' '}that points at a reachable test log. It’s missing or the URL didn’t respond.
          </div>
          <code className="state-cmd">
            {window.location.origin + window.location.pathname}
            <span data-stc="todo">?src=https://ci.example/run-8821.ndjson</span>
          </code>
          {onRetry ? <button type="button" className="btn-primary" onClick={onRetry}>Retry</button> : null}
        </CenteredState>
      </div>
    );
  }

  const statChips = STATUS_ORDER.filter((s) => s === 'passed' || s === 'failed' || counts[s] > 0);
  const total = Math.max(counts.total, 1);
  const barSegments = STATUS_ORDER.filter((s) => counts[s] > 0);

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-row">
          <Verdict counts={counts} inProgress={inProgress} duration={duration} />
          <div className="chips">
            {statChips.map((s) => (
              <button
                type="button"
                className="chip"
                data-soft={s}
                data-active={statuses.has(s) ? 'true' : undefined}
                aria-pressed={statuses.has(s)}
                data-tip={statuses.has(s) ? `Stop filtering by ${STATUS_LABEL[s]}` : chipTip(s, counts[s], counts.total)}
                onClick={() => toggleStatus(s)}
                key={s}
              >
                <span className="chip-dot" data-stf={s} />
                {counts[s]}
                <span className="chip-label">{STATUS_LABEL[s]}</span>
              </button>
            ))}
          </div>
          {carriedRun ? (
            <span className="carry-sum">
              {runAttempt != null ? `attempt ${runAttempt + 1} of ${runAttempt + 1} · ` : ''}
              {freshCount} re-run · {counts.carried} carried{summaryAttempt != null ? ` from attempt ${summaryAttempt + 1}` : ''}
            </span>
          ) : null}
          <div className="tools">
            <div className="search">
              <SearchIcon />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter tests"
                aria-label="Filter tests"
              />
            </div>
            {carriedRun ? (
              <button
                type="button"
                className="btn"
                data-on={onlyRerun ? 'true' : undefined}
                aria-pressed={onlyRerun}
                onClick={() => setOnlyRerun(!onlyRerun)}
                data-tip={onlyRerun ? 'Show carried-over tests again' : 'Show only tests that actually executed this attempt'}
              >
                Only re-run
              </button>
            ) : null}
            <button
              type="button"
              className="btn"
              onClick={toggleTheme}
              data-tip={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <ThemeIcon theme={theme} />
            </button>
            <button
              type="button"
              className="btn"
              onClick={toggleAll}
              data-tip={allCollapsed ? 'Expand every file and suite' : 'Collapse every file and suite'}
            >
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
            {renderHeaderActions ? (
              <span className="header-actions">{renderHeaderActions()}</span>
            ) : null}
          </div>
        </div>
        <div className="hdr-bar-row">
          <div className="bar">
            {barSegments.map((s) => (
              // Proportional flex-grow over a 6px basis: a 2-test sliver stays a
              // visible, hoverable segment instead of a sub-pixel line.
              <span
                key={s}
                data-stf={s}
                data-pulse={s === 'running' ? 'true' : undefined}
                data-tip={`${counts[s]} ${STATUS_LABEL[s]} · ${pct(counts[s], total)}`}
                aria-label={`${counts[s]} ${STATUS_LABEL[s]}`}
                style={{ flex: `${counts[s] / total} 0 6px` }}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="tree" role="tree" aria-label="Test results">
        {rows.length > 0 ? (
          rows.map((row) => (row.kind === 'output' ? (
            <OutputPanel
              key={rowKey(row)}
              row={row}
              overrides={overrides}
              toggle={toggle}
              enter={enterMap.has(rowKey(row)) ? enterMap.get(rowKey(row))! : null}
            />
          ) : (
            <RowView
              key={rowKey(row)}
              row={row}
              toggle={toggle}
              enter={enterMap.has(rowKey(row)) ? enterMap.get(rowKey(row))! : null}
              now={now}
              since={since}
              clock={clock}
              carriedRun={carriedRun}
              onlyRerun={onlyRerun}
              renderNodeActions={renderNodeActions}
            />
          )))
        ) : pending ? (
          <CenteredState icon="◐" iconStatus="running" spin title="Loading test log…" />
        ) : q || statuses.size > 0 || onlyRerun ? (
          <CenteredState
            icon="⌕"
            iconStatus="skipped"
            title={q ? `No tests match “${query.trim()}”` : 'No tests match the active filters'}
          >
            <div className="state-sub">
              {q ? 'Try a shorter query, or search by file name.'
                : statuses.size > 0 ? 'No test has any of the selected statuses.'
                  : 'Every test was carried over — nothing executed this attempt.'}
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => { setQuery(''); setStatuses(new Set()); setOnlyRerun(false); }}
            >
              Clear filters
            </button>
          </CenteredState>
        ) : (
          <CenteredState icon="◴" iconStatus="queued" pulse title="Waiting for the first results">
            <div className="state-sub">
              No test files have reported yet. Results stream in file-by-file as the run progresses.
            </div>
            <code className="state-cmd">node --test --test-reporter @reporters/web</code>
          </CenteredState>
        )}
      </div>

      <footer className="footer">
        <span className="brand">@reporters/web</span>
        <span>·</span>
        <span>
          {pending ? 'Loading…'
            : inProgress ? 'Live · streaming results'
              : snapshot.summary ? 'Run complete'
                : rows.length === 0 ? 'Awaiting run' : 'Run complete'}
        </span>
        <span className="legend">
          {STATUS_ORDER.map((s) => (
            <span key={s}><span className="ldot" data-stf={s} />{s}</span>
          ))}
        </span>
      </footer>
    </div>
  );
}
