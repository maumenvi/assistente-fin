import { type ConnectionTestError } from './connection.test.result.ts';

/** Um modelo oferecido pelo servidor do perfil, para a tela escolher. */
export interface AvailableModel {
  readonly id: string;
  readonly contextWindow?: number;
  readonly supportsTools?: boolean;
}

/** Lista de modelos de um perfil; `error` explica por que veio vazia (servidor fora, chave, rede). */
export interface AvailableModelsResult {
  readonly models: readonly AvailableModel[];
  readonly error: ConnectionTestError | null;
}
