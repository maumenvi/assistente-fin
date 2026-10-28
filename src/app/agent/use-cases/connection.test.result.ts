import { type ModelCapabilities } from '../../../domain/agent/model.capabilities.ts';

/** Por que o teste de conexao falhou (contracts/settings.contract.md). */
export type ConnectionTestError = 'invalid_key' | 'model_unavailable' | 'offline' | 'local_unreachable' | 'quota';

/** Resultado do teste de conexao de um perfil de modelo. Nunca carrega a chave. */
export interface ConnectionTestResult {
  readonly ok: boolean;
  readonly latencyMs: number;
  readonly error?: ConnectionTestError;
  /** O que a sonda confirmou (persistido no perfil); `null` se o teste nem chegou a medir. */
  readonly capabilities: ModelCapabilities | null;
  readonly warnings: readonly string[];
}
