import { type ConnectionStep } from '../../../../domain/agent/connection/connection.step.ts';
import { type KeyInfo } from '../../../../domain/agent/connection/key.info.ts';

const DAY_MS = 86_400_000;

/** Etapa da chave a partir do que o OpenRouter informa: vencida, sem credito, vencendo em ate 7 dias ou ok. */
export function keyStepFromInfo(info: KeyInfo, now: Date): ConnectionStep {
  if (info.expiresAt !== null) {
    const left = new Date(info.expiresAt).getTime() - now.getTime();
    if (Number.isFinite(left) && left <= 0) return { id: 'key', status: 'failed', code: 'key.expired' };
    if (Number.isFinite(left) && left <= 7 * DAY_MS) return { id: 'key', status: 'warn', code: 'key.expiring', detail: { days: Math.max(1, Math.ceil(left / DAY_MS)) } };
  }
  if (info.remainingUsd !== null && info.remainingUsd <= 0) return { id: 'key', status: 'failed', code: 'key.no_credit' };
  return { id: 'key', status: 'ok', code: 'key.ok', ...(info.remainingUsd === null ? {} : { detail: { remainingUsd: Math.round(info.remainingUsd * 100) / 100 } }) };
}
