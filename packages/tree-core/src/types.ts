export type TestStatus =
  | 'queued'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'todo';

export type NodeType = 'root' | 'file' | 'suite' | 'test';

export type DiagnosticLevel = 'info' | 'warn' | 'error';

export interface Diagnostic {
  message: string;
  level: DiagnosticLevel;
}

export interface SerializedError {
  message: string;
  stack?: string;
  name?: string;
}

export interface Counts {
  passed: number;
  failed: number;
  skipped: number;
  todo: number;
  running: number;
  queued: number;
  total: number;
}

export interface TestNode {
  key: string;
  testId: number | undefined;
  parentKey: string | null;
  file: string | undefined;
  name: string;
  nesting: number;
  type: NodeType;
  status: TestStatus;
  durationMs?: number;
  /** Writer wall-clock (`t` of the event that set it running); viewers diff
   *  stamps against each other, never against their own clock. */
  startedAt?: number;
  error?: SerializedError;
  diagnostics: Diagnostic[];
  stdout: string[];
  stderr: string[];
  children: TestNode[];
  line?: number;
  column?: number;
  tags?: string[];
  todo?: boolean | string;
  skip?: boolean | string;
  counts: Counts;
}

export interface SummaryData {
  counts: Record<string, number>;
  durationMs: number;
  success: boolean;
}

export interface TreeSnapshot {
  version: number;
  root: TestNode;
  counts: Counts;
  summary?: SummaryData;
  /** Stamp range of the run so far — the run's elapsed wall-clock is
   *  `lastT - firstT`, independent of when a viewer joined. `firstT` reaches
   *  before the first stamped line when a finish-first node's backdated start
   *  does (head-truncated log). Absent when the stream carries no stamps
   *  (logs from older writers). */
  clock?: { firstT: number; lastT: number };
}

/** The fields of a `node:test` reporter event that the store consumes. */
export interface TestEventData {
  name?: string;
  nesting?: number;
  file?: string;
  testId?: number;
  parentId?: number;
  line?: number;
  column?: number;
  tags?: string[];
  todo?: boolean | string;
  skip?: boolean | string;
  message?: string;
  level?: DiagnosticLevel;
  count?: number;
  type?: 'suite' | 'test';
  details?: {
    duration_ms?: number;
    error?: unknown;
    type?: string;
    passed?: boolean;
    attempt?: number;
    passed_on_attempt?: number;
  };
  counts?: Record<string, number>;
  duration_ms?: number;
  success?: boolean;
}

export interface TestEvent {
  type: string;
  /** Writer wall-clock (epoch ms), stamped when the event is serialized. */
  t?: number;
  data: TestEventData;
}

export interface TreeStore {
  apply(event: TestEvent): void;
  getSnapshot(): TreeSnapshot;
  subscribe(listener: () => void): () => void;
}
