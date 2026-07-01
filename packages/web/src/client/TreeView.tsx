import React, {
  useEffect, useMemo, useState,
} from 'react';
import {
  formatDuration, type Counts, type TestNode, type TestStatus, type TreeSnapshot,
} from '@reporters/tree-core';
import {
  buildRows, collectContainerKeys, computeMatches, displayName, isContainer, reasonOf, type FlatRow,
} from './rowModel.ts';

const GLYPH: Record<TestStatus, string> = {
  passed: '✓', failed: '✕', skipped: '⊘', todo: '◇', running: '◐', queued: '○',
};
const STATUS_ORDER: TestStatus[] = ['passed', 'failed', 'skipped', 'todo', 'running', 'queued'];
const STATUS_LABEL: Record<TestStatus, string> = {
  passed: 'passed', failed: 'failed', skipped: 'skipped', todo: 'todo', running: 'running', queued: 'queued',
};

function sumDuration(node: TestNode): number {
  if (!isContainer(node)) return node.durationMs ?? 0;
  return node.children.reduce((total, child) => total + sumDuration(child), 0);
}

/** Severity of a test's diagnostics, for the row badge tint. */
function diagSeverity(node: TestNode): TestStatus {
  if (node.error || node.stderr.length > 0) return 'failed';
  if (node.diagnostics.some((d) => d.level === 'warn')) return 'running';
  return 'skipped';
}

interface DiagBlock {
  key: string;
  title: string;
  icon: string;
  sev: TestStatus;
  kind: 'error' | 'text' | 'list';
  message?: string;
  stack?: string;
  text?: string;
  err?: boolean;
  items?: { level: string; sev: TestStatus; text: string }[];
}

function diagBlocks(node: TestNode): DiagBlock[] {
  const blocks: DiagBlock[] = [];
  if (node.error) {
    blocks.push({
      key: 'error', title: 'Error', icon: '✕', sev: 'failed', kind: 'error',
      message: node.error.message, stack: node.error.stack ?? node.error.message,
    });
  }
  if (node.stdout.length > 0) {
    blocks.push({ key: 'stdout', title: 'stdout', icon: '›', sev: 'skipped', kind: 'text', text: node.stdout.join('') });
  }
  if (node.stderr.length > 0) {
    blocks.push({ key: 'stderr', title: 'stderr', icon: '›', sev: 'failed', kind: 'text', text: node.stderr.join(''), err: true });
  }
  if (node.diagnostics.length > 0) {
    blocks.push({
      key: 'diag', title: 'diagnostics', icon: '◇', sev: 'skipped', kind: 'list',
      items: node.diagnostics.map((d) => ({
        level: d.level,
        sev: d.level === 'error' ? 'failed' : d.level === 'warn' ? 'running' : 'skipped',
        text: d.message,
      })),
    });
  }
  const reason = reasonOf(node);
  if (reason) {
    blocks.push({
      key: 'reason', title: node.status === 'skipped' ? 'why skipped' : 'why todo',
      icon: '⊘', sev: 'skipped', kind: 'text', text: reason,
    });
  }
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

function Diagnostics({ node, indent }: { node: TestNode; indent: string }) {
  return (
    <div className="diag" style={{ margin: `5px 12px 11px ${indent}` }}>
      {diagBlocks(node).map((block) => (
        <div className="diag-sec" key={block.key}>
          <span className="diag-bar" data-stf={block.sev} />
          <div className="diag-body">
            <div className="diag-head">
              <span className="diag-icon" data-stc={block.sev}>{block.icon}</span>
              <span className="diag-title">{block.title}</span>
            </div>
            {block.kind === 'error' ? (
              <>
                <div className="diag-msg"><span data-stc="failed">{block.message}</span></div>
                <pre className="stack">{block.stack}</pre>
              </>
            ) : null}
            {block.kind === 'text' ? (
              <pre className={`text${block.err ? ' err' : ''}`}>{block.text}</pre>
            ) : null}
            {block.kind === 'list' ? (
              <div className="diag-list">
                {block.items!.map((item, i) => (
                  <div className="diag-item" key={i}>
                    <span className="diag-level" data-soft={item.sev}>{item.level}</span>
                    <span className="txt">{item.text}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

interface RowViewProps {
  row: FlatRow;
  toggle: (key: string, current: boolean) => void;
}

function RowView({ row, toggle }: RowViewProps) {
  const {
    node, depth, status, container, expanded, hasDiag, diagOpen,
  } = row;
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

  return (
    <div>
      <div
        className="row"
        role="treeitem"
        aria-expanded={ariaExpanded}
        aria-label={`${displayName(node)}, ${status}${container ? `, ${counts.total} tests` : ''}`}
        tabIndex={0}
        data-clickable={clickable}
        data-fail={isTest && status === 'failed'}
        onClick={clickable ? activate : undefined}
        onKeyDown={onKeyDown}
      >
        <span className="guides">
          {Array.from({ length: depth }, (_, i) => <span className="guide" key={i} />)}
        </span>
        <span className="caret">{container ? (expanded ? '▾' : '▸') : ''}</span>
        {isTest ? (
          <span className="dot" data-stf={status} data-spin={status === 'running' ? 'true' : undefined} />
        ) : (
          <span className="cglyph" data-stc={status}>{GLYPH[status]}</span>
        )}
        <span className="name" data-kind={node.type} style={{ color: nameColor }}>{displayName(node)}</span>
        {hasDiag ? (
          // On a container the row click expands children, so the badge is its
          // own control for the node's own output; on a leaf the row already
          // toggles diagnostics, so the badge is just a label.
          container ? (
            <span
              className="diagbadge"
              role="button"
              tabIndex={0}
              aria-expanded={diagOpen}
              data-soft={diagSeverity(node)}
              onClick={(e) => { e.stopPropagation(); toggleDiag(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleDiag(); }
              }}
            >
              {diagOpen ? 'Hide' : 'Details'}
            </span>
          ) : (
            <span className="diagbadge" data-soft={diagSeverity(node)}>{diagOpen ? 'Hide' : 'Details'}</span>
          )
        ) : null}
        <span className="spacer" />
        {container && !expanded ? (
          <span className="pills">
            {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <span className="pill" data-soft={s} key={s}>{counts[s]}</span>
            ))}
          </span>
        ) : null}
        <span className="dur">{formatDuration(sumDuration(node)) || '—'}</span>
      </div>
      {hasDiag && diagOpen ? <Diagnostics node={node} indent={indent} /> : null}
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

  const files = snapshot.root.children;
  const { counts } = snapshot;
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => (q ? computeMatches(files, q) : null), [files, q]);
  const rows = useMemo(
    () => buildRows(files, { overrides, query: q, matches }),
    [files, overrides, q, matches],
  );

  const toggle = (key: string, current: boolean) => {
    setOverrides((prev) => new Map(prev).set(key, !current));
  };
  const collapseAll = () => {
    const keys: string[] = [];
    collectContainerKeys(files, keys);
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const key of keys) next.set(key, false);
      return next;
    });
  };

  const inProgress = !snapshot.summary && (streaming || counts.running > 0 || counts.queued > 0);
  const duration = snapshot.summary ? snapshot.summary.durationMs : sumDuration(snapshot.root);

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
              <span className="chip" data-soft={s} key={s}>
                <span className="chip-dot" data-stf={s} />
                {counts[s]}
                <span className="chip-label">{STATUS_LABEL[s]}</span>
              </span>
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
            <button type="button" className="btn" onClick={collapseAll} title="Collapse all">Collapse</button>
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
          rows.map((row) => <RowView key={row.node.key} row={row} toggle={toggle} />)
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
