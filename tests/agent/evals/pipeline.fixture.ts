import { type ReplayFixture } from '../../../src/libs/llm/replay/replay.fixture.schema.ts';
import { type EvalScenario } from './scenarios/eval.scenario.ts';

/**
 * Fixture de PIPELINE de um cenario: a trajetoria correta montada do GABARITO (nao de um LLM) -
 * todas as chamadas de ferramenta num turno, depois a resposta com exatamente os valores do
 * gabarito. Valida pipeline, verificador e pontuacao; nao mede a qualidade de um modelo.
 */
export function buildPipelineFixture(scenario: EvalScenario, figures: readonly string[]): ReplayFixture {
  const answer = scenario.answer(figures);
  const finalTurn = { events: [{ type: 'text_delta' as const, text: answer }, { type: 'usage' as const, inputTokens: 300, outputTokens: 40, costMicroUsd: 600 }, { type: 'finish' as const, reason: 'stop' as const }] };
  if (scenario.calls.length === 0) return { version: 1, turns: [finalTurn] };
  return {
    version: 1,
    turns: [
      {
        events: [
          ...scenario.calls.map((call, index) => ({ type: 'tool_call' as const, id: `call-${index + 1}`, name: call.name, args: call.args })),
          { type: 'usage' as const, inputTokens: 500, outputTokens: 30, costMicroUsd: 900 },
          { type: 'finish' as const, reason: 'tool_calls' as const },
        ],
      },
      finalTurn,
    ],
  };
}
