import { ATTACHMENTS_CONSENT_VERSION } from '../consent/attachments.consent.version.ts';
import { attachmentTextBudget } from '../model/attachment.text.budget.ts';
import { type AttachmentKind } from '../../../../domain/agent/attachment/attachment.kind.ts';
import { type AttachmentStatus } from '../../../../domain/agent/attachment/attachment.status.ts';
import { AttachmentConsentRequiredError } from '../../../../domain/agent/attachment/errors/attachment.consent.required.error.ts';
import { ContextTooSmallForAttachmentError } from '../../../../domain/agent/attachment/errors/context.too.small.for.attachment.error.ts';
import { DraftStillReadingError } from '../../../../domain/agent/attachment/errors/draft.still.reading.error.ts';
import { VisionNotSupportedError } from '../../../../domain/agent/attachment/errors/vision.not.supported.error.ts';
import { type ConsentRecord } from '../../../../domain/agent/consent.record.ts';
import { LocalOnlyViolationError } from '../../../../domain/agent/errors/local.only.violation.error.ts';
import { type AttachmentBlocker } from './attachment.blocker.ts';

/** O que os portoes precisam saber do envio. */
export interface AttachmentGateInput {
  /** "Somente local" ligado. */
  readonly localOnly: boolean;
  /** Algum modelo que vera o anexo (principal, rapido, alternativo) e de nuvem. */
  readonly cloud: boolean;
  /** O modelo principal enxerga imagens. */
  readonly vision: boolean;
  readonly contextWindow: number;
  readonly consent: ConsentRecord | null;
  readonly drafts: readonly { readonly kind: AttachmentKind; readonly status: AttachmentStatus }[];
}

/** Bloqueios vigentes na ORDEM do contrato (o primeiro e o que o envio recusa). Sem anexos => nenhum. */
export function attachmentBlockers(input: AttachmentGateInput): AttachmentBlocker[] {
  if (input.drafts.length === 0) return [];
  const blockers: AttachmentBlocker[] = [];
  if (input.localOnly && input.cloud) blockers.push('local_only');
  if (!input.vision && input.drafts.some((d) => d.kind === 'image')) blockers.push('vision');
  if (input.cloud && !input.localOnly && input.consent?.textVersion !== ATTACHMENTS_CONSENT_VERSION) blockers.push('consent');
  if (input.drafts.some((d) => d.status === 'reading')) blockers.push('reading');
  if (attachmentTextBudget(input.contextWindow, { imageCount: input.vision ? input.drafts.filter((d) => d.kind === 'image').length : 0 }) === null) blockers.push('context_too_small');
  return blockers;
}

/** Lanca o erro de dominio do primeiro bloqueio, antes de qualquer requisicao. */
export function assertAttachmentGates(input: AttachmentGateInput): void {
  const [first] = attachmentBlockers(input);
  if (first === undefined) return;
  switch (first) {
    case 'local_only':
      throw new LocalOnlyViolationError();
    case 'vision':
      throw new VisionNotSupportedError();
    case 'consent':
      throw new AttachmentConsentRequiredError();
    case 'reading':
      throw new DraftStillReadingError();
    case 'context_too_small':
      throw new ContextTooSmallForAttachmentError();
  }
}
