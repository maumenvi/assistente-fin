import { type AgentOp } from '../format/agent.op.ts';
import { type Inspection } from './operation.handler.ts';

/** Resumo de uma operacao para a tela: valor, data, parcelas e rotulo (spec 029, FR-010). */
export interface OpDescription {
  readonly label: string | null;
  readonly amountCents: number | null;
  readonly date: string | null;
  readonly installments: number | null;
}

const number = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** Descreve a operacao: dos dados novos em `create`; do estado atual (e dos dados novos por cima) nas demais. */
export function describePlannedOp(op: AgentOp, inspection: Inspection): OpDescription {
  const data = op.data ?? {};
  const amount =
    number(data['amountCents']) ?? number(data['expectedAmountCents']) ?? number(data['maxAmountCents']) ??
    number(inspection.display['amountCents']) ?? number(inspection.display['expectedAmountCents']) ?? number(inspection.display['maxAmountCents']);
  const date = text(data['date']) ?? text(inspection.display['date']);
  return {
    label: text(data['notes']) ?? text(data['source']) ?? text(data['description']) ?? text(data['name']) ?? inspection.label,
    amountCents: amount,
    date: date === null ? null : date.slice(0, 10),
    installments: number(data['installments']) ?? number(inspection.display['installments']),
  };
}
