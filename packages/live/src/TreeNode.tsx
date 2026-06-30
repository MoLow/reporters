import React from 'react';
import { Text, Box } from 'ink';
import {
  defaultExpanded, formatDuration, INK_COLOR, SPINNER_FRAMES, SYMBOLS,
  type Counts, type TestNode,
} from '@reporters/tree-core';

function basename(file: string | undefined): string {
  if (!file) return '<unknown>';
  const parts = file.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || file;
}

function collapsedSummary(counts: Counts): string {
  const bits: string[] = [`${counts.passed} ${SYMBOLS.passed}`];
  if (counts.failed > 0) bits.push(`${counts.failed} ${SYMBOLS.failed}`);
  if (counts.skipped > 0) bits.push(`${counts.skipped} ${SYMBOLS.skipped}`);
  return `(${bits.join(' ')})`;
}

interface TreeNodeProps {
  node: TestNode;
  depth: number;
  frame: number;
}

export function TreeNode({ node, depth, frame }: TreeNodeProps) {
  const running = node.status === 'running';
  const symbol = running ? SPINNER_FRAMES[frame % SPINNER_FRAMES.length] : SYMBOLS[node.status];
  const label = node.type === 'file' ? basename(node.file) : node.name;
  const isContainer = node.children.length > 0;
  const expanded = defaultExpanded(node);
  const showError = node.children.length === 0 && node.status === 'failed' && node.error;

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{'  '.repeat(depth)}</Text>
        <Text color={INK_COLOR[node.status]}>{symbol} </Text>
        <Text bold={node.type === 'file'}>{label}</Text>
        {node.durationMs != null ? <Text dimColor>{' '}{formatDuration(node.durationMs)}</Text> : null}
        {isContainer && !expanded ? <Text dimColor>{' '}{collapsedSummary(node.counts)}</Text> : null}
      </Box>

      {showError ? (
        <Box flexDirection="column">
          {node.error!.message.split('\n').map((line, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <Text key={i} color="red" dimColor>{'  '.repeat(depth + 2)}{line}</Text>
          ))}
        </Box>
      ) : null}

      {isContainer && expanded
        ? node.children.map((child) => <TreeNode key={child.key} node={child} depth={depth + 1} frame={frame} />)
        : null}
    </Box>
  );
}
