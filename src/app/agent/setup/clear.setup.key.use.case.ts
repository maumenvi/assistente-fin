import { detectProvider } from '../../../domain/agent/provider/detect.provider.ts';
import { type ProviderId } from '../../../domain/agent/provider/provider.id.ts';
import { type SetupDeps } from './setup.deps.ts';

/** "Apagar chave" de um provedor (spec 035): remove do cofre a chave do perfil principal se ele for desse provedor. */
export class ClearSetupKeyUseCase {
  private readonly deps: SetupDeps;

  public constructor(deps: SetupDeps) {
    this.deps = deps;
  }

  public async execute(input: { readonly userId: string; readonly provider: ProviderId }): Promise<{ readonly hasKey: false }> {
    const settings = await this.deps.settings.read(input.userId);
    const main = settings.profiles.find((p) => p.role === 'main');
    if (main?.keyRef != null && detectProvider(main) === input.provider) await this.deps.secrets.delete(main.keyRef);
    return { hasKey: false };
  }
}
