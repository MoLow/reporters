import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  formatDuration, todoLabel, type Counts, type TestNode, type TestStatus, type TreeSnapshot,
} from '@reporters/tree-core';
import {
  buildRows, collectContainerKeys, collectDiagKeys, computeMatches, displayName, isContainer, isPassingTodo, liveNodeDuration, reasonOf, realError, type FlatRow,
} from './rowModel.ts';

// node:test captures colored output verbatim; render the ANSI SGR codes as real
// colors (mapped to the theme's --ansi-* vars) rather than stripping them.
import { AnsiHtml } from 'fancy-ansi/react';
import {
  classifyFrame, classifyStack, extractLevel, formatCount, levelSeverity, splitUrls, stripAnsi, type StackLine,
} from './format.ts';

const GLYPH: Record<TestStatus, string> = {
  passed: '✓', failed: '✕', skipped: '⊘', todo: '◇', running: '◐', queued: '○',
};
const STATUS_ORDER: TestStatus[] = ['passed', 'failed', 'skipped', 'todo', 'running', 'queued'];
const STATUS_LABEL: Record<TestStatus, string> = {
  passed: 'passed', failed: 'failed', skipped: 'skipped', todo: 'todo', running: 'running', queued: 'queued',
};

interface OutLine { stream: 'out' | 'err'; text: string; }

interface DiagBlock {
  key: string;
  title: string;
  icon: string;
  sev: TestStatus;
  kind: 'error' | 'output' | 'list' | 'text';
  /** Header count (`Output · 1.9k lines`), also surfaced on the row chip. */
  count?: { n: number; unit: string };
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
        a.textContent = seg.text;
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

// AnsiHtml plus a DOM post-pass that wraps http(s) URLs in links — post-render
// so ANSI color state stays intact across the link boundary. Lines that look
// like stack frames (also inside log messages) get node-style frame coloring.
function Ansi({ text }: { text: string }) {
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
            ) : <AnsiHtml text={line} />}
          </React.Fragment>
        );
      })}
    </span>
  );
}

