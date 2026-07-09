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

/** Where the viewer's filter state (search, status chips, Only re-run) lives.
 *  The viewer reads once on mount, writes on every change, and re-reads when
 *  the store reports an external change. Store instances must be stable for
 *  the life of the viewer. */
export interface FilterStore {
  read(): FilterState;
  write(state: FilterState): void;
  subscribe?(onChange: (state: FilterState) => void): () => void;
}

function currentSearch(): string {
  try { return window.location.search; } catch { return ''; }
}

/** How long typing coalesces into one history entry. */
const QUERY_DEBOUNCE_MS = 400;

/** The default store: shareable filters in the page URL (`?q`, `?status`,
 *  `?rerun`). Discrete toggles push a history entry immediately, typing
 *  debounces into one entry, and Back/Forward restore the previous filters. */
export function urlFilterState(): FilterStore {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const push = (state: FilterState): void => {
    const search = currentSearch();
    const next = serializeFilterState(state, search);
    // Compare canonical forms so encoding quirks (%20 vs +) never push.
    if (next === serializeFilterState(parseFilterState(search), search)) return;
    try {
      window.history.pushState(null, '', `${window.location.pathname}${next}${window.location.hash}`);
    } catch { /* history may be unavailable (sandboxed iframe) */ }
  };
  return {
    read: () => parseFilterState(currentSearch()),
    write(state) {
      clearTimeout(timer);
      const current = parseFilterState(currentSearch());
      const discreteChanged = state.onlyRerun !== current.onlyRerun
        || state.statuses.size !== current.statuses.size
        || [...state.statuses].some((s) => !current.statuses.has(s));
      if (discreteChanged) push(state);
      else timer = setTimeout(() => push(state), QUERY_DEBOUNCE_MS);
    },
    subscribe(onChange) {
      const onPop = () => onChange(parseFilterState(currentSearch()));
      window.addEventListener('popstate', onPop);
      return () => { window.removeEventListener('popstate', onPop); clearTimeout(timer); };
    },
  };
}

/** Filters held in memory only — an embedded viewer that must not touch the
 *  host page's URL. State survives remounts that reuse the store instance. */
export function memoryFilterState(initial?: Partial<FilterState>): FilterStore {
  let state: FilterState = {
    query: '', statuses: new Set(), onlyRerun: false, ...initial,
  };
  return {
    read: () => state,
    write(next) { state = next; },
  };
}
