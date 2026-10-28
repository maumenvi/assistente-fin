import { z } from 'zod';
import { LocalOnlyViolationError } from '../../../../domain/agent/errors/local.only.violation.error.ts';
import { requiresCloudConsent } from '../../../../domain/agent/requires.cloud.consent.ts';
import { InvalidInputError } from '../../../shared/invalid.input.error.ts';
import { ATTACHMENT_LIMITS } from '../../../../domain/agent/attachment/attachment.limits.ts';
import { type MakeLlm } from '../../llm/build.role.llms.ts';
import { type AgentSettingsPort } from '../../ports/settings/agent.settings.port.ts';
import { type AttachmentDraftStore } from '../draft/attachment.draft.store.ts';
import { type AttachmentBlocker } from './attachment.blocker.ts';
import { attachmentBlockers } from './check.attachment.gates.ts';

const inputSchema = z.object({ userId: z.string().trim().min(1), draftIds: z.array(z.string().trim().min(1).max(100)).max(ATTACHMENT_LIMITS.maxPerMessage), hold: z.boolean().optional() });

/** Pre-checagem das telas antes do envio. */
export interface AttachmentCheckResult {
  readonly blockers: readonly AttachmentBlocker[];
  /** O envio pediria o aviso de privacidade de anexos (modelo de nuvem sem consentimento vigente). */
  readonly needsConsent: boolean;
  /** Algum modelo que leria os anexos e de nuvem (o conteudo sairia do aparelho). */
  readonly cloud: boolean;
}

/** Dependencias de `CheckAttachmentsUseCase`. */
export interface CheckAttachmentsDeps {
  readonly settings: AgentSettingsPort;
  readonly drafts: AttachmentDraftStore;
  readonly makeLlm: MakeLlm;
}

/**
 * Diz, SEM enviar nada, o que bloquearia o envio dos rascunhos de agora (contracts/consent.md). E so conforto da tela: o envio
 * refaz as mesmas conferencias no servidor (`assertAttachmentGates`) e nunca confia nesta resposta.
 */
export class CheckAttachmentsUseCase {
  private readonly deps: CheckAttachmentsDeps;

  public constructor(deps: CheckAttachmentsDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<AttachmentCheckResult> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('conferir anexos', flat.fieldErrors, flat.formErrors);
    }
    const { userId, draftIds } = parsed.data;
    const settings = await this.deps.settings.read(userId);
    const drafts = draftIds.map((id) => this.deps.drafts.get(userId, id));
    // sem conexao o envio aguarda: o rascunho nao expira enquanto houver envio pendente (spec 036, FR-017)
    if (parsed.data.hold === true) for (const id of draftIds) this.deps.drafts.pin(userId, id);
    const active = (role: 'main' | 'fast' | 'fallback') => settings.profiles.find((p) => p.role === role && p.enabled);
    const main = active('main');
    const cloud = [main, active('fast'), active('fallback')].some((p) => p !== undefined && requiresCloudConsent(p.origin));
    if (main === undefined || drafts.length === 0) return { blockers: [], needsConsent: false, cloud };
    if (settings.localOnly && requiresCloudConsent(main.origin)) return { blockers: ['local_only'], needsConsent: false, cloud };
    let capabilities;
    try {
      capabilities = (await this.deps.makeLlm(main)).capabilities;
    } catch (error) {
      if (error instanceof LocalOnlyViolationError) return { blockers: ['local_only'], needsConsent: false, cloud };
      throw error;
    }
    const consent = await this.deps.settings.readConsent(userId, 'attachments');
    const blockers = attachmentBlockers({ localOnly: settings.localOnly, cloud, vision: capabilities.vision, contextWindow: capabilities.contextWindow, consent, drafts });
    return { blockers, needsConsent: blockers.includes('consent'), cloud };
  }
}
