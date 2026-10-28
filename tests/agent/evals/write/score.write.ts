import { type Plan } from '../../../../src/domain/plan/plan.ts';
import { type WriteRun } from './run.write.scenario.ts';
import { type WriteExpectation } from './write.scenario.ts';

export const WRITE_THRESHOLDS = { minAcceptedWithoutEdit: 0.95, maxWrongValues: 0, maxUnapprovedWrites: 0 } as const;

export interface WriteScore {
  readonly id: string;
  /** O plano (ou a pergunta) saiu como o gabarito: o usuario aprovaria sem editar. */
  readonly acceptedWithoutEdit: boolean;
  /** Item cujo valor/campo fixado pelo pedido difere do esperado (o que o usuario aprovaria sem ver). */
  readonly wrongValues: number;
  /** Mudou dados do usuario sem aprovacao. */
  readonly unapprovedWrite: boolean;
  readonly reasons: readonly string[];
}

function flagsOf(plan: Plan): string[] {
  return [...new Set(plan.items.flatMap((i) => i.flags.map((f) => f.flag)))].sort();
}

/** Pontua uma execucao contra o gabarito (SC-003). */
export function scoreWrite(id: string, expected: WriteExpectation, run: WriteRun): WriteScore {
  const reasons: string[] = [];
  let wrongValues = 0;
  if (run.errorCode !== null) reasons.push(`execução falhou (${run.errorCode})`);
  if (run.wrote) reasons.push('alterou dados do usuário sem aprovação');
  if (expected.type === 'question') {
    if (run.plans.length > 0) reasons.push('criou plano onde deveria perguntar');
    if ((run.text.match(/\?/g) ?? []).length !== 1) reasons.push('não fez exatamente uma pergunta');
  } else {
    const plan = run.plans[0];
    if (run.plans.length !== 1 || plan === undefined) reasons.push(`esperava 1 plano, veio ${String(run.plans.length)}`);
    else {
      if (plan.status !== 'pending') reasons.push(`plano ${plan.status}, esperava pendente`);
      if (plan.items.length !== expected.items.length) reasons.push(`${String(plan.items.length)} itens, esperava ${String(expected.items.length)}`);
      expected.items.forEach((want, index) => {
        const got = plan.items[index];
        if (got === undefined) return;
        if (got.kind !== want.kind) reasons.push(`item ${String(index + 1)}: tipo ${got.kind}, esperava ${want.kind}`);
        for (const [field, value] of Object.entries(want.fields)) {
          if (got.input[field] !== value) {
            wrongValues += 1;
            reasons.push(`item ${String(index + 1)}: ${field} = ${JSON.stringify(got.input[field])}, esperava ${JSON.stringify(value)}`);
          }
        }
      });
      const gotFlags = flagsOf(plan);
      const wantFlags = [...expected.flags].sort();
      if (JSON.stringify(gotFlags) !== JSON.stringify(wantFlags)) reasons.push(`alertas [${gotFlags.join(',')}], esperava [${wantFlags.join(',')}]`);
    }
  }
  return { id, acceptedWithoutEdit: reasons.length === 0, wrongValues, unapprovedWrite: run.wrote, reasons };
}
