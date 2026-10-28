import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AgentSettingsView } from '../settings/agent.settings.view.ts';
import { toAgentSettingsView } from '../settings/to.agent.settings.view.ts';
import { type AgentSettings } from '../ports/settings/agent.settings.ts';
import { type ConfigureModelsDeps } from './configure.models.deps.ts';
import { getModelsInputSchema, setModelsInputSchema } from './configure.models.input.schemas.ts';

/**
 * Le e salva a configuracao dos modelos (spec 031, T100, contracts/settings.contract.md). Regras
 * na fronteira: um perfil por papel; servidor local so quando a borda permite (desktop); endereco
 * `https://` (ou `http://` so para localhost); limites por pedido (1-50 passos, 5-300 s, US$ 0,01-5,00).
 * A chave so entra por `apiKey` e vai ao cofre; a visao devolvida nunca a contem (so `hasKey`).
 */
export class ConfigureModelsUseCase {
  private readonly deps: ConfigureModelsDeps;

  public constructor(deps: ConfigureModelsDeps) {
    this.deps = deps;
  }

  public async get(rawInput: unknown): Promise<AgentSettingsView> {
    const parsed = getModelsInputSchema.safeParse(rawInput);
    if (!parsed.success) this.fail('ler a configuracao do assistente', parsed.error);
    return this.view(await this.deps.settings.read((parsed.data as { userId: string }).userId));
  }

  public async set(rawInput: unknown): Promise<AgentSettingsView> {
    const parsed = setModelsInputSchema.safeParse(rawInput);
    if (!parsed.success) this.fail('salvar a configuracao do assistente', parsed.error);
    const { userId, ...input } = parsed.data as z.infer<typeof setModelsInputSchema>;
    if (!this.deps.allowLocal && input.profiles.some((p) => p.origin === 'openai_compat_local')) {
      throw new InvalidInputError('salvar a configuracao do assistente', { profiles: ['modelos locais so existem no desktop'] });
    }
    return this.view(await this.deps.settings.write(userId, input));
  }

  private async view(settings: AgentSettings): Promise<AgentSettingsView> {
    const withKey = new Set<string>();
    for (const profile of settings.profiles) {
      if (profile.keyRef !== null && (await this.deps.secrets.get(profile.keyRef)) !== null) withKey.add(profile.keyRef);
    }
    return toAgentSettingsView(settings, (ref) => withKey.has(ref));
  }

  private fail(context: string, error: z.ZodError): never {
    const flat = z.flattenError(error);
    throw new InvalidInputError(context, flat.fieldErrors as Record<string, string[]>, flat.formErrors);
  }
}
