import { type ConnectionReport } from '../../../domain/agent/connection/connection.report.ts';
import { CONNECTION_STEP_IDS } from '../../../domain/agent/connection/connection.step.id.ts';
import { type ConnectionStep } from '../../../domain/agent/connection/connection.step.ts';
import { type KeyInfo } from '../../../domain/agent/connection/key.info.ts';
import { LlmModelNotFoundError } from '../../../domain/agent/errors/llm.model.not.found.error.ts';
import { LlmProtocolError } from '../../../domain/agent/errors/llm.protocol.error.ts';
import { type ModelCapabilities } from '../../../domain/agent/model.capabilities.ts';
import { type FetchFn } from '../../../libs/llm/fetch.fn.ts';
import { presetCapabilities } from '../../../libs/llm/capability.presets.ts';
import { normalizeModelId } from '../../../libs/llm/openai-compat/google.quirks.ts';
import { listModels, listedModelCapabilities, type ListedModel } from '../../../libs/llm/openai-compat/list.models.ts';
import { probeContext } from '../../../libs/llm/openai-compat/probe.context.ts';
import { probeStream } from '../../../libs/llm/openai-compat/probe.stream.ts';
import { probeToolSupport } from '../../../libs/llm/openai-compat/probe.tool.support.ts';
import { ollamaContextLength } from '../../../libs/llm/providers/ollama.process.info.ts';
import { openRouterKeyInfo } from '../../../libs/llm/providers/openrouter.key.info.ts';
import { resolveCapabilities } from '../../../libs/llm/resolve.capabilities.ts';
import { keyLooksLikeOther } from './key.looks.like.other.ts';
import { pickDefaultModel } from './pick.default.model.ts';
import { resolveDraft } from './resolve.draft.ts';
import { type ResolvedDraft } from './resolved.draft.ts';
import { type SetupDeps } from './setup.deps.ts';
import { contextStep } from './steps/context.step.ts';
import { keyStepFromInfo } from './steps/key.step.from.info.ts';
import { keyStepOfLlmError } from './steps/step.of.llm.error.ts';
import { skippedStep } from './steps/skipped.step.ts';
import { type TestSetupInput } from './test.setup.input.ts';

/** Prazo de cada chamada do teste: servidor que nao responde nao trava a tela. */
const CALL_TIMEOUT_MS = 20_000;

/**
 * Teste de conexao em 5 etapas sobre um RASCUNHO (spec 035, contracts/connection.report.md): alcance, chave, modelo,
 * ferramentas e contexto. Uma falha marca as seguintes como `skipped`. Nao grava nada; a chave do rascunho so vive em
 * memoria e nunca aparece no relatorio. O modelo padrao e PROVADO pela sonda (`pickDefaultModel`).
 */
export class TestSetupUseCase {
  private readonly deps: SetupDeps;

  public constructor(deps: SetupDeps) {
    this.deps = deps;
  }

