/** Falha de uma ferramenta, devolvida ao modelo em texto curto (nunca lancada para fora). */
export interface ToolError {
  readonly code: 'invalid_args' | 'not_found' | 'timeout' | 'failed' | 'permission_denied' | 'too_large';
  readonly message: string;
}
