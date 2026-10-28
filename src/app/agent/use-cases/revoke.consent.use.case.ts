import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type ConsentUseCasesDeps } from './consent.use.cases.deps.ts';
import { consentUserInputSchema } from './consent.input.schemas.ts';
import { GetConsentStatusUseCase } from './get.consent.status.use.case.ts';
import { type ConsentView } from './consent.view.ts';

/** Revoga o consentimento (apaga o registro): o proximo envio a nuvem pede de novo. */
export class RevokeConsentUseCase {
  private readonly deps: ConsentUseCasesDeps;

  public constructor(deps: ConsentUseCasesDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<ConsentView> {
    const parsed = consentUserInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('revogar consentimento', flat.fieldErrors, flat.formErrors);
    }
    await this.deps.settings.revokeConsent(parsed.data.userId, parsed.data.kind);
    return new GetConsentStatusUseCase(this.deps).execute(parsed.data);
  }
}
