import React, {
  useEffect, useMemo, useRef, useState, useSyncExternalStore,
} from 'react';
import { Box, Text, useInput } from 'ink';
import type { TestNode, TreeStore } from '@reporters/tree-core';
import { TreeNode, nodeHasDiagnostics } from './TreeNode.tsx';
import { Header } from './Header.tsx';

function flatten(node: TestNode, out: TestNode[]): TestNode[] {
  for (const child of node.children) {
    out.push(child);
    flatten(child, out);
  }
  return out;
}

export function App({ store }: { store: TreeStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const start = useRef(Date.now());

  useEffect(() => {
    if (snapshot.summary) return undefined;
    const timer = setInterval(() => {
      setFrame((f) => f + 1);
      setElapsed(Date.now() - start.current);
    }, 80);
    return () => clearInterval(timer);
  }, [snapshot.summary]);

  const flat = useMemo(() => flatten(snapshot.root, []), [snapshot]);
  const [selected, setSelected] = useState(0);
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const index = Math.min(selected, Math.max(flat.length - 1, 0));
  const selectedKey = flat[index]?.key;

  useInput((input, key) => {
    if ((key.ctrl && input === 'c') || input === 'q') {
      process.exit(snapshot.summary && snapshot.summary.success === false ? 1 : 0);
    } else if (key.downArrow || input === 'j') {
      setSelected((s) => Math.min(s + 1, flat.length - 1));
    } else if (key.upArrow || input === 'k') {
      setSelected((s) => Math.max(s - 1, 0));
    } else if (input === ' ' || key.return) {
      const node = flat[index];
      if (node && nodeHasDiagnostics(node)) {
        setOverrides((prev) => {
          const next = new Map(prev);
          const current = next.has(node.key) ? next.get(node.key)! : node.status === 'failed';
          next.set(node.key, !current);
          return next;
        });
      }
    }
  }, { isActive: Boolean(process.stdin.isTTY) });

  return (
    <Box flexDirection="column">
      {snapshot.root.children.map((file) => (
        <TreeNode key={file.key} node={file} depth={0} frame={frame} selectedKey={selectedKey} overrides={overrides} />
      ))}
      <Box marginTop={1}>
        <Header counts={snapshot.counts} summary={snapshot.summary} elapsed={elapsed} frame={frame} />
      </Box>
      {snapshot.summary ? (
        <Text dimColor>↑/↓ move · space toggle diagnostics · q or Ctrl+C to close</Text>
      ) : null}
    </Box>
  );
}
