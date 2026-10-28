import { SetupNotTestedError } from '../../../domain/agent/errors/setup.not.tested.error.ts';
import { type AgentSettingsInput } from '../ports/settings/agent.settings.input.ts';
import { type ModelProfileInput } from '../ports/settings/model.profile.input.ts';
import { cleanApiKey } from './clean.api.key.ts';
import { GetSetupViewUseCase } from './get.setup.view.use.case.ts';
import { resolveDraft } from './resolve.draft.ts';
import { type SetupDeps } from './setup.deps.ts';
import { type SetupDraft } from './setup.draft.ts';
import { type SetupView } from './setup.view.ts';
import { TestSetupUseCase } from './test.setup.use.case.ts';

/** Entrada de `SaveSetupUseCase`. */
export interface SaveSetupInput {
  readonly userId: string;
  readonly draft: SetupDraft;
  /** O usuario confirmou os avisos (`warn`) do teste. */
  readonly confirmWarnings?: boolean | undefined;
}

/**
 * Grava o perfil PRINCIPAL a partir da tela simples (spec 035, FR-010). Reexecuta o teste no servidor (nao confia no
 * cliente) e so grava se nao houve falha; `warn` exige `confirmWarnings`. Perfil + chave vao juntos: se a chave nao
 * entra no cofre, nada e gravado. Rapido, alternativo e limites ficam como estavam.
 */
export class SaveSetupUseCase {
  private readonly deps: SetupDeps;
  private readonly tester: TestSetupUseCase;
  private readonly getView: GetSetupViewUseCase;

  public constructor(deps: SetupDeps) {
    this.deps = deps;
    this.tester = new TestSetupUseCase(deps);
    this.getView = new GetSetupViewUseCase(deps);
  }

  public async execute(input: SaveSetupInput): Promise<{ readonly saved: true; readonly view: SetupView }> {
    const report = await this.tester.execute({ userId: input.userId, draft: input.draft });
    const warned = report.steps.some((s) => s.status === 'warn');
    if (!report.canSave || report.model === null || (warned && input.confirmWarnings !== true)) throw new SetupNotTestedError(report);
    const draft = await resolveDraft(this.deps, { userId: input.userId, draft: input.draft });
    const current = await this.deps.settings.read(input.userId);
    const apiKey = cleanApiKey(input.draft.apiKey);
    const main: ModelProfileInput = {
      id: 'main',
      role: 'main',
      origin: draft.origin,
      baseUrl: draft.baseUrl,
      model: report.model,
      enabled: true,
      capabilities: report.capabilities ?? undefined,
      ...(apiKey === undefined || !draft.needsKey ? {} : { apiKey }),
    };
    const others: ModelProfileInput[] = current.profiles.filter((p) => p.id !== 'main').map(({ keyRef: _keyRef, ...rest }) => rest);
    const next: AgentSettingsInput = { profiles: [main, ...others], localOnly: current.localOnly, limits: current.limits };
    await this.deps.settings.write(input.userId, next);
    return { saved: true, view: await this.getView.execute(input.userId) };
  }
}
