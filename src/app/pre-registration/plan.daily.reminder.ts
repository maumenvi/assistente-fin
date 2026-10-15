import { formatBadgeCount } from '../../domain/pre-registration/format.badge.count.ts';
import { type DailyReminderPlan } from './daily.reminder.plan.ts';

const DEFAULT_TIME = { hour: 10, minute: 0 };

/** Configuracao do lembrete (subconjunto das configuracoes do aparelho). */
export interface ReminderSettings {
  readonly enabled: boolean;
  /** "HH:MM", entre 08:00 e 18:00. */
  readonly time: string;
  readonly weekdaysOnly: boolean;
}

function parseBusinessTime(time: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || time < '08:00' || time > '18:00') return DEFAULT_TIME;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/**
 * Decide o lembrete diario (spec 022, FR-030): uma notificacao por dia, em horario comercial,
 * so quando ha pendencias. O app chama sempre que a contagem muda (e ao abrir), entao o texto
 * agendado reflete a contagem atual sem precisar de tarefa em segundo plano.
 */
export function planDailyReminder(pendingCount: number, settings: ReminderSettings): DailyReminderPlan {
  if (!settings.enabled || pendingCount <= 0) return { action: 'cancel' };
  const { hour, minute } = parseBusinessTime(settings.time);
  const label = formatBadgeCount(pendingCount);
  return {
    action: 'schedule',
    title: 'Pendências para resolver',
    body: `Você tem ${label} ${pendingCount === 1 ? 'pendência' : 'pendências'} para revisar. Toque para resolver.`,
    hour,
    minute,
    weekdays: settings.weekdaysOnly ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7],
  };
}
