import { MemoryAgentSettings } from '../../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../../src/app/agent/settings/memory.secret.store.ts';
import { buildAgent } from '../../../../src/composition/build.agent.ts';
import { DEFAULT_RUN_BUDGET } from '../../../../src/domain/agent/default.run.budget.ts';
import { type Plan } from '../../../../src/domain/plan/plan.ts';
import { UuidIdGenerator } from '../../../../src/libs/id/uuid.id.generator.ts';
import { ReplayLlm } from '../../../../src/libs/llm/replay/replay.llm.ts';
import { type ReplayTurn } from '../../../../src/libs/llm/replay/replay.turn.ts';
import { TOOLS_CAPABILITIES } from '../../nodes/support/node.harness.ts';
import { type EvalDataset } from '../dataset/eval.dataset.ts';
import { type WriteScenario } from './write.scenario.ts';

/** Foto dos dados do usuario para provar que o pedido NAO gravou nada. */
async function dataSnapshot(ds: EvalDataset): Promise<string> {
  const c = ds.container;
  const u = { userId: ds.userId };
  return JSON.stringify([await c.listTransactions.execute(u), await c.listAccounts.execute(u), await c.listCategories.execute(u), await c.listIncomes.execute(u), await c.listFixedExpenses.execute(u)]);
}

export interface WriteRun {
  readonly plans: readonly Plan[];
  readonly text: string;
  readonly wrote: boolean;
  readonly errorCode: string | null;
}

/** Modelo "correto": chama `propose_changes` com o gabarito (ou pergunta). Um modelo degradado altera os argumentos. */
export type ProposeTransform = (args: Record<string, unknown>) => Record<string, unknown>;

/** Roda UM cenario pelo agente real (grafo, ferramentas, motor de planos e verificacao) sobre a base sintetica. */
export async function runWriteScenario(ds: EvalDataset, scenario: WriteScenario, options: { readonly transform?: ProposeTransform } = {}): Promise<WriteRun> {
  const settings = new MemoryAgentSettings(new MemorySecretStore());
  await settings.write(ds.userId, {
    profiles: [{ id: 'main', role: 'main', origin: 'openai_compat_local', baseUrl: 'http://localhost:11434/v1', model: 'avaliacao', enabled: true }],
    localOnly: false,
    limits: { ...DEFAULT_RUN_BUDGET, maxMs: 120_000 },
  });
  const question = typeof scenario.question === 'string' ? scenario.question : await scenario.question(ds);
  const proposed = scenario.propose === null ? null : await scenario.propose(ds);
  const args = proposed === null ? null : (options.transform ? options.transform(proposed) : proposed);
  const turns: ReplayTurn[] =
    args === null
      ? [{ events: [{ type: 'text_delta', text: 'De qual conta isso saiu?' }, { type: 'finish', reason: 'stop' }] }]
      : [
          { events: [{ type: 'tool_call', id: 'c1', name: 'propose_changes', args }, { type: 'finish', reason: 'tool_calls' }] },
          { events: [{ type: 'text_delta', text: 'Montei o plano; ele só vale depois da sua aprovação.' }, { type: 'finish', reason: 'stop' }] },
        ];
  const agent = buildAgent({
    store: ds.db.agent, toolDeps: ds.container, plans: { db: ds.db, writers: ds.container.agentWriters }, settings, secrets: new MemorySecretStore(),
    fetchFn: () => Promise.reject(new Error('a avaliacao nao usa rede')), clock: ds.clock, ids: new UuidIdGenerator(), logSink: null, logSource: 'ipc',
    makeLlm: () => Promise.resolve(new ReplayLlm(TOOLS_CAPABILITIES, turns)),
  });
  const before = await dataSnapshot(ds);
  const { runId, conversationId } = await agent.sendMessage.execute({ userId: ds.userId, text: question });
  await agent.runs.settled(runId);
  const assistant = (await agent.getConversationMessages.execute({ userId: ds.userId, conversationId })).at(-1);
  const plans = await agent.plans.list(ds.userId, { limit: 20 });
  return {
    plans: plans.filter((p) => p.runId === runId),
    text: assistant?.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('\n') ?? '',
    wrote: (await dataSnapshot(ds)) !== before,
    errorCode: assistant?.status === 'error' ? (assistant.errorCode ?? 'INTERNAL') : null,
  };
}
