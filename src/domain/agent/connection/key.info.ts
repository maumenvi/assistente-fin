/** O que o provedor informa sobre a chave (OpenRouter: `GET /auth/key`); `null` = nao informado. */
export interface KeyInfo {
  readonly limitUsd: number | null;
  readonly remainingUsd: number | null;
  /** ISO 8601; `null` = nao vence. */
  readonly expiresAt: string | null;
}
