// A config that uses named exports instead of a default (exercises the
// `mod.default ?? mod` fallback in loadConfig).
export const local = [{ reporter: 'x', sink: 'stdout' }];
export const ci = [{ reporter: 'y', sink: 'stderr' }];
