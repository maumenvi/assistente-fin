import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { type AgentPrompts } from '../../../src/app/agent/prompts/agent.prompts.ts';
import { type LlmPort } from '../../../src/app/agent/ports/llm/llm.port.ts';
import { parseReplayFixture } from '../../../src/libs/llm/replay/parse.replay.fixture.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { buildSyntheticDatabase } from './dataset/build.synthetic.database.ts';
import { type EvalDataset } from './dataset/eval.dataset.ts';
import { runEvalScenario } from './run.eval.scenario.ts';
import { buildEvalReport, type EvalReport } from './score.report.ts';
import { scoreScenario, type ScenarioScore } from './score.scenario.ts';
import { ALL_SCENARIOS } from './scenarios/all.scenarios.ts';
import { type EvalScenario } from './scenarios/eval.scenario.ts';

/** Raiz das fixtures: `tests/fixtures/agent/<modelo>/<cenario>.json`. */
export const FIXTURES_ROOT = join(import.meta.dirname, '..', '..', 'fixtures', 'agent');

/** Cria o modelo de cada cenario (fixture gravada, adaptador real ou gravador). */
export type LlmFactory = (scenario: EvalScenario) => LlmPort | Promise<LlmPort>;

/** Modelo que reproduz a fixture do cenario (se a fixture faltar, o cenario falha com motivo claro). */
export function fixtureLlmFactory(model: string, overrides: Partial<Record<string, ReplayLlm>> = {}): LlmFactory {
  return (scenario) => {
    const override = overrides[scenario.id];
    if (override !== undefined) return override;
    const file = join(FIXTURES_ROOT, model, `${scenario.id}.json`);
    if (!existsSync(file)) throw new Error(`fixture ausente: ${file}`);
    return new ReplayLlm(TOOLS_CAPABILITIES, parseReplayFixture(JSON.parse(readFileSync(file, 'utf8')) as unknown));
  };
}

/**
 * Roda a suite de avaliacao: cada cenario pelo agente real sobre a base sintetica, com o modelo
 * de `llmFor`, e agrega o relatorio. Um cenario cuja execucao lanca fica reprovado (nao derruba a suite).
 */
export async function runSuite(options: {
  readonly model: string;
  readonly llmFor: LlmFactory;
  readonly scenarios?: readonly EvalScenario[];
  readonly prompts?: AgentPrompts;
  readonly dataset?: EvalDataset;
}): Promise<{ readonly report: EvalReport; readonly scores: readonly ScenarioScore[] }> {
  const ds = options.dataset ?? (await buildSyntheticDatabase());
  const scores: ScenarioScore[] = [];
  for (const scenario of options.scenarios ?? ALL_SCENARIOS) {
    const figures = await scenario.figures(ds);
    try {
      const run = await runEvalScenario(ds, scenario, await options.llmFor(scenario), options.prompts === undefined ? {} : { prompts: options.prompts });
      scores.push(scoreScenario(scenario, figures, run));
    } catch (error) {
      scores.push({
        id: scenario.id, category: scenario.category, exact: false, invented: [], trajectoryOk: false, forbiddenHit: false, improperWrite: false, behaviorOk: false,
        passed: false, costMicroUsd: null, ms: 0, excerpt: '', reasons: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
  return { report: buildEvalReport(options.model, scores), scores };
}
