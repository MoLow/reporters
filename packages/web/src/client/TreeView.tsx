import React, { useState } from 'react';
import {
  defaultExpanded, formatDuration, SYMBOLS, type Counts, type TestNode, type TreeSnapshot,
} from '@reporters/tree-core';

function basename(file: string | undefined): string {
  if (!file) return '<unknown>';
  const parts = file.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || file;
}

function matches(node: TestNode, q: string): boolean {
  if (!q) return true;
  if (node.name.toLowerCase().includes(q) || basename(node.file).toLowerCase().includes(q)) return true;
  return node.children.some((c) => matches(c, q));
}

function hasDiagnostics(node: TestNode): boolean {
  return Boolean(node.error) || node.diagnostics.length > 0 || node.stdout.length > 0 || node.stderr.length > 0;
}

function Diagnostics({ node }: { node: TestNode }) {
  return (
    <div className={`diag${node.error ? ' has-error' : ''}`}>
      {node.error ? (
        <section>
          <div className="label">error</div>
          <pre className="err">{node.error.stack || node.error.message}</pre>
        </section>
      ) : null}
      {node.diagnostics.length > 0 ? (
        <section>
          <div className="label">diagnostics</div>
          <pre>{node.diagnostics.map((d) => d.message).join('\n')}</pre>
        </section>
      ) : null}
      {node.stdout.length > 0 ? (
        <section>
          <div className="label">stdout</div>
          <pre>{node.stdout.join('')}</pre>
        </section>
      ) : null}
      {node.stderr.length > 0 ? (
        <section>
          <div className="label">stderr</div>
          <pre>{node.stderr.join('')}</pre>
        </section>
      ) : null}
    </div>
  );
}

interface RowProps {
  node: TestNode;
  query: string;
  overrides: Map<string, boolean>;
  toggle: (key: string, value: boolean) => void;
}

function Row({
  node, query, overrides, toggle,
}: RowProps) {
  if (!matches(node, query.toLowerCase())) return null;

  const isContainer = node.children.length > 0;
  const diag = hasDiagnostics(node);
  const open = overrides.has(node.key) ? overrides.get(node.key)! : defaultExpanded(node);
  const diagKey = `${node.key}::diag`;
  const diagOpen = overrides.has(diagKey) ? overrides.get(diagKey)! : node.status === 'failed';

  const label = node.type === 'file' ? basename(node.file) : node.name;
  const clickable = isContainer || diag;
  const onClick = () => {
    if (isContainer) toggle(node.key, open);
    else if (diag) toggle(diagKey, diagOpen);
  };

  return (
    <div className="node">
      <div
        className={`row status-${node.status}${clickable ? ' clickable' : ''}`}
        onClick={clickable ? onClick : undefined}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      >
        <span className="twist">{isContainer ? (open ? '▾' : '▸') : diag ? '◆' : ''}</span>
        <span className="glyph">{SYMBOLS[node.status]}</span>
        <span className={`name${node.type === 'file' ? ' file' : ''}`}>{label}</span>
        {node.durationMs != null ? <span className="dur">{formatDuration(node.durationMs)}</span> : null}
        {isContainer && !open ? (
          <span className="tally">
            {node.counts.passed} {SYMBOLS.passed}
            {node.counts.failed ? ` · ${node.counts.failed} ${SYMBOLS.failed}` : ''}
          </span>
        ) : null}
      </div>
      {!isContainer && diag && diagOpen ? <Diagnostics node={node} /> : null}
      {isContainer && open ? (
        <div className="children">
          {node.children.map((child) => (
            <Row key={child.key} node={child} query={query} overrides={overrides} toggle={toggle} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function verdictOf(snapshot: TreeSnapshot): { cls: string; label: string } {
  const { counts, summary } = snapshot;
  if (summary) return summary.success ? { cls: 'v-passed', label: 'passed' } : { cls: 'v-failed', label: 'failed' };
  if (counts.failed > 0) return { cls: 'v-failed', label: 'failing' };
  if (counts.running > 0 || counts.queued > 0) return { cls: 'v-running', label: 'running' };
  return { cls: 'v-passed', label: 'passed' };
}

function Meter({ counts }: { counts: Counts }) {
  const total = Math.max(counts.total, 1);
  const seg = (n: number, color: string) => (n > 0
    ? <span key={color} style={{ width: `${(n / total) * 100}%`, background: color }} /> : null);
  return (
    <div className="meter">
      {seg(counts.passed, 'var(--passed)')}
      {seg(counts.failed, 'var(--failed)')}
      {seg(counts.skipped, 'var(--skipped)')}
      {seg(counts.todo, 'var(--todo)')}
      {seg(counts.running, 'var(--running)')}
      {seg(counts.queued, 'var(--queued)')}
    </div>
  );
}

export function TreeView({ snapshot }: { snapshot: TreeSnapshot }) {
  const [query, setQuery] = useState('');
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const toggle = (key: string, value: boolean) => {
    setOverrides((prev) => new Map(prev).set(key, !value));
  };

  const { counts } = snapshot;
  const verdict = verdictOf(snapshot);
  const chip = (n: number, sym: string, cls: string, show = true) => (show ? (
    <span className={`chip c-${cls}`}><span className="g">{sym}</span>{n}</span>
  ) : null);

  return (
    <div className="app">
      <div className="statusbar">
        <span className="brand"><b>node:test</b> report</span>
        <span className={`verdict ${verdict.cls}`}><span className="dot" />{verdict.label}</span>
        <span className="chips">
          {chip(counts.passed, SYMBOLS.passed, 'passed')}
          {chip(counts.failed, SYMBOLS.failed, 'failed')}
          {chip(counts.skipped, SYMBOLS.skipped, 'skipped', counts.skipped > 0)}
          {chip(counts.todo, SYMBOLS.todo, 'todo', counts.todo > 0)}
          {chip(counts.running, SYMBOLS.running, 'running', counts.running > 0)}
        </span>
        <Meter counts={counts} />
        {snapshot.summary ? <span className="dur">{formatDuration(snapshot.summary.durationMs)}</span> : null}
        <input
          className="search"
          placeholder="filter tests…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="filter tests"
        />
      </div>
      {snapshot.root.children.length === 0 ? (
        <div className="empty">No tests reported yet.</div>
      ) : (
        snapshot.root.children.map((file) => (
          <Row key={file.key} node={file} query={query} overrides={overrides} toggle={toggle} />
        ))
      )}
    </div>
  );
}
