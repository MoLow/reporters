import React from 'react';
import { Text, Box } from 'ink';
import {
  formatDuration, SPINNER_FRAMES, SYMBOLS, type Counts, type SummaryData,
} from '@reporters/tree-core';

interface HeaderProps {
  counts: Counts;
  summary?: SummaryData;
  elapsed: number;
  frame: number;
}

export function Header({
  counts, summary, elapsed, frame,
}: HeaderProps) {
  const done = summary != null;
  const duration = done ? summary.durationMs : elapsed;
  return (
    <Box>
      <Text bold>{done ? (summary.success ? '✓ done' : '✗ failed') : `${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]} running`}</Text>
      <Text>{'  '}</Text>
      <Text color="green">{counts.passed} {SYMBOLS.passed}</Text>
      <Text>{'  '}</Text>
      <Text color="red">{counts.failed} {SYMBOLS.failed}</Text>
      {counts.skipped > 0 ? <Text color="yellow">{'  '}{counts.skipped} {SYMBOLS.skipped}</Text> : null}
      {counts.todo > 0 ? <Text color="cyan">{'  '}{counts.todo} {SYMBOLS.todo}</Text> : null}
      {counts.running > 0 ? <Text color="blue">{'  '}{counts.running} {SYMBOLS.running}</Text> : null}
      <Text dimColor>{'   '}{formatDuration(duration)}</Text>
    </Box>
  );
}
