import { formatLogPayload, INK_LEVEL_COLOR, type TestNode } from '@reporters/tree-core';

export interface SectionLine {
  text: string;
  color?: string;
}

export interface Section {
  label: string;
  lines: SectionLine[];
}

function split(text: string, color?: string): SectionLine[] {
  return text.split('\n').map((line) => ({ text: line, color }));
}

/**
 * The expandable body of a row, as flat labelled line groups the renderer maps
 * straight to `<Text>`. Diagnostics and logs share one `messages` group in
 * arrival order — which is execution order, since logs arrive live and
 * diagnostics arrive buffered — each line colored by its own level.
 */
export function diagnosticSections(node: TestNode): Section[] {
  const sections: Section[] = [];
  const add = (label: string, lines: SectionLine[]): void => {
    if (lines.length > 0) sections.push({ label, lines });
  };

  if (node.error) add('error', split(node.error.stack || node.error.message, 'red'));
  add('messages', node.messages.flatMap((message) => {
    const payload = formatLogPayload(message.data);
    return split(payload === '' ? message.message : `${message.message} ${payload}`, INK_LEVEL_COLOR[message.level]);
  }));
  if (node.stdout.length > 0) add('stdout', split(node.stdout.join('').replace(/\n$/, '')));
  if (node.stderr.length > 0) add('stderr', split(node.stderr.join('').replace(/\n$/, '')));
  return sections;
}
