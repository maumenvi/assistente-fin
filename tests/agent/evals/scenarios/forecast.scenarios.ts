import { brl, forecastBalance } from '../dataset/dataset.facts.ts';
import { type EvalScenario } from './eval.scenario.ts';

const MONTHS: readonly (readonly [string, string])[] = [['2026-11', 'novembro'], ['2026-12', 'dezembro'], ['2027-01', 'janeiro'], ['2027-02', 'fevereiro'], ['2027-03', 'março']];

const single: EvalScenario[] = MONTHS.map(([month, name]) => ({
  id: `forecast.saldo.${month}`,
  category: 'forecast',
  question: `Qual o saldo previsto para ${name} de ${month.slice(0, 4)}?`,
  calls: [{ name: 'get_forecast', args: { fromMonth: month } }],
  figures: async (ds) => [brl(await forecastBalance(ds, month))],
  answer: ([balance]) => `A previsão de saldo para ${name} de ${month.slice(0, 4)} é ${balance}.`,
}));

export const FORECAST_SCENARIOS: readonly EvalScenario[] = [
  ...single,
  {
    id: 'forecast.intervalo.nov-dez',
    category: 'forecast',
    question: 'Como fica a previsão de saldo de novembro e dezembro de 2026?',
    calls: [{ name: 'get_forecast', args: { fromMonth: '2026-11', toMonth: '2026-12' } }],
    figures: async (ds) => [brl(await forecastBalance(ds, '2026-11')), brl(await forecastBalance(ds, '2026-12'))],
    answer: ([nov, dez]) => `Previsão de saldo: novembro ${nov} e dezembro ${dez}.`,
  },
];
