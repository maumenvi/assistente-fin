import { CompactionTask } from '../../../../src/app/agent/compaction/compaction.task.ts';
import { composeSystem } from '../../../../src/app/agent/context/compose.system.ts';
import { CompactingContextStrategy } from '../../../../src/app/agent/context/compacting.context.strategy.ts';
import { MemoryAgentEvents } from '../../../../src/app/agent/events/memory.agent.events.ts';
import { DEFAULT_AGENT_PROMPTS } from '../../../../src/app/agent/prompts/default.agent.prompts.ts';
import { FakeAgentStore } from '../../../../src/database/fake/agent.store.fake.ts';
import { FakePreferenceStores } from '../../../../src/database/fake/preference.stores.fake.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../../src/domain/agent/conservative.capabilities.ts';
import { type LlmPort } from '../../../../src/app/agent/ports/llm/llm.port.ts';
import { makeConversation } from '../../store/support/agent.fixtures.ts';
import { CollectingAgentLog } from '../../trace/support.ts';
import { MutableClock } from '../../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../../support/sequential.id.generator.ts';
import { type CompactionScenario } from './compaction.scenario.ts';

/** O que uma execucao de cenario devolve para a pontuacao. */
export interface CompactionRun {
  readonly scenarioId: string;
  readonly compactions: number;
  readonly totalMessages: number;
  readonly storedMessages: number;
  /** Sistema + mensagens que o modelo receberia na pergunta de controle, como texto. */
  readonly context: string;
  /** O prefixo (sistema + literais) montado duas vezes seguidas e identico? */
  readonly prefixStable: boolean;
  readonly summaryText: string;
}

const FILLER =
  ' Segue o detalhamento da análise com os lançamentos do período, a comparação com o mês anterior, as observações de rotina, o agrupamento por semana e a conferência dos totais por categoria, com o cuidado de manter a mesma ordem de apresentação em todas as respostas.';

/**
 * Roda um cenario (spec 032, FR-021): planta os fatos e o valor no comeco, enche a janela em blocos
 * (compactando entre eles, como o agente faria depois de cada turno) e monta o contexto da pergunta
 * de controle com a estrategia real. Nada aqui chama rede.
 */
export async function runCompactionScenario(scenario: CompactionScenario, summarizer: LlmPort): Promise<CompactionRun> {
  const store = new FakeAgentStore();
  const clock = new MutableClock(new Date('2026-10-22T12:00:00Z'));
  const events = new MemoryAgentEvents();
  let compactions = 0;
  events.subscribe((e) => {
    if (e.type === 'summary_updated') compactions += 1;
  });
  const task = new CompactionTask({
    store, events, clock, ids: new SequentialIdGenerator(), log: new CollectingAgentLog(),
    memory: {
      stores: new FakePreferenceStores(),
      entities: () => Promise.resolve({
        accounts: ['Nubank', 'Itaú', 'Inter', 'Bradesco'].map((name, i) => ({ id: `acc-${String(i)}`, name })),
        categories: ['Mercado', 'Lazer', 'Transporte', 'Saúde e bem-estar'].map((name, i) => ({ id: `cat-${String(i)}`, name })),
      }),
      lastAppliedIds: () => Promise.resolve([]),
    },
    systemPrompt: () => DEFAULT_AGENT_PROMPTS.compactionSystem(),
    model: () => Promise.resolve({ llm: summarizer, profileId: 'fast', contextWindow: scenario.contextWindow, modelKey: 'main|eval' }),
  });
  await store.conversations.create(makeConversation('c1', 'u1'));
  let seq = 0;
  const say = async (text: string): Promise<void> => {
    seq += 1;
    await store.messages.append({ id: `m${String(seq)}`, conversationId: 'c1', userId: 'u1', role: seq % 2 === 1 ? 'user' : 'assistant', parts: [{ type: 'text', text }], status: 'complete', runId: null, errorCode: null, createdAt: '2026-10-22T10:00:00Z' });
  };
  const ctx = () => ({ userId: 'u1', conversationId: 'c1', runId: `r${String(seq)}`, userMessageId: `m${String(seq - 1)}`, assistantMessageId: `m${String(seq)}` });

  // comeco: os fatos plantados (usuario) e o valor dito pelo assistente
  for (const fact of scenario.facts) {
    await say(fact.said);
    await say('Entendido.');
  }
  await say('Quanto deu no mês?');
  await say(scenario.planted.said);
  await task.run(ctx(), new AbortController().signal);
  // enchimento em blocos de 20 mensagens, compactando depois de cada bloco
  for (let batch = 0; batch < scenario.fillerBatches; batch += 1) {
    for (let i = 0; i < 20; i += 1) await say(`Mensagem de rotina ${String(batch)}-${String(i)}.${FILLER}`);
    await task.run(ctx(), new AbortController().signal);
  }
  await say('Pergunta de controle.');
  await say('Resposta.');

  const strategy = new CompactingContextStrategy();
  const summary = await store.summaries.getCurrent('u1', 'c1');
  const history = await store.messages.list('u1', 'c1', { limit: 1000 });
  const build = () => {
    const system = composeSystem('BASE', { preferences: [], summary });
    const messages = strategy.build({ system, history, turn: [{ role: 'user', content: [{ type: 'text', text: 'pergunta' }] }], capabilities: { ...CONSERVATIVE_CAPABILITIES, contextWindow: scenario.contextWindow }, preferences: [], summary });
    return { system, messages };
  };
  const first = build();
  const second = build();
  const textOf = (b: ReturnType<typeof build>): string => `${b.system}\n${JSON.stringify(b.messages)}`;
  return {
    scenarioId: scenario.id,
    compactions,
    totalMessages: seq,
    storedMessages: history.length,
    context: textOf(first),
    prefixStable: textOf(first) === textOf(second),
    summaryText: JSON.stringify(summary?.content ?? null),
  };
}
