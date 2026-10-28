import { utf8ByteLength } from './utf8.byte.length.ts';

/** Limite do `input` serializado, em bytes, acima do qual so um resumo e gravado. */
export const MAX_LOG_INPUT_BYTES = 64 * 1024;

/**
 * Operacoes cujo `input` carrega credencial (senha, codigo, chave, URL de banco com senha,
 * token de bot) e por isso e omitido do log (spec 017, T013 - desvio estreito de RF-12, que
 * cobre dado de negocio, nao segredo). Canais IPC: `ipc.channels.ts`.
 */
export const CREDENTIAL_OPERATIONS: ReadonlySet<string> = new Set([
  'config:test',
  'agent:attachment.open',
  'agent:capabilities.approve',
  'agent:capabilities.credential.set',
  'config:set',
  'session:createFirstUser',
  'session:authenticate',
  'session:requestPasswordReset',
  'session:resetPassword',
  'session:resetPasswordWithRecoveryKey',
  'session:clearCredentials',
  'user:setPassword',
  'user:changePassword',
  'user:regenerateRecoveryKey',
  'verification:confirm',
  'notification:test',
  'notification:set',
  'mcpAccess:generateKey',
  // agente de IA (spec 031, spec 039): o `input` de salvar a configuracao e testar a conexao carrega `apiKey`
  'agent:settings.set',
  'agent:settings.testConnection',
  'agent:settings.saveTier',
  // configuracao simplificada (spec 035): o rascunho do teste e o de salvar carregam `apiKey`
  'agent:setup.test',
  'agent:setup.save',
  // anexos (spec 036): o `input` do preparo carrega os bytes do arquivo
  'agent:attachment.prepare',
  // hub de sync (spec 017, complemento): pareamento e desafio carregam segredo
  'sync:pair',
  'sync:ping',
]);

/**
 * Prepara o `input` para o log: omite (`null`) o de operacoes com credencial e, se o JSON
 * passar de 64 KB, grava `{ truncated, originalBytes, preview }` (limite de tamanho, nao
 * mascaramento - protege contra importacao de backup/NDJSON). Funcao pura; nunca lanca.
 */
export function sanitizeLogInput(operation: string, input: unknown): unknown {
  if (CREDENTIAL_OPERATIONS.has(operation)) return null;
  if (input === undefined) return null;
  let json: string | undefined;
  try {
    json = JSON.stringify(input);
  } catch {
    return { unserializable: true };
  }
  if (json === undefined) return null;
  const bytes = utf8ByteLength(json);
  if (bytes <= MAX_LOG_INPUT_BYTES) return input;
  return { truncated: true, originalBytes: bytes, preview: json.slice(0, 1024) };
}
