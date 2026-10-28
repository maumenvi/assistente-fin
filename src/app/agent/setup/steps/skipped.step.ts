import { type ConnectionStepId } from '../../../../domain/agent/connection/connection.step.id.ts';
import { type ConnectionStep } from '../../../../domain/agent/connection/connection.step.ts';

/** Etapa nao verificada (uma anterior falhou ou ela nao se aplica). */
export function skippedStep(id: ConnectionStepId, code = `${id}.skipped`): ConnectionStep {
  return { id, status: 'skipped', code };
}
