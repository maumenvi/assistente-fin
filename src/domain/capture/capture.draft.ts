import { type PaymentMethod } from '../simulation/payment.method.ts';

/** Origem de uma captura automatica (spec 022). */
export type CaptureOrigin = 'nfce' | 'receipt' | 'wallet' | 'voice';

/**
 * Rascunho de pre-registro produzido por uma captura (spec 022, contracts/capture-parsers.md).
 * Campo ausente = nao identificado; `confidence: 'low'` vira "conferir" no pre-registro.
 */
export interface CaptureDraft {
  readonly origin: CaptureOrigin;
  readonly amountCents?: number | undefined;
  /** "AAAA-MM-DD". */
  readonly date?: string | undefined;
  readonly description?: string | undefined;
  /** Texto citado para a conta/cartao ("iti", "final 4412") antes de casar com uma conta real. */
  readonly accountHint?: string | undefined;
  readonly paymentMethod?: PaymentMethod | undefined;
  readonly installments?: number | undefined;
  readonly notes?: string | undefined;
  /** Link da NFC-e (para achar a mesma nota ja registrada). */
  readonly link?: string | undefined;
  readonly dedupKey?: string | undefined;
  readonly confidence: 'high' | 'low';
}
