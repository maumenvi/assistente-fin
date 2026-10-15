import { type PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { type CaptureResult } from './capture.result.ts';

/**
 * Pre-registro de uma captura que SEMPRE cria (NFC-e, recibo, voz - sem recibo de carteira, spec
 * 027). Um `null` aqui e erro de programacao: so a carteira pode ignorar uma captura repetida.
 */
export function requireCapturedPreRegistration(result: CaptureResult): PreRegistration {
  if (result.preRegistration === null) throw new Error(`captura nao gerou pre-registro (${result.decision})`);
  return result.preRegistration;
}
