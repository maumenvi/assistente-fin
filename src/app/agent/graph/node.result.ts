import { type End } from './end.ts';
import { type StepDetail } from './step.detail.ts';

/** Resultado de um no: o proximo no (ou `END`), o novo estado (imutavel) e, se houver, o detalhe do passo. */
export interface NodeResult<Next extends string, State> {
  readonly next: Next | End;
  readonly state: State;
  readonly detail?: StepDetail;
}
