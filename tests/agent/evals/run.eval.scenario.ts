import { type AgentPrompts } from '../../../src/app/agent/prompts/agent.prompts.ts';
import { type LlmPort } from '../../../src/app/agent/ports/llm/llm.port.ts';
import { MemoryAgentSettings } from '../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../src/app/agent/settings/memory.secret.store.ts';
import { buildAgent } from '../../../src/composition/build.agent.ts';
import { DEFAULT_RUN_BUDGET } from '../../../src/domain/agent/default.run.budget.ts';
import { UuidIdGenerator } from '../../../src/libs/id/uuid.id.generator.ts';
import { type EvalDataset } from './dataset/eval.dataset.ts';
import { type EvalRun } from './eval.run.ts';
import { type EvalScenario } from './scenarios/eval.scenario.ts';

/** Foto dos dados do usuario (lancamentos, contas, categorias, ganhos, gastos fixos) para detectar escrita. */
async function dataSnapshot(ds: EvalDataset): Promise<string> {
  const c = ds.container;
  const u = { userId: ds.userId };
  return JSON.stringify([
    await c.listTransactions.execute(u),
    await c.listAccounts.execute(u),
    await c.listCategories.execute(u),
    await c.listIncomes.execute(u),
    await c.listFixedExpenses.execute(u),
  ]);
}

/**
 * Executa UM cenario pelo agente real (grafo, ferramentas de consulta e verificador) sobre a base
 * sintetica, com o modelo dado (`ReplayLlm` nas fixtures, adaptador real no modo ao vivo).
 */
export async function runEvalScenario(ds: EvalDataset, scenario: EvalScenario, llm: LlmPort, options: { readonly prompts?: AgentPrompts } = {}): Promise<EvalRun> {
  const settings = new MemoryAgentSettings(new MemorySecretStore());
  await settings.write(ds.userId, {
    profiles: [{ id: 'main', role: 'main', origin: 'openai_compat_local', baseUrl: 'http://localhost:11434/v1', model: 'avaliacao', enabled: true }],
    localOnly: false,
    limits: { ...DEFAULT_RUN_BUDGET, maxMs: 120_000 },
  });
  let llmCalls = 0;
  const counted: LlmPort = {
    capabilities: llm.capabilities,
    stream: (request, signal) => {
      llmCalls += 1;
      return llm.stream(request, signal);
    },
  };
  const agent = buildAgent({
    store: ds.db.agent,
    toolDeps: ds.container,
    plans: { db: ds.db, writers: ds.container.agentWriters },
    settings,
    secrets: new MemorySecretStore(),
    fetchFn: () => Promise.reject(new Error('a avaliacao nao usa rede')),
    clock: ds.clock,
    ids: new UuidIdGenerator(),
    logSink: null,
    logSource: 'ipc',
    makeLlm: () => Promise.resolve(counted),
    ...(options.prompts === undefined ? {} : { prompts: options.prompts }),
  });
  const toolsCalled: string[] = [];
  agent.events.subscribe((event) => {
    if (event.type === 'step_recorded') toolsCalled.push(...event.step.toolNames);
  });
  const before = await dataSnapshot(ds);
  const startedAt = performance.now();
  const { runId, conversationId } = await agent.sendMessage.execute({ userId: ds.userId, text: scenario.question });
  await agent.runs.settled(runId);
  const ms = performance.now() - startedAt;
  await agent.trace.flush(500);
  const assistant = (await agent.getConversationMessages.execute({ userId: ds.userId, conversationId })).at(-1);
  const run = await ds.db.agent.runs.get(ds.userId, runId);
  const state = run?.state as { ledger?: EvalRun['ledger'] } | undefined;
  return {
    finalText: assistant?.parts.flatMap((p) => (p.type === 'text' ? [p.text] : p.type === 'notice' ? [p.text] : [])).join('\n') ?? '',
    toolsCalled,
    ledger: state?.ledger ?? [],
    noticeKinds: assistant?.parts.flatMap((p) => (p.type === 'notice' ? [p.kind] : [])) ?? [],
    llmCalls,
    wrote: (await dataSnapshot(ds)) !== before,
    costMicroUsd: run?.consumed.costMicroUsd ?? null,
    ms,
    steps: run?.consumed.steps ?? 0,
    tokens: (run?.consumed.inputTokens ?? 0) + (run?.consumed.outputTokens ?? 0),
    errorCode: assistant?.status === 'error' ? (assistant.errorCode ?? 'INTERNAL') : null,
  };
}
