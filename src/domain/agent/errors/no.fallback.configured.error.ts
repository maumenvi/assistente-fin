import { AgentError } from './agent.error.ts';

/** Pediram para usar o modelo alternativo, mas nenhum esta configurado (ou ele esta inativo). */
export class NoFallbackConfiguredError extends AgentError {
  public constructor() {
    super('NO_FALLBACK_CONFIGURED', 'nenhum modelo alternativo configurado');
  }
}
