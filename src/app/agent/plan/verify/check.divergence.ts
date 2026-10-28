import { type PlanFlag } from '../../../../domain/plan/plan.flag.ts';
import { extractFigures } from '../../verify/extract.figures.ts';
import { formatBrl } from '../../verify/format.brl.ts';
import { type OperationInput } from '../operations/operation.adapter.ts';

/**
 * Valor ou data do item que o usuario nao escreveu nem aparece em consulta da execucao: o modelo pode
 * ter trocado o numero. Compara so o que o item informa explicitamente (`amountCents`, `date`).
 */
export function checkDivergence(input: OperationInput, userText: string, knownMoneyCents: ReadonlySet<number>): PlanFlag[] {
  const figures = extractFigures(userText);
  const flags: PlanFlag[] = [];
  const amount = input['amountCents'] ?? input['expectedAmountCents'];
  if (typeof amount === 'number') {
    const written = figures.filter((f) => f.kind === 'money').map((f) => Number(f.normalized));
    if (!written.includes(amount) && !knownMoneyCents.has(amount)) {
      flags.push({ flag: 'diverges', text: written.length > 0 ? `valor ${formatBrl(amount)} difere do que voce escreveu (${written.map(formatBrl).join(', ')})` : `valor ${formatBrl(amount)} nao veio do seu pedido nem de uma consulta` });
    }
  }
  const date = input['date'];
  if (typeof date === 'string') {
    const written = figures.filter((f) => f.kind === 'date').map((f) => f.normalized);
    const matches = written.some((w) => w === date.slice(0, 10) || (w.length === 5 && date.slice(5, 10) === w));
    if (written.length > 0 && !matches) flags.push({ flag: 'diverges', text: `data ${date.slice(0, 10)} difere da que voce escreveu (${figures.filter((f) => f.kind === 'date').map((f) => f.raw).join(', ')})` });
  }
  return flags;
}
