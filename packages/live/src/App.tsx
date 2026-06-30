import React, {
  useEffect, useRef, useState, useSyncExternalStore,
} from 'react';
import { Box } from 'ink';
import type { TreeStore } from '@reporters/tree-core';
import { TreeNode } from './TreeNode.tsx';
import { Header } from './Header.tsx';

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

  return (
    <Box flexDirection="column">
      {snapshot.root.children.map((file) => (
        <TreeNode key={file.key} node={file} depth={0} frame={frame} />
      ))}
      <Box marginTop={1}>
        <Header counts={snapshot.counts} summary={snapshot.summary} elapsed={elapsed} frame={frame} />
      </Box>
    </Box>
  );
}
