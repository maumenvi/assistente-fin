import { type ConnectionStepId } from '../../../domain/agent/connection/connection.step.id.ts';
import { type ConnectionStepStatus } from '../../../domain/agent/connection/connection.step.status.ts';
import { type ReportAction } from './report.action.ts';

/** Uma etapa do relatorio em portugues, pronta para as duas telas (mesmo texto no desktop e no Android). */
export interface DescribedStep {
  readonly id: ConnectionStepId;
  readonly status: ConnectionStepStatus;
  readonly title: string;
  readonly detail: string;
  readonly action?: ReportAction;
}
