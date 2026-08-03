import type {
  NodeType, SerializedError, TestNode, TestStatus,
} from './types.ts';

export const ROOT_KEY = '<root>';
export const REPL = '<repl>';
export const SEP = '\0';

export const TERMINAL: ReadonlySet<TestStatus> = new Set(['passed', 'failed', 'skipped', 'todo']);

export interface InternalNode {
  key: string;
  testId: number | undefined;
  // Placed by a declaration-ordered test:start — the authoritative position.
  // Execution-ordered events must never re-link such a node.
  declPlaced?: boolean;
  parentKey: string | null;
  file: string | undefined;
  entryFile?: string;
  name: string;
  nesting: number;
  type: NodeType;
  status: TestStatus;
  durationMs?: number;
  startedAt?: number;
  error?: SerializedError;
  messages: TestNode['messages'];
  stdout: string[];
  stderr: string[];
  line?: number;
  column?: number;
  tags?: string[];
  todo?: boolean | string;
  skip?: boolean | string;
  passedOnAttempt?: number;
  // File groups only: the file-level wrapper has started but not yet
  // completed — the file is alive even when every test in it has settled
  // (hooks, teardown, or subtests still to come).
  wrapperOpen?: boolean;
  // File groups only: the wrapper closed with its own failure — a hook threw
  // or the child process died — which node reports only on the wrapper, so it
  // must survive here or a file whose tests all passed renders green.
  wrapperFailed?: boolean;
  wrapperError?: SerializedError;
  childKeys: string[];
}

export function makeNode(key: string, type: NodeType): InternalNode {
  return {
    key,
    testId: undefined,
    parentKey: null,
    file: undefined,
    name: '',
    nesting: type === 'root' || type === 'file' ? -1 : 0,
    type,
    status: type === 'root' || type === 'file' ? 'running' : 'queued',
    messages: [],
    stdout: [],
    stderr: [],
    childKeys: [],
  };
}

export function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}
