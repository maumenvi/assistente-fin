import { InvalidInputError } from '../../../shared/invalid.input.error.ts';
import { effectOfTopic } from '../../../../domain/preference/effect.of.topic.ts';
import { GuardedPolicyError } from '../../../../domain/preference/errors/guarded.policy.error.ts';
import { PreferenceInvalidError } from '../../../../domain/preference/errors/preference.invalid.error.ts';
import { PreferenceNotFoundError } from '../../../../domain/preference/errors/preference.not.found.error.ts';
import { PreferenceSensitiveError } from '../../../../domain/preference/errors/preference.sensitive.error.ts';
import { PreferenceTooVagueError } from '../../../../domain/preference/errors/preference.too.vague.error.ts';
import { checkPreferenceText } from '../../../../domain/preference/guard/check.preference.text.ts';
import { type Preference } from '../../../../domain/preference/preference.ts';
import { type PreferenceScope } from '../../../../domain/preference/preference.scope.ts';
import { reconcilePreferences } from '../reconcile.preferences.ts';
import { parsePreferenceInput } from './parse.preference.input.ts';
import { type PreferenceUseCaseDeps } from './preference.use.case.deps.ts';
import { updatePreferenceInputSchema } from './preference.input.schemas.ts';

/**
 * Edita uma preferencia pela tela (spec 032, US3): texto, estado (ativar/desativar), escopo e
 * privacidade. O texto passa pelas mesmas regras do chat. Ativar uma candidata/tentativa e confirmar.
 * Vale na proxima resposta e sincroniza (`updatedAt` novo). Edicao pode gerar conflito de topico:
 * a mais recente fica (reconcilia).
 */
export class UpdatePreferenceUseCase {
  private readonly deps: PreferenceUseCaseDeps;

  public constructor(deps: PreferenceUseCaseDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<Preference> {
    const input = parsePreferenceInput(updatePreferenceInputSchema, rawInput, 'editar preferencia');
    const { stores, clock } = this.deps;
    const current = await stores.preferences.get(input.userId, input.id);
    if (current === null) throw new PreferenceNotFoundError();

    if (input.text !== undefined) {
      const problem = checkPreferenceText(input.text);
      if (problem === 'policy') throw new GuardedPolicyError();
      if (problem === 'sensitive') throw new PreferenceSensitiveError();
      if (problem === 'vague') throw new PreferenceTooVagueError();
      if (problem === 'invalid') throw new PreferenceInvalidError('de 3 a 200 caracteres, sem links nem valores em reais');
    }
    const scope = input.scope === undefined ? current.scope : await this.resolveScope(input.userId, input.scope);
    const next: Preference = {
      ...current,
      text: input.text?.trim() ?? current.text,
      scope,
      effect: effectOfTopic(current.topic, scope),
      private: input.private ?? current.private,
      status: input.status === undefined ? current.status : input.status,
      supersededBy: input.status === 'active' ? null : current.supersededBy,
      confidence: input.status === 'active' ? Math.max(current.confidence, 0.9) : current.confidence,
      updatedAt: clock.now().toISOString(),
    };
    await stores.preferences.save(next);
    await reconcilePreferences(stores, input.userId, clock.now());
    return (await stores.preferences.get(input.userId, input.id)) ?? next;
  }

  private async resolveScope(userId: string, scope: { kind: 'global' | 'account' | 'category'; id?: string | undefined }): Promise<PreferenceScope> {
    if (scope.kind === 'global') return { kind: 'global' };
    const entities = await this.deps.entities(userId);
    const pool = scope.kind === 'account' ? entities.accounts : entities.categories;
    if (scope.id === undefined || !pool.some((e) => e.id === scope.id)) throw new InvalidInputError('editar preferencia', { scope: ['conta ou categoria nao encontrada'] });
    return { kind: scope.kind, id: scope.id };
  }
}
