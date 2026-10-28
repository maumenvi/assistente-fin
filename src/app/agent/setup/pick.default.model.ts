import { LlmModelNotFoundError } from '../../../domain/agent/errors/llm.model.not.found.error.ts';
import { LlmProtocolError } from '../../../domain/agent/errors/llm.protocol.error.ts';
import { type ProviderDefinition } from '../../../domain/agent/provider/provider.definition.ts';
import { type FetchFn } from '../../../libs/llm/fetch.fn.ts';
import { type ListedModel } from '../../../libs/llm/openai-compat/list.models.ts';
import { probeToolSupport } from '../../../libs/llm/openai-compat/probe.tool.support.ts';
import { installedModelSize } from './installed.model.size.ts';
import { type PickedDefaultModel } from './picked.default.model.ts';

export interface PickDefaultModelParams {
  readonly provider: ProviderDefinition;
  readonly baseUrl: string;
  readonly apiKey?: string | undefined;
  readonly fetchFn: FetchFn;
  /** Listagem do provedor (`null` = o servidor nao lista; `[]` tambem nao filtra). */
  readonly listed: readonly ListedModel[] | null;
  readonly signal?: AbortSignal | undefined;
}

/** Sondagem de um candidato; erro do proprio modelo (inexistente, recusa de `tools`) = nao serve, o resto lanca. */
async function serves(params: PickDefaultModelParams, model: string): Promise<{ ok: boolean; latencyMs: number }> {
  try {
    const probe = await probeToolSupport({
      baseUrl: params.baseUrl,
      model,
      ...(params.apiKey === undefined ? {} : { apiKey: params.apiKey }),
      fetchFn: params.fetchFn,
      ...(params.signal === undefined ? {} : { signal: params.signal }),
    });
    return { ok: probe.supportsTools, latencyMs: probe.latencyMs };
  } catch (error) {
    if (error instanceof LlmModelNotFoundError || error instanceof LlmProtocolError) return { ok: false, latencyMs: 0 };
    throw error;
  }
}

/** Ollama: instalados que casam com a lista preferida (>= 7B quando o tamanho aparece), na ordem de preferencia. */
function installedCandidates(provider: ProviderDefinition, installed: readonly string[]): string[] {
  const picked: string[] = [];
  for (const preferred of provider.preferredModels) {
    const family = preferred.split(':')[0] as string;
    for (const id of installed) {
      const size = installedModelSize(id);
      if ((id === preferred || id.startsWith(`${family}:`) || id === family) && (size === null || size >= 7) && !picked.includes(id)) picked.push(id);
    }
  }
  return picked;
}

/**
 * Padrao PROVADO (spec 035, R2): cada candidato passa pela sonda de ferramentas e fica o primeiro que passa.
 * Nuvem: `autoModel` (se houver) e depois a lista curta filtrada pela listagem; Ollama: o melhor instalado.
 * Nada e assumido: um padrao sem ferramentas nunca e devolvido.
 */
export async function pickDefaultModel(params: PickDefaultModelParams): Promise<PickedDefaultModel> {
  const { provider, listed } = params;
  const listedIds = listed === null ? [] : listed.map((m) => m.id);
  const hasListing = listedIds.length > 0;
  let candidates: string[];
  if (provider.origin === 'openai_compat_local') candidates = installedCandidates(provider, listedIds);
  else {
    const fromList = provider.preferredModels.filter((id) => !hasListing || listedIds.includes(id));
    candidates = [...(provider.autoModel === null ? [] : [provider.autoModel]), ...fromList];
  }
  for (const model of candidates) {
    const result = await serves(params, model);
    if (!result.ok) continue;
    const ideal = provider.preferredModels[0];
    const replaced = provider.origin !== 'openai_compat_local' && model !== provider.autoModel && ideal !== undefined && model !== ideal && hasListing && !listedIds.includes(ideal);
    return { model, supportsTools: true, latencyMs: result.latencyMs, replaced, suggestedCommand: null };
  }
  const suggestedCommand = provider.origin === 'openai_compat_local' ? `ollama pull ${provider.preferredModels[0] ?? 'qwen3:8b'}` : null;
  return { model: null, supportsTools: false, latencyMs: 0, replaced: false, suggestedCommand };
}
