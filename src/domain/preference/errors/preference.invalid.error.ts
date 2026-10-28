import { AgentError } from '../../agent/errors/agent.error.ts';

/** Texto de preferencia invalido: vazio, longo demais, com URL ou valor monetario. */
export class PreferenceInvalidError extends AgentError {
  public constructor(reason: string) {
    super('PREFERENCE_INVALID', `preferencia invalida: ${reason}`);
  }
}
