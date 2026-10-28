import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { runLlmPortContract } from './llm.port.contract.ts';

runLlmPortContract('ReplayLlm', (turn) =>
  Promise.resolve({
    llm: new ReplayLlm({ ...CONSERVATIVE_CAPABILITIES, tools: true }, [turn]),
    close: () => Promise.resolve(),
  }),
);
