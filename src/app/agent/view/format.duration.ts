/** "2,1 s" / "340 ms". */
export function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}
