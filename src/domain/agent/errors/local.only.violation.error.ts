import { AgentError } from './agent.error.ts';

/** Tentativa de usar um modelo de nuvem com o modo "somente local" ligado (FR-028). */
export class LocalOnlyViolationError extends AgentError {
  public constructor() {
    super('LOCAL_ONLY_VIOLATION', 'modo somente local: modelos de nuvem estao desativados');
  }
}
