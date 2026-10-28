import { redactSecrets } from '../safety/redact.secrets.ts';

/** Motivo curto e legivel de uma falha de conexao/leitura (sem segredos), para o pedido e o modelo. */
export function describeError(error: unknown, secrets: readonly string[] = []): string {
  const message = error instanceof Error && error.message !== '' ? error.message : 'falha desconhecida';
  return redactSecrets(message, secrets).slice(0, 240);
}
