import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { consentVersionOf } from '../settings/consent.version.of.ts';
import { type ConsentUseCasesDeps } from './consent.use.cases.deps.ts';
import { recordConsentInputSchema } from './consent.input.schemas.ts';
import { type ConsentView } from './consent.view.ts';

/**
 * Registra o aceite do envio de dados a modelos na nuvem (spec 031, FR-027). So vale para o texto
 * vigente: a tela precisa informar a versao que o usuario leu; versao antiga e recusada.
 */
export class RecordConsentUseCase {
  private readonly deps: ConsentUseCasesDeps;

  public constructor(deps: ConsentUseCasesDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<ConsentView> {
    const parsed = recordConsentInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('registrar consentimento', flat.fieldErrors, flat.formErrors);
    }
    const { userId, kind, textVersion } = parsed.data;
    if (textVersion !== consentVersionOf(kind)) {
      throw new InvalidInputError('registrar consentimento', { textVersion: ['o texto de consentimento mudou; leia a versao atual'] });
    }
    const record = { kind, acceptedAt: this.deps.clock.now().toISOString(), textVersion };
    await this.deps.settings.recordConsent(userId, record);
    return { needed: false, record, textVersion, kind };
  }
}
