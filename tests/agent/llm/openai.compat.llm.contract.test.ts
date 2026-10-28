import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { OpenAiCompatLlm } from '../../../src/libs/llm/openai-compat/openai.compat.llm.ts';
import { CONTRACT_SECRET, runLlmPortContract } from './llm.port.contract.ts';
import { startLocalLlmServer } from './support/local.llm.server.ts';
import { playTurnOverHttp } from './support/turn.to.http.ts';

runLlmPortContract('OpenAiCompatLlm (servidor HTTP local)', async (turn) => {
  const server = await startLocalLlmServer((_req, res) => playTurnOverHttp(turn, res));
  return {
    llm: new OpenAiCompatLlm({
      baseUrl: server.baseUrl,
      model: 'm',
      apiKey: CONTRACT_SECRET,
      capabilities: { ...CONSERVATIVE_CAPABILITIES, tools: true },
      fetchFn: fetch,
      retry: { maxRetries: 0, delaysMs: [1], jitter: 0, maxRetryAfterMs: 10 },
    }),
    close: () => server.close(),
  };
});
