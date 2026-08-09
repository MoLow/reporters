import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  carriedAttempt, formatDuration, formatLogPayload, isCarried, todoLabel, type Counts, type TestNode, type TestStatus, type TreeSnapshot,
} from '@reporters/tree-core';
import {
  buildRows, collectContainerKeys, computeMatches, displayName, findNode, hasFailChip, isCancelled, isContainer, liveNodeDuration, logCount, outputLines, reasonOf, realError, rollup, type FlatRow, type LiveClock, type OutLine,
} from './rowModel.ts';

// node:test captures colored output verbatim; render the ANSI SGR codes as real
// colors (mapped to the theme's --ansi-* vars) rather than stripping them.
import { AnsiSpan } from './ansi.ts';
import {
  classifyFrame, extractLevel, formatCount, levelSeverity, splitUrls, stripAnsi, type StackLine,
} from './format.ts';
import { urlFilterState, type FilterState, type FilterStore } from './urlState.ts';

const GLYPH: Record<TestStatus, string> = {
  passed: '✓', failed: '✕', skipped: '⊘', todo: '◇', running: '◐', queued: '○',
};
/** Shown in place of ✕ for a failure the runner recorded because the test never
 *  ran (see `isCancelled`). Not a status of its own — such a node stays failed. */
const CANCEL_GLYPH = '⊗';
export type Density = 'compact' | 'cozy';
/** Popup tabs, in fallback order: a node with no error opens on Output. */
type TabKey = 'error' | 'output' | 'diag';
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
    case 'failed': return isCancelled(node) ? 'Cancelled — did not run before its parent finished' : 'Failed';
    case 'skipped': return reason ? `Skipped — ${shortReason(reason)}` : 'Skipped';
    case 'todo': return reason ? `Todo — ${shortReason(reason)}` : 'Todo — does not fail the run';
    case 'queued': return 'Queued — waiting to run';
    default: return undefined;
  }
}

/** One tab of the logs popup. `count` is what the tab strip shows, and the
 *  three of them sum to the row button's count by construction. */
