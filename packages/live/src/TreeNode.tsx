import React from 'react';
import { Text, Box } from 'ink';
import {
  formatDuration, INK_COLOR, SPINNER_FRAMES, SYMBOLS, todoLabel, type TestNode,
} from '@reporters/tree-core';

function basename(file: string | undefined): string {
  if (!file) return '<unknown>';
  const parts = file.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || file;
}

export function nodeHasDiagnostics(node: TestNode): boolean {
  return Boolean(node.error) || node.diagnostics.length > 0
    || node.stdout.length > 0 || node.stderr.length > 0;
}

export function diagnosticsOpen(node: TestNode, overrides: Map<string, boolean>): boolean {
  if (!nodeHasDiagnostics(node)) return false;
  return overrides.has(node.key) ? overrides.get(node.key)! : node.status === 'failed';
}

function Diagnostics({ node, indent }: { node: TestNode; indent: string }) {
  const lines: React.ReactNode[] = [];
  const push = (label: string, text: string, color?: string) => {
    lines.push(
      // eslint-disable-next-line react/no-array-index-key
      <Text key={`${label}-l`} dimColor>{indent}{label}</Text>,
    );
    text.split('\n').forEach((line, i) => lines.push(
      // eslint-disable-next-line react/no-array-index-key
      <Text key={`${label}-${i}`} color={color}>{indent}{line}</Text>,
    ));
  };
  if (node.error) push('error', node.error.stack || node.error.message, 'red');
  if (node.diagnostics.length) push('diagnostics', node.diagnostics.map((d) => d.message).join('\n'));
  if (node.stdout.length) push('stdout', node.stdout.join('').replace(/\n$/, ''));
  if (node.stderr.length) push('stderr', node.stderr.join('').replace(/\n$/, ''));
  return <Box flexDirection="column">{lines}</Box>;
}

interface TreeNodeProps {
  node: TestNode;
  depth: number;
  frame: number;
  selectedKey: string | undefined;
  overrides: Map<string, boolean>;
  interactive: boolean;
}

export function TreeNode({
  node, depth, frame, selectedKey, overrides, interactive,
}: TreeNodeProps) {
  const running = node.status === 'running';
  const symbol = running ? SPINNER_FRAMES[frame % SPINNER_FRAMES.length] : SYMBOLS[node.status];
  const label = node.type === 'file' ? basename(node.file) : node.name;
  const selected = node.key === selectedKey;
  const hasDiag = nodeHasDiagnostics(node);
  const showDiag = interactive ? diagnosticsOpen(node, overrides) : hasDiag;

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{'  '.repeat(depth)}</Text>
        {/* Disclosure affordance: a caret marks rows whose diagnostics can be
            toggled; others get a blank so columns stay aligned. */}
        <Text color="yellow">{hasDiag ? (showDiag ? '▾ ' : '▸ ') : '  '}</Text>
        <Text color={INK_COLOR[node.status]}>{symbol} </Text>
        <Text bold={node.type === 'file'} inverse={selected} underline={selected}>{label}</Text>
        {todoLabel(node) != null ? <Text color={INK_COLOR.todo}>{' # '}{todoLabel(node)}</Text> : null}
        {node.durationMs != null ? <Text dimColor>{' '}{formatDuration(node.durationMs)}</Text> : null}
      </Box>
      {showDiag ? <Diagnostics node={node} indent={'  '.repeat(depth + 2)} /> : null}
      {node.children.map((child) => (
        <TreeNode key={child.key} node={child} depth={depth + 1} frame={frame} selectedKey={selectedKey} overrides={overrides} interactive={interactive} />
      ))}
    </Box>
  );
}
