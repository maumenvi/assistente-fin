import { Money } from '../../domain/shared/money.value.object.ts';
import { type NewCapture } from './new.capture.ts';

/**
 * Titulo e mensagem da notificacao de capturas de um lote (spec 013, RF-12): nenhuma -> `null`
 * (nada a emitir); uma -> valor e/ou descricao ("R$ 42,90 — Mercado"); varias -> so a contagem,
 * para nao virar uma rajada de avisos.
 */
export function describeNewCaptures(captures: readonly NewCapture[]): { title: string; message: string } | null {
  if (captures.length === 0) return null;
  if (captures.length > 1) {
    return { title: 'Capturas do celular', message: `${captures.length} novas capturas do celular para revisar` };
  }
  const [capture] = captures as [NewCapture];
  const parts: string[] = [];
  if (capture.amountCents !== null) parts.push(Money.fromCents(capture.amountCents).format());
  if (capture.description !== null) parts.push(capture.description);
  return { title: 'Captura do celular', message: parts.length > 0 ? parts.join(' — ') : 'Nova captura para revisar' };
}