interface LogTab {
  key: TabKey;
  label: string;
  count: number;
  /** ANSI-stripped plain text for Copy. */
  copyText: string;
  message?: string;
  stack?: string;
  lines?: OutLine[];
  items?: { level: string; sev: TestStatus; text: string; payload?: string }[];
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

/**
 * The stack minus its "Name: message" preamble. Node builds `err.stack` by
 * prefixing the message to the frames, so rendering the headline and the stack
 * verbatim says the same sentence twice — the duplication that made the old
 * error card twice as tall as it needed to be. Only the preamble goes, and only
 * when frames remain to show; anything that isn't recognisably the message is
 * left exactly as it arrived.
 */
function stackBody(stack: string, message: string): string {
  const lines = stack.split('\n');
  const firstFrame = lines.findIndex((l) => /^\s+at\s/.test(l));
  const plain = stripAnsi(message).trim();
  if (firstFrame > 0 && stripAnsi(lines.slice(0, firstFrame).join('\n')).trim().endsWith(plain)) {
    return lines.slice(firstFrame).join('\n');
  }
  // No frames at all (a synthetic error whose "stack" is just its message):
  // the headline already said it.
  return stripAnsi(stack).trim() === plain ? '' : stack;
}

// Three tabs at most — Error, Output, Messages — in that order, which is also
// the order the popup falls back through. A tab with nothing in it is not
// rendered at all. The skip/todo reason is not here: it lives on the row chip.
function computeLogTabs(node: TestNode): LogTab[] {
  const tabs: LogTab[] = [];
  const error = realError(node);
  if (error) {
    const stack = error.stack ?? '';
    tabs.push({
      key: 'error',
      label: 'Error',
      count: 1,
      message: error.message,
      stack: stack === '' ? '' : stackBody(stack, error.message),
      // Copy hands over the whole error as the runner wrote it, preamble included.
      copyText: stripAnsi(stack === '' ? error.message : stack),
    });
  }
  const lines = outputLines(node);
  if (lines.length > 0) {
    tabs.push({
      key: 'output', label: 'Output', count: lines.length, lines,
      copyText: stripAnsi(lines.map((l) => l.text).join('\n')),
    });
  }
  if (node.messages.length > 0) {
    // Diagnostics and logs share one tab in arrival order — which is execution
    // order, since logs arrive live while diagnostics arrive buffered.
    const items = node.messages.map((m) => {
      const level = extractLevel(m.message) ?? m.level;
      const payload = formatLogPayload(m.data);
      return {
        level, sev: levelSeverity(level), text: m.message, ...(payload === '' ? {} : { payload }),
      };
    });
    tabs.push({
      key: 'diag', label: 'Messages', count: items.length, items,
      copyText: stripAnsi(items.map((i) => (i.payload == null ? i.text : `${i.text} ${i.payload}`)).join('\n')),
    });
  }
  return tabs;
}

// Both the row button and the popup ask for these on every render, and a live
// run re-renders 4×/s — splitting a 2k-line log that often would hurt.
const tabsCache = new WeakMap<TestNode, LogTab[]>();
function logTabs(node: TestNode): LogTab[] {
  let tabs = tabsCache.get(node);
  if (!tabs) { tabs = computeLogTabs(node); tabsCache.set(node, tabs); }
  return tabs;
}

function computeTheme(): 'dark' | 'light' {
  try {
    const forced = new URLSearchParams(window.location.search).get('theme');
    if (forced === 'dark' || forced === 'light') return forced;
  } catch { /* location may be unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Filter state (search, status chips, Only re-run) bound to a FilterStore:
 *  read once on mount, write on every change, re-read on external changes
 *  (Back/Forward for the URL store, the host's own events for custom ones). */
function useFilters(store: FilterStore) {
  const [state, setState] = useState<FilterState>(() => store.read());
  const first = useRef(true);
  useEffect(() => {
    // Mount state came from read(); only user changes are written back.
    if (first.current) { first.current = false; return; }
    store.write(state);
  }, [state]);
  useEffect(() => store.subscribe?.(setState), [store]);
  const setQuery = (query: string) => setState((prev) => ({ ...prev, query }));
  const setStatuses = (next: ReadonlySet<TestStatus> | ((prev: ReadonlySet<TestStatus>) => ReadonlySet<TestStatus>)) => setState((prev) => ({ ...prev, statuses: typeof next === 'function' ? next(prev.statuses) : next }));
  const setOnlyRerun = (onlyRerun: boolean) => setState((prev) => ({ ...prev, onlyRerun }));
  return {
    query: state.query, statuses: state.statuses, onlyRerun: state.onlyRerun, setQuery, setStatuses, setOnlyRerun,
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

const MessageIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
  </svg>
);

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

function TabBody({ tab, wrap }: { tab: LogTab; wrap: boolean }) {
  if (tab.key === 'error') {
    return (
      <>
        {/* The message appears once — the headline. The stack below is the
            stack, not a re-print of the message. */}
        <div className="pop-msg" data-stc="failed"><Ansi text={tab.message!} /></div>
        {tab.stack !== '' ? (
          <pre className="stack" data-wrap={wrap ? 'true' : undefined}><Ansi text={tab.stack!} /></pre>
        ) : null}
      </>
    );
  }
  if (tab.key === 'output') {
    return (
      <div className="out" data-wrap={wrap ? 'true' : undefined}>
        {tab.lines!.map((line, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div className="out-line" data-err={line.stream === 'err' ? 'true' : undefined} key={i}>
            <Ansi text={line.text === '' ? ' ' : line.text} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="diag-list" data-wrap={wrap ? 'true' : undefined}>
      {tab.items!.map((item, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div className="diag-item" key={i}>
          <span className="diag-level" data-soft={item.sev}>{item.level}</span>
          <span className="txt">
            <Ansi text={item.text} />
            {item.payload != null ? <span className="diag-payload">{item.payload}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The breadcrumb under the popup title: every ancestor that names something,
 *  outermost first. The root carries no name of its own. */
function nodePath(node: TestNode): string[] {
  return [...node.ancestors(), node].filter((n) => n.type !== 'root').map(displayName);
}

/**
 * One node's logs, over the tree. Modal by design: a scrim, Escape, a focus
 * trap, and focus returned to the button that opened it. It holds no copy of
 * the node — the caller re-reads it from the newest snapshot every poll, so a
 * running test's output streams into the open dialog.
 */
function LogsPopup({
  node, tabs, tab, onTab, onClose, running,
}: {
  node: TestNode;
  tabs: LogTab[];
  tab: TabKey;
  onTab: (key: TabKey) => void;
  onClose: () => void;
  running: boolean;
}) {
  const [wrap, setWrap] = useState(() => window.matchMedia?.('(max-width: 640px)').matches ?? false);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const active = tabs.find((t) => t.key === tab) ?? tabs[0];

  useEffect(() => { boxRef.current?.focus(); }, []);
  // Copy's label belongs to what is on screen; a tab or node change stales it.
  useEffect(() => { setCopied(false); pinned.current = false; }, [tab, node.key]);
  // A still-running log tail-follows, and stops the moment the reader scrolls up.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !running) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (!pinned.current || nearBottom) { el.scrollTop = el.scrollHeight; pinned.current = true; }
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const focusables = boxRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const copy = () => {
    void navigator.clipboard?.writeText(active.copyText).then(() => setCopied(true));
  };

  const status = rollup(node);
  const path = nodePath(node);
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div className="scrim" onClick={onClose} />
      <div
        className="pop"
        role="dialog"
        aria-modal="true"
        aria-label={`Logs for ${displayName(node)}`}
        ref={boxRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="pop-head">
          <span className="pop-badge" data-soft={status}>{GLYPH[status]}</span>
          <div className="pop-heading">
            <div className="pop-title">{displayName(node)}</div>
            <div className="pop-path">{path.join(' › ')}</div>
          </div>
          <div className="pop-tools">
            <button type="button" className="pbtn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            <button type="button" className="pbtn" data-on={wrap ? 'true' : undefined} onClick={() => setWrap(!wrap)}>Wrap</button>
            <button type="button" className="pbtn pbtn-x" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="pop-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              type="button"
              className="pop-tab"
              role="tab"
              aria-selected={t.key === active.key}
              data-on={t.key === active.key ? 'true' : undefined}
              onClick={() => onTab(t.key)}
              key={t.key}
            >
              {t.label}
              <span className="pop-tab-n">{formatCount(t.count)}</span>
            </button>
          ))}
        </div>
        <div className="pop-body" ref={bodyRef}><TabBody tab={active} wrap={wrap} /></div>
      </div>
    </>
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
  /** Open this node's logs popup; `prefer` forces a tab, else the last one wins. */
  openLogs: (node: TestNode, prefer?: TabKey) => void;
  /** This row's logs are the ones currently open. */
  selected: boolean;
}

const oneLine = (s: string): string => stripAnsi(s).replace(/\s+/g, ' ').trim();

function RowView({
  row, toggle, enter, now, since, clock, carriedRun, onlyRerun, renderNodeActions, openLogs, selected,
}: RowViewProps) {
  const {
    node, depth, status, expandable, expanded, hasDiag,
  } = row;
  const settled = useSettle(status);
  // A container's row is its disclosure; a leaf has nothing to disclose, so its
  // row opens its logs instead. Either way one gesture, one meaning per row.
  const activate = () => {
    if (expandable) toggle(node.key, expanded);
    else if (hasDiag) openLogs(node);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    else if (e.key === 'ArrowRight' && expandable && !expanded) { e.preventDefault(); activate(); }
    else if (e.key === 'ArrowLeft' && expandable && expanded) { e.preventDefault(); activate(); }
  };

  const counts = node.counts;
  const isTest = node.type === 'test';
  const container = isContainer(node);
  // A cancelled node still counts as failed — it just never ran, so it reads
  // muted and wears its own glyph instead of competing with the real failure
  // above it for attention.
  const cancelled = status === 'failed' && isCancelled(node);
  const nameColor = isTest && cancelled ? 'var(--dim)'
    : isTest && status === 'failed' ? 'var(--st-failed)'
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
  const logs = hasDiag ? logCount(node) : 0;
  // What broke, on one line, under the row that broke. Any node with a real
  // error of its own qualifies, containers included: a suite whose before hook
  // died holds the only cause its cancelled children will never have, and
  // burying that behind a click is what the whole cascade rule exists to stop.
  // `realError` has already dropped the two the runner writes itself, so a
  // rollup previews nothing (its fail chip says it) and neither does a
  // cancellation — it never ran, so nothing broke.
  const preview = status === 'failed' ? realError(node) : undefined;
  const previewText = preview ? oneLine(preview.message) : '';
  const ms = liveNodeDuration(node, now, since, clock);
  const durTip = carried || rollupMark
    ? `${formatDuration(ms) || '—'} — measured on ${markAttempt != null ? `attempt ${markAttempt + 1}` : 'an earlier attempt'}`
    : status !== 'running' && ms >= 1000 ? `${Math.round(ms).toLocaleString('en-US')} ms` : undefined;

  const rowEl = (
    <div
      className={rowClass}
      style={rowStyle}
      role="treeitem"
      aria-expanded={expandable ? expanded : undefined}
      aria-label={`${displayName(node)}, ${status}${container ? `, ${counts.total} tests` : ''}${previewText ? `: ${previewText}` : ''}`}
      tabIndex={0}
      data-clickable={expandable || hasDiag}
      data-fail={isTest && status === 'failed' && !cancelled}
      data-sel={selected ? 'true' : undefined}
      data-running={status === 'running' ? 'true' : undefined}
      onClick={expandable || hasDiag ? () => { if (!selectionClick()) activate(); } : undefined}
      onMouseDown={markPointerFocus}
      onBlur={clearPointerFocus}
      onKeyDown={onKeyDown}
    >
      <span className="guides">
        {Array.from({ length: depth }, (_, i) => <span className="guide" key={i} />)}
      </span>
      <span className="caret" data-open={expandable && expanded ? 'true' : undefined}>{expandable ? '▸' : ''}</span>
      {/* Two status marks, split on leaf vs container rather than node type: a
          leaf is one result, so a dot; anything with children carries a verdict
          over everything beneath it, so it keeps the glyph — including a
          `test()` that nests subtests. A cancellation always takes the glyph,
          since ⊗ is the whole point. */}
      {!container && !cancelled ? (
        <span className="tdot indicator" data-stf={status} data-pulse={status === 'running' ? 'true' : undefined} data-tip={!container ? statusTip(node, status, ms) : undefined} />
      ) : (
        <span className="cglyph indicator" data-stc={cancelled ? 'cancelled' : status} data-spin={container && status === 'running' ? 'true' : undefined} data-tip={!container ? statusTip(node, status, ms) : undefined}>{cancelled ? CANCEL_GLYPH : GLYPH[status]}</span>
      )}
      <span className="name" data-kind={node.type} data-tip-clipped={node.type === 'file' ? node.file ?? displayName(node) : displayName(node)} style={{ color: nameColor }}>{displayName(node)}</span>
      {hasFailChip(node) ? (
        // The rolled-up count, on the row and always visible — it replaces the
        // runner's "N subtests failed" card that used to restate it below.
        <span className="failchip" data-soft="failed" data-tip={`${counts.failed} failing ${counts.failed === 1 ? 'test' : 'tests'} inside`}>{counts.failed} failed</span>
      ) : null}
      {todoLabel(node) ? (
        <span className="todotag" data-soft="todo"># {trimTag(todoLabel(node)!)}</span>
      ) : typeof node.skip === 'string' && node.skip ? (
        <span className="todotag" data-soft="skipped">⊘ {trimTag(node.skip)}</span>
      ) : null}
      {node.tags?.map((tag) => (
        <span className="todotag" data-soft="todo" key={tag}>{trimTag(tag)}</span>
      ))}
      <span className="spacer" />
      {logs > 0 ? (
        <button
          type="button"
          className="logbtn"
          data-on={selected ? 'true' : undefined}
          aria-label="Logs and messages"
          data-tip={`${formatCount(logs)} ${logs === 1 ? 'line' : 'lines'} of output — open`}
          onClick={(e) => { e.stopPropagation(); openLogs(node); }}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <MessageIcon />
          <span className="logbtn-n">{formatCount(logs)}</span>
        </button>
      ) : null}
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
          {/* `failed` is omitted: the fail chip beside the name already carries
              it, at every expansion state rather than only when collapsed. */}
          {STATUS_ORDER.filter((s) => s !== 'failed' && (s === 'passed' && onlyRerun ? counts.passed - counts.carried : counts[s]) > 0).map((s) => (
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

  if (!preview) return rowEl;
  return (
    <>
      {rowEl}
      {/* A redundant affordance, not a second control: the row it belongs to
          already opens the same popup on click or Enter, so this stays out of
          the tab order and out of the a11y tree — the message is on the row's
          own label instead. That also keeps the tree's children all treeitems. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        className="errline"
        aria-hidden="true"
        style={{ marginLeft: `calc(${depth} * var(--ind) + 46px)` }}
        onClick={() => { if (!selectionClick()) openLogs(node, 'error'); }}
      >
        <span className="errline-x">✕</span>
        <span className="errline-msg">{previewText}</span>
        <span className="errline-open">Open</span>
      </div>
    </>
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
  /** Where filter state lives; defaults to the shareable page URL (?q,
   *  ?status, ?rerun). Pass memoryFilterState() (or your own store) when the
   *  host app owns the address bar. Must be stable across renders. */
  filters?: FilterStore;
  /** Row density. `compact` (the default) is built for scanning a long run;
   *  `cozy` trades rows-per-screen for a roomier hit area. Under 640px both
   *  give way to 40px touch rows. */
  dense?: Density;
}

export function TreeView({
  snapshot, streaming = false, pending = false, loadError = false, onRetry, renderNodeActions, renderHeaderActions, filters, dense = 'compact',
}: TreeViewProps) {
  const [theme, toggleTheme] = useTheme();
  // The default store is per-mount so its debounce timer dies with the view.
  const [defaultFilters] = useState(() => filters ?? urlFilterState());
  const {
    query, setQuery, statuses, setStatuses, onlyRerun, setOnlyRerun,
  } = useFilters(filters ?? defaultFilters);
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

  // Which node's logs are open, by key rather than by node: a live run replaces
  // every node object on each poll, and the popup must survive that and show
  // the newest output. `tab` is a preference — the popup falls back whenever
  // the selected node has nothing on it.
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('error');
  const trigger = useRef<HTMLElement | null>(null);
  const selNode = sel != null ? findNode(files, sel) : undefined;
  const selTabs = selNode ? logTabs(selNode) : [];
  const openLogs = (node: TestNode, prefer?: TabKey) => {
    trigger.current = document.activeElement as HTMLElement | null;
    // The error line asks for Error specifically; the log button takes whatever
    // tab was last used and lets the popup fall back.
    if (prefer) setTab(prefer);
    setSel(node.key);
  };
  const closeLogs = () => {
    setSel(null);
    // Focus goes back where it came from, not to the top of the document.
    trigger.current?.focus?.();
    trigger.current = null;
  };
  // A node that streamed its last line and lost its logs, or scrolled out of a
  // filter, closes rather than showing an empty dialog.
  useEffect(() => { if (sel != null && selTabs.length === 0) setSel(null); }, [sel, selTabs.length]);
  useEffect(() => {
    if (sel == null) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLogs(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel]);

  const [allCollapsed, setAllCollapsed] = useState(false);
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
    if (sel != null) closeLogs();
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
      const key = row.node.key;
      const firstSeen = !seen.has(key);
      seen.add(key);
      if (firstSeen && inProgress) { enterMap.set(key, stagger); stagger += 1; }
    }
  }

  if (loadError) {
    return (
      <div className="app" data-dense={dense}>
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
    <div className="app" data-dense={dense}>
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

      <div className="treewrap">
      <div className="tree" role="tree" aria-label="Test results">
        {rows.length > 0 ? (
          rows.map((row) => (
            <RowView
              key={row.node.key}
              row={row}
              toggle={toggle}
              enter={enterMap.has(row.node.key) ? enterMap.get(row.node.key)! : null}
              now={now}
              since={since}
              clock={clock}
              carriedRun={carriedRun}
              onlyRerun={onlyRerun}
              renderNodeActions={renderNodeActions}
              openLogs={openLogs}
              selected={row.node.key === sel}
            />
          ))
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
      {selNode && selTabs.length > 0 ? (
        <LogsPopup
          node={selNode}
          tabs={selTabs}
          tab={tab}
          onTab={setTab}
          onClose={closeLogs}
          running={selNode.status === 'running'}
        />
      ) : null}
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
