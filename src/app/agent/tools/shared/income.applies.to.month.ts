import { type Income } from '../../../../domain/income/income.entity.ts';
import { type MonthRef } from './month.arg.ts';

/**
 * Um ganho vale para o mes quando (mesma regra da tela Ganhos): nao repete e a data cai no mes;
 * ou repete, ja comecou ate o fim do mes e a serie ainda nao terminou.
 */
export function incomeAppliesToMonth(income: Income, month: MonthRef): boolean {
  const start = new Date(Date.UTC(month.year, month.month - 1, 1));
  const end = new Date(Date.UTC(month.year, month.month, 1));
  const date = income.date;
  if (income.recurrence.frequency === 'nao-repete') return date >= start && date < end;
  if (date >= end) return false;
  return income.recurrence.endDate === null || income.recurrence.endDate >= start;
}
