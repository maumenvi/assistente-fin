import { z } from 'zod';
import { requiresCloudConsent } from '../../../domain/agent/requires.cloud.consent.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { consentVersionOf } from '../settings/consent.version.of.ts';
import { type ConsentUseCasesDeps } from './consent.use.cases.deps.ts';
import { consentUserInputSchema } from './consent.input.schemas.ts';
import { type ConsentView } from './consent.view.ts';

/** Diz se o assistente precisa do consentimento de nuvem agora (modelo principal de nuvem, "somente local" desligado, sem aceite do texto vigente). */
export class GetConsentStatusUseCase {
  private readonly deps: ConsentUseCasesDeps;

  public constructor(deps: ConsentUseCasesDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<ConsentView> {
    const parsed = consentUserInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('situacao do consentimento', flat.fieldErrors, flat.formErrors);
    }
    const { userId, kind } = parsed.data;
    const [settings, record] = await Promise.all([this.deps.settings.read(userId), this.deps.settings.readConsent(userId, kind)]);
    const textVersion = consentVersionOf(kind);
    const main = settings.profiles.find((p) => p.role === 'main' && p.enabled);
    const cloud = main !== undefined && requiresCloudConsent(main.origin) && !settings.localOnly;
    return { needed: cloud && record?.textVersion !== textVersion, record, textVersion, kind };
  }
}