  public async execute(input: TestSetupInput): Promise<ConnectionReport> {
    const draft = await resolveDraft(this.deps, input);
    const steps = new Map<string, ConnectionStep>();
    const put = (step: ConnectionStep): void => void steps.set(step.id, step);
    const local = draft.origin === 'openai_compat_local';
    const base = { baseUrl: draft.baseUrl, ...(draft.apiKey === undefined ? {} : { apiKey: draft.apiKey }), fetchFn: this.deps.fetchFn as FetchFn };
    const signal = (): AbortSignal => AbortSignal.timeout(CALL_TIMEOUT_MS);
    const finish = (model: string | null, capabilities: ModelCapabilities | null, contextTokens: number | null, installed: readonly string[], keyInfo: KeyInfo | null): ConnectionReport => {
      const ordered: ConnectionStep[] = CONNECTION_STEP_IDS.map((id) => steps.get(id) ?? skippedStep(id));
      const ok = ordered.every((s) => s.status !== 'failed');
      return { ok, canSave: ok, steps: ordered, model, capabilities, detected: { contextTokens, installedModels: installed, keyInfo } };
    };

    // 1+2) alcance e chave
    if (draft.needsKey && draft.apiKey === undefined) {
      put(skippedStep('reach'));
      put({ id: 'key', status: 'failed', code: 'key.missing' });
      return finish(null, null, null, [], null);
    }
    let listed: readonly ListedModel[] | null = null;
    try {
      listed = await listModels({ ...base, signal: signal() });
      put({ id: 'reach', status: 'ok', code: 'reach.ok' });
    } catch (error) {
      const failure = keyStepOfLlmError(error, local);
      if (failure.id === 'key') {
        put({ id: 'reach', status: 'ok', code: 'reach.ok' });
        put(this.withLookAlike(failure, draft));
      } else put(failure);
      return finish(null, null, null, [], null);
    }
    const installed = local ? (listed ?? []).map((m) => m.id) : [];
    let keyInfo: KeyInfo | null = null;
    if (!draft.needsKey) put(skippedStep('key', 'key.not_needed'));
    else if (draft.provider?.id === 'openrouter') {
      try {
        keyInfo = await openRouterKeyInfo({ baseUrl: draft.baseUrl, apiKey: draft.apiKey as string, fetchFn: this.deps.fetchFn, signal: signal() });
        put(this.withLookAlike(keyStepFromInfo(keyInfo, this.deps.clock.now()), draft));
      } catch (error) {
        put(this.withLookAlike(keyStepOfLlmError(error, local), draft));
      }
    } else put(this.withLookAlike({ id: 'key', status: 'ok', code: 'key.ok' }, draft));
    const keyStep = steps.get('key') as ConnectionStep;
    if (keyStep.status === 'failed') return finish(null, null, null, installed, keyInfo);

    // 3+4) modelo e ferramentas
    const { model, toolsOk, capabilities: listedCaps } = await this.chooseModel(draft, listed, local, put, signal, input.role ?? 'main');
    if (model === null) return finish(null, null, null, installed, keyInfo);

    // 5) contexto
    const tokens = await this.detectContext(draft, model, listedCaps, local, signal);
    put(contextStep(tokens));
    const capabilities = resolveCapabilities({
      modelId: model,
      listing: listedCaps,
      probe: { tools: toolsOk, verifiedAt: this.deps.clock.now().toISOString(), ...(tokens === null ? {} : { contextWindow: tokens }) },
    });
    return finish(model, capabilities, tokens, installed, keyInfo);
  }

  /** Passos 3 e 4. Devolve `model: null` quando a etapa falhou (o relatorio ja traz o motivo). */
  private async chooseModel(
    draft: ResolvedDraft,
    listed: readonly ListedModel[] | null,
    local: boolean,
    put: (step: ConnectionStep) => void,
    signal: () => AbortSignal,
    role: string,
  ): Promise<{ model: string | null; toolsOk: boolean; capabilities: Partial<ModelCapabilities> }> {
    const common = { baseUrl: draft.baseUrl, ...(draft.apiKey === undefined ? {} : { apiKey: draft.apiKey }), fetchFn: this.deps.fetchFn };
    const none = { model: null, toolsOk: false, capabilities: {} };
    const ids = (listed ?? []).map((m) => m.id);
    try {
      if (draft.model === undefined) {
        if (draft.provider === null) {
          put({ id: 'model', status: 'failed', code: 'model.not_found' });
          return none;
        }
        const picked = await pickDefaultModel({ provider: draft.provider, ...common, listed, signal: signal() });
        if (picked.model === null) {
          put(local ? { id: 'model', status: 'failed', code: 'model.none_installed', detail: { command: picked.suggestedCommand ?? '' } } : { id: 'model', status: 'failed', code: 'model.not_found', detail: { model: draft.provider.autoModel ?? draft.provider.preferredModels[0] ?? '' } });
          return none;
        }
        put(picked.replaced ? { id: 'model', status: 'warn', code: 'model.default_replaced', detail: { model: picked.model } } : { id: 'model', status: 'ok', code: 'model.ok', detail: { model: picked.model } });
        put({ id: 'tools', status: 'ok', code: 'tools.ok', detail: { model: picked.model } });
        return { model: picked.model, toolsOk: true, capabilities: this.listedCaps(listed, picked.model) };
      }
      const model = normalizeModelId(draft.model);
      if (ids.length > 0 && !ids.includes(model)) {
        const suggestion = draft.provider === null ? undefined : [draft.provider.autoModel, ...draft.provider.preferredModels].find((id) => id !== null && (id === draft.provider?.autoModel || ids.includes(id)));
        put({ id: 'model', status: 'failed', code: 'model.not_found', detail: { model, ...(suggestion ? { suggestion } : {}) } });
        return none;
      }
      put({ id: 'model', status: 'ok', code: 'model.ok', detail: { model } });
      const probe = await probeToolSupport({ ...common, model, signal: signal() });
      const streamStage = await this.streamFailure(common, model, signal);
      if (streamStage !== null) {
        put({ id: 'tools', status: 'failed', code: 'tools.stream_incompatible', detail: { model, stage: streamStage } });
        return none;
      }
      const fallback = draft.provider?.autoModel ?? draft.provider?.preferredModels[0] ?? '';
      put(probe.supportsTools ? { id: 'tools', status: 'ok', code: 'tools.ok', detail: { model } } : role === 'main' ? { id: 'tools', status: 'warn', code: 'tools.unsupported', detail: { model, suggestion: fallback } } : { id: 'tools', status: 'ok', code: 'tools.not_required', detail: { model } });
      return { model, toolsOk: probe.supportsTools, capabilities: this.listedCaps(listed, model) };
    } catch (error) {
      if (error instanceof LlmModelNotFoundError || error instanceof LlmProtocolError) {
        put({ id: 'model', status: 'failed', code: 'model.not_found', detail: { model: draft.model ?? '' } });
        return none;
      }
      const failure = keyStepOfLlmError(error, local);
      put(failure.id === 'key' ? failure : { id: 'reach', status: 'failed', code: failure.code });
      return none;
    }
  }

