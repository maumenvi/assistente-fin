import { type Month } from '../../domain/shared/month.value.object.ts';

/**
 * Devolve a data (UTC, meia-noite) do dia `anchorDay` dentro de `targetMonth`, "grudando" no
 * ultimo dia do mes quando `anchorDay` nao existir nele (ex.: ancora dia 31, mes-alvo
 * fevereiro -> cai no ultimo dia de fevereiro daquele ano, bissexto ou nao).
 *
 * Usado por `LaunchIncomeMonthUseCase` (spec 012, RF-3) para decidir em que dia do mes pedido
 * cai o lancamento avulso, preservando o "dia de referencia" do `Income` sempre que couber.
 */
export function clampDayInMonth(anchorDay: number, targetMonth: Month): Date {
  // dia 0 do "mes seguinte" = ultimo dia do mes-alvo (truque padrao de calculo de calendario)
  const lastDayOfTargetMonth = new Date(Date.UTC(targetMonth.year, targetMonth.month, 0)).getUTCDate();
  const day = Math.min(anchorDay, lastDayOfTargetMonth);
  return new Date(Date.UTC(targetMonth.year, targetMonth.month - 1, day));
}
