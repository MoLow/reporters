import type { EvaluateTagRules } from './tagFilters.ts';

/** All report-provided values stay text, including expressions and tag names. */
export function tagTooltip(tags: readonly string[], evaluate: EvaluateTagRules): HTMLElement {
  const result = evaluate(new Set(tags));
  const content = document.createElement('span');
  const line = (text: string, className: string): HTMLElement => {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = text;
    content.appendChild(element);
    return element;
  };
  const count = (n: number) => `${n} ${n === 1 ? 'tag' : 'tags'}`;
  line(`${count(tags.length)}:`, 'tip-tag-total');
  if (result.matches === null) {
    line(tags.join(', '), 'tip-tag');
    line(`Cannot evaluate recorded filters: ${result.error}`, 'tip-tag-note');
    return content;
  }
  const contributing = new Set(result.contributingTags);
  const included = tags.filter((tag) => contributing.has(tag.toLowerCase()));
  const other = tags.filter((tag) => !contributing.has(tag.toLowerCase()));
  line(`${count(included.length)} supporting match: ${included.join(', ') || 'None'}`, 'tip-tag')
    .dataset.contributing = 'true';
  line(`${count(other.length)} not supporting match: ${other.join(', ') || 'None'}`, 'tip-tag');
  line(result.matches ? 'Matches all flag values.' : 'Does not match all flag values.', 'tip-tag-note');
  result.filters.forEach((filter, index) => {
    line(`Flag value ${index + 1}: ${filter.matches ? 'matched' : 'not matched'}`, 'tip-tag-total');
    line(filter.reasons.join('; '), 'tip-tag-reasons');
  });
  return content;
}
