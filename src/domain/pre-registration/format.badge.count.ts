/** Texto do contador do sino (spec 022, FR-028): vazio sem pendencias, "99+" acima de 99. */
export function formatBadgeCount(count: number): string {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}
