import { ActiveRuns } from '../../../../src/app/agent/runs/active.runs.ts';
import { SafeTruncationStrategy } from '../../../../src/app/agent/context/safe.truncation.strategy.ts';
import { MemoryAgentEvents } from '../../../../src/app/agent/events/memory.agent.events.ts';
import { agentGraph } from '../../../../src/app/agent/graph/agent.graph.ts';
import { type AgentEvent } from '../../../../src/app/agent/ports/events/agent.event.ts';
import { type LlmPort } from '../../../../src/app/agent/ports/llm/llm.port.ts';
import { type AgentSettingsInput } from '../../../../src/app/agent/ports/settings/agent.settings.input.ts';
import { type ModelProfileInput } from '../../../../src/app/agent/ports/settings/model.profile.input.ts';
import { type ToolPort } from '../../../../src/app/agent/ports/tool/tool.port.ts';
import { DEFAULT_AGENT_PROMPTS } from '../../../../src/app/agent/prompts/default.agent.prompts.ts';
import { CLOUD_CONSENT_VERSION } from '../../../../src/app/agent/settings/cloud.consent.version.ts';
import { MemoryAgentSettings } from '../../../../src/app/agent/settings/memory.agent.settings.ts';
import { MemorySecretStore } from '../../../../src/app/agent/settings/memory.secret.store.ts';
import { SendMessageUseCase } from '../../../../src/app/agent/use-cases/send.message.use.case.ts';
import { type SendMessageDeps } from '../../../../src/app/agent/use-cases/send.message.deps.ts';
import { DEFAULT_RUN_BUDGET } from '../../../../src/domain/agent/default.run.budget.ts';
import { FakeAgentStore } from '../../../../src/database/fake/agent.store.fake.ts';
import { MutableClock } from '../../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../../support/sequential.id.generator.ts';
import { RecordingTrace } from '../../graph/support/runner.harness.ts';
import { CollectingAgentLog } from '../../trace/support.ts';

export const LOCAL_MAIN: ModelProfileInput = {
  id: 'main', role: 'main', origin: 'openai_compat_local', baseUrl: 'http://localhost:11434/v1', model: 'llama3', enabled: true,
};
export const LOCAL_FALLBACK: ModelProfileInput = {
  id: 'fallback', role: 'fallback', origin: 'openai_compat_local', baseUrl: 'http://localhost:11434/v1', model: 'llama3-fallback', enabled: true,
};
export const CLOUD_MAIN: ModelProfileInput = {
  id: 'main', role: 'main', origin: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4', enabled: true, apiKey: 'sk-test-123',
};

export const NO_TOOLS_PORT: ToolPort = { list: () => [], execute: () => Promise.reject(new Error('sem ferramentas')) };

export interface AgentAppHarness {
  readonly send: SendMessageUseCase;
  readonly deps: SendMessageDeps;
  readonly store: FakeAgentStore;
  readonly settings: MemoryAgentSettings;
  readonly events: AgentEvent[];
  readonly trace: RecordingTrace;
  readonly log: CollectingAgentLog;
  readonly runs: ActiveRuns;
  readonly madeProfiles: string[];
  configure(profiles: ModelProfileInput[], extra?: Partial<AgentSettingsInput>): Promise<void>;
}

/** Aplicacao do agente completa em memoria: store, configuracao, eventos e o grafo real. */
export function makeAgentApp(options: { llm: LlmPort; fast?: LlmPort; fallback?: LlmPort; tools?: ToolPort; userId?: string; store?: FakeAgentStore }): AgentAppHarness {
  const store = options.store ?? new FakeAgentStore();
  const settings = new MemoryAgentSettings(new MemorySecretStore());
  const bus = new MemoryAgentEvents();
  const events: AgentEvent[] = [];
  bus.subscribe((e) => events.push(e));
  const trace = new RecordingTrace();
  const log = new CollectingAgentLog();
  const runs = new ActiveRuns();
  const madeProfiles: string[] = [];
  const userId = options.userId ?? 'u1';
  const deps: SendMessageDeps = {
    store, settings, consentTextVersion: CLOUD_CONSENT_VERSION, events: bus, trace, log,
    clock: new MutableClock(new Date('2026-10-22T12:00:00Z')), ids: new SequentialIdGenerator('id'),
    tools: options.tools ?? NO_TOOLS_PORT, contextStrategy: new SafeTruncationStrategy(), prompts: DEFAULT_AGENT_PROMPTS,
    graph: agentGraph, runs,
    makeLlm: (profile) => {
      madeProfiles.push(profile.id);
      if (profile.role === 'fast' && options.fast !== undefined) return Promise.resolve(options.fast);
      if (profile.role === 'fallback' && options.fallback !== undefined) return Promise.resolve(options.fallback);
      return Promise.resolve(options.llm);
    },
  };
  return {
    send: new SendMessageUseCase(deps), deps, store, settings, events, trace, log, runs, madeProfiles,
    configure: async (profiles, extra = {}) => {
      await settings.write(userId, { profiles, localOnly: false, limits: { ...DEFAULT_RUN_BUDGET }, ...extra });
    },
  };
}
