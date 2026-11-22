export const TAG_OPERATORS = new Map([
  ['and', 'AND'], ['&&', 'AND'], ['or', 'OR'], ['||', 'OR'], ['not', 'NOT'], ['!', 'NOT'],
]);

export const tagTokens = (filter: string): string[] => filter.match(/&&|\|\||[!()&|]|[^ \t\n\v\f\r&|!()]+/g) ?? [];

const wildcardPattern = (token: string): RegExp => new RegExp(`^${token.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);

/** References only, not boolean evaluation: negated tags are in the rules too. */
export function tagRuleMatcher(filters: readonly string[] = []): (tag: string) => boolean {
  const tokens = new Set(filters.flatMap(tagTokens).map((token) => token.toLowerCase()));
  const patterns = [...tokens]
    .filter((token) => !TAG_OPERATORS.has(token) && !/^[()&|]$/.test(token))
    .map(wildcardPattern);
  const cache = new Map<string, boolean>();
  return (tag) => {
    const normalized = tag.toLowerCase();
    if (!cache.has(normalized)) cache.set(normalized, patterns.some((pattern) => pattern.test(normalized)));
    return cache.get(normalized)!;
  };
}

interface Evidence {
  matches: boolean;
  /** Present tags supporting this result, including a false result. */
  tags: readonly string[];
  reasons: readonly string[];
}

export interface TagRuleEvaluation {
  /** null means the recorded expression could not be parsed. */
  matches: boolean | null;
  /** Present tags supporting a successful match across ALL flag values. */
  contributingTags: readonly string[];
  filters: readonly { expression: string; matches: boolean; reasons: readonly string[] }[];
  error?: string;
}

type Condition = (tags: ReadonlySet<string>) => Evidence;
export type EvaluateTagRules = (tags: ReadonlySet<string>) => TagRuleEvaluation;

function combine(conditions: Condition[], all: boolean): Condition {
  if (conditions.length === 1) return conditions[0];
  return (tags) => {
    // Visit all branches so equivalent successful OR branches are all explained.
    const results = conditions.map((condition) => condition(tags));
    const matches = all ? results.every((result) => result.matches) : results.some((result) => result.matches);
    const evidence = results.filter((result) => result.matches === matches);
    return {
      matches,
      tags: [...new Set(evidence.flatMap((result) => result.tags))],
      reasons: [...new Set(evidence.flatMap((result) => result.reasons))],
    };
  };
}

/** Compile the runner's grammar into closures, never executable source text. */
function compileExpression(expression: string): Condition {
  const tokens = tagTokens(expression);
  let position = 0;
  const operator = () => TAG_OPERATORS.get(tokens[position]?.toLowerCase());

  function operand(depth: number): Condition {
    // Bound recursion for untrusted report metadata, rather than overflowing the stack.
    if (depth > 128) throw new Error('Expression nesting exceeds 128 levels');
    if (operator() === 'NOT') {
      position += 1;
      const child = operand(depth + 1);
      return (tags) => {
        const result = child(tags);
        return { ...result, matches: !result.matches };
      };
    }
    if (tokens[position] === '(') {
      position += 1;
      const child = or(depth + 1);
      if (tokens[position++] !== ')') throw new Error('Expected closing parenthesis');
      return child;
    }
    const token = tokens[position++];
    if (!token || TAG_OPERATORS.has(token.toLowerCase()) || /^[()&|]$/.test(token)) {
      throw new Error('Expected a tag or condition');
    }
    const normalized = token.toLowerCase();
    const pattern = normalized.includes('*') ? wildcardPattern(normalized) : undefined;
    return (tags) => {
      const present = pattern ? [...tags].filter((tag) => pattern.test(tag)) : tags.has(normalized) ? [normalized] : [];
      return {
        matches: present.length > 0,
        tags: present,
        reasons: [present.length ? `${token}: present${pattern ? ` (${present.join(', ')})` : ''}` : `${token}: absent`],
      };
    };
  }

  function and(depth: number): Condition {
    const children = [operand(depth)];
    while (operator() === 'AND') {
      position += 1;
      children.push(operand(depth));
    }
    return combine(children, true);
  }

  function or(depth: number): Condition {
    const children = [and(depth)];
    while (operator() === 'OR') {
      position += 1;
      children.push(and(depth));
    }
    return combine(children, false);
  }

  const condition = or(0);
  if (position !== tokens.length) throw new Error(`Unexpected token: ${tokens[position]}`);
  return condition;
}

/** Compile once per run/filter change; evaluate only on demand, once per tag set. */
export function compileTagRules(filters: readonly string[] = []): EvaluateTagRules {
  let conditions: Condition[];
  try {
    conditions = filters.map(compileExpression);
  } catch (error) {
    const result: TagRuleEvaluation = {
      matches: null, contributingTags: [], filters: [],
      error: error instanceof Error ? error.message : String(error),
    };
    return () => result;
  }
  const cache = new Map<string, TagRuleEvaluation>();
  return (tags) => {
    const normalized = new Set([...tags].map((tag) => tag.toLowerCase()).sort());
    const key = JSON.stringify([...normalized]);
    const cached = cache.get(key);
    if (cached) return cached;
    const results = conditions.map((condition) => condition(normalized));
    const matches = results.every((result) => result.matches);
    const result: TagRuleEvaluation = {
      matches,
      contributingTags: matches ? [...new Set(results.flatMap((item) => item.tags))] : [],
      filters: results.map((item, index) => ({
        expression: filters[index], matches: item.matches, reasons: item.reasons,
      })),
    };
    cache.set(key, result);
    return result;
  };
}
