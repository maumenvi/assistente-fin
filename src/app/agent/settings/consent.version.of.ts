import { type ConsentKind } from '../../../domain/agent/consent.record.ts';
import { ATTACHMENTS_CONSENT_VERSION } from '../attachment/consent/attachments.consent.version.ts';
import { CLOUD_CONSENT_VERSION } from './cloud.consent.version.ts';

/** Versao vigente do texto de cada tipo de consentimento. */
export function consentVersionOf(kind: ConsentKind): string {
  return kind === 'attachments' ? ATTACHMENTS_CONSENT_VERSION : CLOUD_CONSENT_VERSION;
}
