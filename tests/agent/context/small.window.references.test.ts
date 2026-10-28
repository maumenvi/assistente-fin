import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type AgentMessage } from '../../../src/domain/agent/agent.message.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { extractPinnedConstraints } from '../../../src/app/agent/compaction/pick.block.ts';
import { lastQueryAnchorLine } from '../../../src/app/agent/compaction/query.ref.line.ts';
import { CompactingContextStrategy } from '../../../src/app/agent/context/compacting.context.strategy.ts';
import { composeSystem } from '../../../src/app/agent/context/compose.system.ts';

function msg(seq: number, role: 'user' | 'assistant', text: string, extraParts: AgentMessage['parts'] = []): AgentMessage {
  return {
    id: `m${seq}`,
    conversationId: 'c1',
    userId: 'u1',
    seq,
    role,
    parts: [{ type: 'text', text }, ...extraParts],
    status: 'complete',
    runId: null,
    errorCode: null,
    createdAt: '2026-10-22T10:00:00Z',
  };
}

describe('referências em modelo de janela reduzida sem compactação (US4, T040)', () => {
  it('preserva referências "o segundo", "continue" e "e em outubro?" em conversa curta com janela pequena (4.096 tokens)', () => {
    const history: AgentMessage[] = [
      msg(1, 'user', 'Quais foram meus maiores gastos em setembro na conta Itaú? Considere só variáveis.'),
      msg(
        2,
        'assistant',
        'Em setembro na conta Itaú:\n1. Supermercado Extra — R$ 420,00 [id tx-1]\n2. Farmácia Raia — R$ 185,00 [id tx-2]\n3. Uber — R$ 64,00 [id tx-3]',
        [
          {
            type: 'query',
            summary: {
              tool: 'query_transactions',
              label: 'lançamentos de 01/09/2026 a 30/09/2026',
              filters: { de: '2026-09-01', ate: '2026-09-30', conta: 'acc-itau', tipo: 'expense' },
              itemCount: 3,
              truncated: false,
            },
          },
        ],
      ),
    ];

    const pinned = extractPinnedConstraints(history);
    const anchor = lastQueryAnchorLine(history);
    const system = composeSystem('Você é o assistente financeiro.', {
      preferences: [],
      summary: null,
      pinnedConstraints: pinned,
      lastQueryAnchor: anchor,
    });

    const strategy = new CompactingContextStrategy();
    const smallCaps = { ...CONSERVATIVE_CAPABILITIES, contextWindow: 4_096 };

    for (const followUp of ['detalhe o segundo', 'continue', 'e em outubro?']) {
      const built = strategy.build({
        system,
        history,
        turn: [{ role: 'user', content: [{ type: 'text', text: followUp }] }],
        capabilities: smallCaps,
        preferences: [],
        summary: null,
      });

      const serialized = JSON.stringify(built);
      // A lista numerada com o 2º item ("Farmácia Raia [id tx-2]") e a linha de consulta estão no histórico mantido
      assert.match(serialized, /2\. Farmácia Raia.*\[id tx-2\]/);
      assert.match(serialized, /query_transactions\{de=2026-09-01, ate=2026-09-30, conta=acc-itau, tipo=expense\}/);
      // E a âncora + combinado fixo também estão no system
      assert.match(system, /Considere só variáveis/i);
      assert.match(system, /Última consulta da conversa:.*query_transactions/);
    }
  });
});

