import { type PreRegistrationOrigin } from '../../domain/pre-registration/pre.registration.origin.ts';

/**
 * Origens de pre-registro que contam como captura do celular e geram notificacao (spec 013,
 * RF-12, research R11). `manual` e `simulation` nao sao captura: o proprio usuario digitou ou
 * simulou, nao ha o que revisar.
 */
export const CAPTURE_ORIGINS = ['wallet', 'nfce', 'receipt', 'voice'] as const satisfies readonly PreRegistrationOrigin[];