function Stack({ stack }: { stack: string }) {
  return (
    <pre className="stack">
      {classifyStack(stack).map((line, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div className="stack-line" data-kind={line.kind} key={i}>
          <FrameText frame={line} />
        </div>
      ))}
    </pre>
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
      count: { n: items.length, unit: items.length === 1 ? 'note' : 'notes' },
      copyText: stripAnsi(node.diagnostics.map((d) => d.message).join('\n')),
    });
  }
  const reason = reasonOf(node);
  if (reason) {
    blocks.push({
      key: 'reason', title: node.status === 'skipped' ? 'why skipped' : 'why todo',
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
  return <button type="button" className="hbtn" onClick={copy} title="Copy to clipboard">{copied ? 'Copied' : '⧉ Copy'}</button>;
}

/** The capped scroll region (§10a): every line stays reachable, the tree stays
 *  visible around it. A failed node opens scrolled to the tail — the failure is
 *  usually last. */
function LogBody({ block, failed }: { block: DiagBlock; failed: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && failed) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="log-body" ref={ref}><BlockContent block={block} /></div>;
}

function LogModal({ title, block, onClose }: { title: string; block: DiagBlock; onClose: () => void }) {
  const [wrap, setWrap] = useState(true);
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
            <button type="button" className="hbtn" data-on={wrap ? 'true' : undefined} onClick={() => setWrap(!wrap)} title="Toggle line wrapping">Wrap</button>
            <button type="button" className="hbtn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="modal-body"><BlockContent block={block} /></div>
      </div>
    </div>
  );
}

function Diagnostics({ node, indent, onCollapse }: { node: TestNode; indent: string; onCollapse: () => void }) {
  const [modal, setModal] = useState<DiagBlock | null>(null);
  const failed = node.status === 'failed';
  return (
    <div className="diag" style={{ margin: `5px 12px 11px ${indent}` }}>
      {diagBlocks(node).map((block) => (
        <div className="diag-sec" key={block.key}>
          <span className="diag-bar" data-stf={block.sev} />
          <div className="diag-body">
            <div className="diag-head">
              <span className="diag-icon" data-stc={block.sev}>{block.icon}</span>
              <span className="diag-title">{block.title}</span>
              {block.count ? <span className="diag-count">· {formatCount(block.count.n)} {block.count.unit}</span> : null}
              <div className="diag-tools">
                <CopyButton text={block.copyText} />
                <button type="button" className="hbtn" onClick={() => setModal(block)} title="Open full log">⤢ Full log</button>
                <button type="button" className="hbtn" onClick={onCollapse} title="Collapse this panel">Collapse</button>
              </div>
            </div>
            <LogBody block={block} failed={failed} />
          </div>
        </div>
      ))}
      {modal ? (
        <LogModal title={`${modal.title} — ${displayName(node)}`} block={modal} onClose={() => setModal(null)} />
      ) : null}
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

interface RowViewProps {
  row: FlatRow;
  toggle: (key: string, current: boolean) => void;
  /** Stagger index for the enter animation, or null when the row shouldn't animate in. */
  enter: number | null;
  /** Shared clock (performance.now) + per-node running-start map, for live duration ticking. */
  now: number;
  since: Map<string, number>;
}

function RowView({
  row, toggle, enter, now, since,
}: RowViewProps) {
  const {
    node, depth, status, container, expanded, hasDiag, diagOpen,
  } = row;
  const settled = useSettle(status);
  // Mount the panel lazily (a closed panel of a 10k-line log costs nothing),
  // but keep it mounted once opened so collapse animates and scroll survives.
  const everOpen = useRef(diagOpen);
  if (diagOpen) everOpen.current = true;
  const clickable = container || hasDiag;
  const toggleDiag = () => toggle(`${node.key}::diag`, diagOpen);
  const activate = () => {
    if (container) toggle(node.key, expanded);
    else if (hasDiag) toggleDiag();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    else if (e.key === 'ArrowRight' && ((container && !expanded) || (hasDiag && !diagOpen))) { e.preventDefault(); activate(); }
    else if (e.key === 'ArrowLeft' && ((container && expanded) || (hasDiag && diagOpen))) { e.preventDefault(); activate(); }
  };

  const counts = node.counts;
  const isTest = node.type === 'test';
  const nameColor = isTest && status === 'failed' ? 'var(--st-failed)'
    : isTest && (status === 'skipped' || status === 'todo' || status === 'queued') ? 'var(--dim)'
      : 'var(--fg)';
  const ariaExpanded = container ? expanded : hasDiag ? diagOpen : undefined;
  const indent = `${depth * 20 + 38}px`;

  const rowClass = `row${enter !== null ? ' row-enter' : ''}${settled ? ` settle-${status}` : ''}`;
  const rowStyle = enter !== null ? { animationDelay: `${Math.min(enter, 8) * 18}ms` } : undefined;

  return (
    <div>
      <div
        className={rowClass}
        style={rowStyle}
        role="treeitem"
        aria-expanded={ariaExpanded}
        aria-label={`${displayName(node)}, ${status}${container ? `, ${counts.total} tests` : ''}`}
        tabIndex={0}
        data-clickable={clickable}
        data-fail={isTest && status === 'failed'}
        data-running={status === 'running' ? 'true' : undefined}
        onClick={clickable ? activate : undefined}
        onKeyDown={onKeyDown}
      >
        <span className="guides">
          {Array.from({ length: depth }, (_, i) => <span className="guide" key={i} />)}
        </span>
        <span className="caret" data-open={container && expanded ? 'true' : undefined}>{container ? '▸' : ''}</span>
        {isTest ? (
          status === 'running'
            ? <span className="spinner indicator" />
            : <span className="dot indicator" data-stf={status} />
        ) : (
          <span className="cglyph indicator" data-stc={status} data-spin={status === 'running' ? 'true' : undefined}>{GLYPH[status]}</span>
        )}
        <span className="name" data-kind={node.type} style={{ color: nameColor }}>{displayName(node)}</span>
        {isPassingTodo(node) ? (
          <span className="todotag" data-soft="todo"># {todoLabel(node)}</span>
        ) : null}
        {hasDiag ? (
          // Named, severity-tinted affordances (§10e): what's inside and how
          // much of it, not a generic "Details". On a container the row click
          // expands children, so the chip group is its own control for the
          // node's own output; on a leaf the row already toggles diagnostics,
          // so the chips are labels.
          <span
            className="affs"
            role={container ? 'button' : undefined}
            tabIndex={container ? 0 : undefined}
            aria-expanded={container ? diagOpen : undefined}
            data-active={diagOpen ? 'true' : undefined}
            onClick={container ? (e) => { e.stopPropagation(); toggleDiag(); } : undefined}
            onKeyDown={container ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleDiag(); }
            } : undefined}
          >
            {diagBlocks(node).map((block) => (
              <span className="affch" data-soft={block.sev} key={block.key}>
                {block.icon} {block.title}
                {block.count ? ` · ${formatCount(block.count.n)} ${block.count.unit}` : ''}
              </span>
            ))}
          </span>
        ) : null}
        <span className="spacer" />
        {container && !expanded ? (
          <span className="pills">
            {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <span className="pill" data-soft={s} key={s}>{counts[s]}</span>
            ))}
          </span>
        ) : null}
        <span className="dur">{formatDuration(liveNodeDuration(node, now, since)) || '—'}</span>
      </div>
      {hasDiag ? (
        <div className={`collapsible${diagOpen ? ' open' : ''}`}>
          <div className="inner">
            {everOpen.current ? <Diagnostics node={node} indent={indent} onCollapse={toggleDiag} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Verdict({ counts, inProgress, duration }: { counts: Counts; inProgress: boolean; duration: number }) {
  const status: TestStatus = inProgress ? 'running' : counts.failed > 0 ? 'failed' : 'passed';
  const label = inProgress ? 'Running' : counts.failed > 0 ? 'Failing' : 'Passing';
  return (
    <div className="verdict" data-soft={status}>
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
  icon, iconStatus, pulse, title, children,
}: {
  icon: string; iconStatus: TestStatus; pulse?: boolean; title: string; children?: React.ReactNode;
}) {
  return (
    <div className="state">
      <div className="state-icon" data-soft={iconStatus} data-pulse={pulse ? 'true' : undefined}>{icon}</div>
      <div className="state-title">{title}</div>
      {children}
    </div>
  );
}

export interface TreeViewProps {
  snapshot: TreeSnapshot;
  /** The viewer is still polling a live log (no final summary yet). */
  streaming?: boolean;
  /** The viewer's `?src=` is missing or unreachable. */
  loadError?: boolean;
  onRetry?: () => void;
}

export function TreeView({
  snapshot, streaming = false, loadError = false, onRetry,
}: TreeViewProps) {
  const [theme, toggleTheme] = useTheme();
  const [query, setQuery] = useState('');
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  // Active status-chip filters; empty = unfiltered.
  const [statuses, setStatuses] = useState<ReadonlySet<TestStatus>>(new Set());
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
  // Client clock (performance.now) at which each node was first seen running, so
  // running durations tick live between polls.
  const sinceRef = useRef<Map<string, number>>(new Map());
  // A steadily-incrementing tick that drives live duration re-renders.
  const [, setTick] = useState(0);

  const files = snapshot.root.children;
  const { counts } = snapshot;
  const q = query.trim().toLowerCase();

  const matches = useMemo(
    () => (q || statuses.size > 0 ? computeMatches(files, q, statuses) : null),
    [files, q, statuses],
  );
  const rows = useMemo(
    () => buildRows(files, {
      overrides, query: q, statuses, matches,
    }),
    [files, overrides, q, statuses, matches],
  );

  const toggle = (key: string, current: boolean) => {
    setOverrides((prev) => new Map(prev).set(key, !current));
  };
  const [allCollapsed, setAllCollapsed] = useState(false);
  const toggleAll = () => {
    const keys: string[] = [];
    collectContainerKeys(files, keys);
    const diagKeys: string[] = [];
    collectDiagKeys(files, diagKeys);
    const expand = allCollapsed; // currently collapsed -> expand; else collapse
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const key of keys) next.set(key, expand);
      // Collapse All also folds every open output panel (§10d); expanding
      // clears those overrides so failed leaves reopen by default.
      for (const key of diagKeys) { if (expand) next.delete(key); else next.set(key, false); }
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
  // The run summary carries the real wall-clock; while still running, fall back
  // to aggregating the files (running leaves count live elapsed, so the header
  // ticks with the run).
  const duration = snapshot.summary?.durationMs ?? liveNodeDuration(snapshot.root, now, since);

  // Enter-animation bookkeeping: play only for rows first seen during a live run,
  // staggered within each file so a file "unfurls" rather than popping as a slab.
  const enterMap = new Map<string, number>();
  {
    const seen = seenRef.current;
    let stagger = 0;
    for (const row of rows) {
      if (row.node.type === 'file') stagger = 0;
      const firstSeen = !seen.has(row.node.key);
      seen.add(row.node.key);
      if (firstSeen && inProgress) { enterMap.set(row.node.key, stagger); stagger += 1; }
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
                title={statuses.has(s) ? `Stop filtering by ${STATUS_LABEL[s]}` : `Show only ${STATUS_LABEL[s]} tests`}
                onClick={() => toggleStatus(s)}
                key={s}
              >
                <span className="chip-dot" data-stf={s} />
                {counts[s]}
                <span className="chip-label">{STATUS_LABEL[s]}</span>
              </button>
            ))}
          </div>
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
            <button
              type="button"
              className="btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <ThemeIcon theme={theme} />
            </button>
            <button
              type="button"
              className="btn"
              onClick={toggleAll}
              title={allCollapsed ? 'Expand all' : 'Collapse all'}
            >
              {allCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
        </div>
        <div className="hdr-bar-row">
          <div className="bar">
            {barSegments.map((s) => (
              <span
                key={s}
                data-stf={s}
                data-pulse={s === 'running' ? 'true' : undefined}
                style={{ width: `${(counts[s] / total) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </header>

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
            />
          ))
        ) : q ? (
          <CenteredState icon="⌕" iconStatus="skipped" title={`No tests match “${query.trim()}”`}>
            <div className="state-sub">Try a shorter query, or search by file name.</div>
            <button type="button" className="btn-primary" onClick={() => setQuery('')}>Clear filter</button>
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
          {inProgress ? 'Live · streaming results'
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
