export function formatDuration(ms: number | undefined): string {
  if (ms == null) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) {
    const seconds = ms / 1000;
    const rounded = Math.round(seconds * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
