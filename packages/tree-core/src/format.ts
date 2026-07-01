const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export function formatDuration(ms: number | undefined): string {
  if (ms == null) return '';
  if (ms < SECOND) return `${Math.round(ms)}ms`;
  if (ms < MINUTE) {
    const rounded = Math.round((ms / SECOND) * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded}s`;
  }
  if (ms < HOUR) {
    return `${Math.floor(ms / MINUTE)}m ${Math.round((ms % MINUTE) / SECOND)}s`;
  }
  // Hours and beyond (h + m); keeps long-running suites readable.
  return `${Math.floor(ms / HOUR)}h ${Math.round((ms % HOUR) / MINUTE)}m`;
}