  /** Etapa do stream que falhou para o modelo (formato ilegivel), ou `null` se o formato foi lido (spec 037, FR-017). */
  private async streamFailure(
    common: { baseUrl: string; apiKey?: string; fetchFn: FetchFn | SetupDeps['fetchFn'] },
    model: string,
    signal: () => AbortSignal,
  ): Promise<string | null> {
    try {
      await probeStream({ ...common, fetchFn: common.fetchFn as FetchFn, model, signal: signal() });
      return null;
    } catch (error) {
      return error instanceof LlmProtocolError ? (error.stage ?? 'chunk_invalido') : null;
    }
  }

  private listedCaps(listed: readonly ListedModel[] | null, model: string): Partial<ModelCapabilities> {
    const known = (listed ?? []).find((m) => m.id === model);
    return known === undefined ? {} : listedModelCapabilities(known);
  }

  /** Contexto: local = `/api/ps` (modelo carregado) ou sonda de enchimento; nuvem = listagem ou preset (nunca enchimento). */
  private async detectContext(draft: ResolvedDraft, model: string, listedCaps: Partial<ModelCapabilities>, local: boolean, signal: () => AbortSignal): Promise<number | null> {
    if (!local) return listedCaps.contextWindow ?? presetCapabilities(model).contextWindow ?? null;
    const viaPs = await ollamaContextLength({ baseUrl: draft.baseUrl, model, fetchFn: this.deps.fetchFn, signal: signal() });
    if (viaPs !== null) return viaPs;
    try {
      return await probeContext({ baseUrl: draft.baseUrl, model, fetchFn: this.deps.fetchFn, signal: signal() });
    } catch {
      return null;
    }
  }

  /** Chave de outro provedor: acrescenta o aviso (chave ok) ou a pista (chave recusada). */
  private withLookAlike(step: ConnectionStep, draft: ResolvedDraft): ConnectionStep {
    if (draft.apiKey === undefined) return step;
    const other = keyLooksLikeOther(draft.provider?.id ?? 'custom', draft.apiKey);
    if (other === null) return step;
    if (step.status === 'failed') return { ...step, detail: { ...step.detail, looksLike: other } };
    if (step.status === 'ok') return { id: 'key', status: 'warn', code: 'key.looks_like_other', detail: { looksLike: other, ...step.detail } };
    return step;
  }
}

