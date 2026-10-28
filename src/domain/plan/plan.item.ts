import { type OperationKind } from './operation.kind.ts';
import { type PlanFlag } from './plan.flag.ts';

/** Item do plano: operacao com antes/depois legiveis (data-model.md 2). */
export interface PlanItem {
  readonly id: string;
  readonly kind: OperationKind;
  /** Entrada da operacao (validada pelo adaptador); valores em centavos, datas ISO. */
  readonly input: Readonly<Record<string, unknown>>;
  readonly label: string;
  /** Valor movimentado em centavos (para os limites da autonomia); `null` quando nao ha valor. */
  readonly amountCents: number | null;
  readonly before: readonly string[] | null;
  readonly after: readonly string[];
  readonly confidence: number;
  readonly flags: readonly PlanFlag[];
  readonly selected: boolean;
  readonly source: 'model' | 'rule';
  /** Item montado a partir do conteudo de um anexo (spec 036): nunca e aplicado sozinho pela autonomia. */
  readonly origin?: 'attachment';
  readonly attachmentId?: string;
  /** Impressao digital dos registros afetados quando o plano foi montado (revalidacao). */
  readonly beforeFingerprint: string;
}
