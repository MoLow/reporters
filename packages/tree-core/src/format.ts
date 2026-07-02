const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export function formatDuration(ms: number | undefined): string {
  if (ms == null) return '';
  if (ms < SECOND) return `${Math.round(ms)}ms`;
  // Round to the tier's display precision FIRST, then decompose, so a value
  // that rounds past the tier carries into the next unit ("2m", never "1m 60s").
  const tenths = Math.round((ms / SECOND) * 10) / 10;
  if (tenths < 60) return `${tenths % 1 === 0 ? tenths.toFixed(0) : tenths}s`;
  const seconds = Math.round(ms / SECOND);
  if (seconds < HOUR / SECOND) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  // Hours and beyond (h + m); keeps long-running suites readable.
  const minutes = Math.round(ms / MINUTE);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
