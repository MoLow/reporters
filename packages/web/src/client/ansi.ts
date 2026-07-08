import { createElement, memo, useMemo } from 'react';
import { FancyAnsi } from 'fancy-ansi';

const fancy = new FancyAnsi();

/** Renders one ANSI-colored line. React 19 diffs dangerouslySetInnerHTML by
 *  object identity and reassigns innerHTML whenever the {__html} object is
 *  new — even when the string is unchanged — which rebuilds the line's DOM on
 *  every live-run re-render (4×/s): text selections collapse and the anchors
 *  the linkify post-pass inserted are wiped. Keep the {__html} object stable
 *  per text so a re-render never touches the DOM, and memo the component so
 *  unchanged lines skip the render entirely. */
export const AnsiSpan = memo(({ text }: { text: string }) => {
  const html = useMemo(() => ({ __html: fancy.toHtml(text) }), [text]);
  return createElement('span', { dangerouslySetInnerHTML: html });
}, (prev, next) => prev.text === next.text);
