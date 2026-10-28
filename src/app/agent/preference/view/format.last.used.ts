/** "nunca usada", "hoje", "ontem", "ha 3 dias", "ha 2 semanas", "ha 4 meses" (spec 032, D10). */
export function formatLastUsed(lastUsedAt: string | null, now: Date): string {
  if (lastUsedAt === null) return 'nunca usada';
  const days = Math.floor((now.getTime() - new Date(lastUsedAt).getTime()) / 86_400_000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 14) return `há ${String(days)} dias`;
  if (days < 60) return `há ${String(Math.floor(days / 7))} semanas`;
  return `há ${String(Math.floor(days / 30))} meses`;
}
