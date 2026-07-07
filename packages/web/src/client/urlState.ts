import type { TestStatus } from '@reporters/tree-core';

export interface FilterState {
  query: string;
  statuses: ReadonlySet<TestStatus>;
  onlyRerun: boolean;
}

const STATUSES: readonly TestStatus[] = ['passed', 'failed', 'skipped', 'todo', 'running', 'queued'];

export function parseFilterState(search: string): FilterState {
  const params = new URLSearchParams(search);
  const statuses = new Set<TestStatus>();
  for (const token of (params.get('status') ?? '').split(',')) {
    if ((STATUSES as readonly string[]).includes(token)) statuses.add(token as TestStatus);
  }
  return {
    query: params.get('q') ?? '',
    statuses,
    onlyRerun: params.get('rerun') === '1',
  };
}

/** New search string for `state`, preserving unrelated params (`src`, `theme`). */
export function serializeFilterState(state: FilterState, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch);
  if (state.query) params.set('q', state.query); else params.delete('q');
  const statuses = STATUSES.filter((s) => state.statuses.has(s));
  if (statuses.length > 0) params.set('status', statuses.join(',')); else params.delete('status');
  if (state.onlyRerun) params.set('rerun', '1'); else params.delete('rerun');
  const out = params.toString();
  return out ? `?${out}` : '';
}
