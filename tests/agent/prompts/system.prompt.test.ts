import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSystemPrompt } from '../../../src/app/agent/prompts/system.prompt.ts';
import { writeModePrompt } from '../../../src/app/agent/prompts/write.prompt.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';

describe('buildSystemPrompt & writeModePrompt (spec 037, T023, T028, T032)', () => {
  it('inclui regra de cálculo obrigatório via calculate/compare_periods e conta resumida', () => {
    const prompt = buildSystemPrompt({
      today: new Date('2026-10-15T12:00:00Z'),
      capabilities: { ...CONSERVATIVE_CAPABILITIES, tools: true },
    });
    assert.match(prompt, /calculate/);
    assert.match(prompt, /compare_periods/);
    assert.match(prompt, /conta de forma resumida/);
    assert.match(prompt, /list_uncategorized_transactions/);
  });

  it('inclui regras de decomposição multietapas, citar consultas e pedido ambíguo ("organiza isso" -> 1 pergunta curta com 2 a 3 opções)', () => {
    const prompt = buildSystemPrompt({
      today: new Date('2026-10-15T12:00:00Z'),
      capabilities: { ...CONSERVATIVE_CAPABILITIES, tools: true },
    });
    assert.match(prompt, /Pedidos em várias etapas: decomponha/);
    assert.match(prompt, /Cite o período consultado.*NUNCA mencione nomes de ferramentas/);
    assert.match(prompt, /no máximo uma pergunta curta com 2 a 3 opções/);
    assert.match(prompt, /organiza isso/);
  });

  it('writeModePrompt instrui sobre list_uncategorized_transactions, lotes <= 50, itens incertos fora do plano e category.create separado', () => {
    const wp = writeModePrompt();
    assert.match(wp, /list_uncategorized_transactions/);
    assert.match(wp, /lote k de N, total T/);
    assert.match(wp, /FORA do plano/);
    assert.match(wp, /category\.create/);
  });
});
