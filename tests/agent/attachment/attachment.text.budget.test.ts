import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attachmentTextBudget, MIN_USEFUL_CHARS } from '../../../src/app/agent/attachment/model/attachment.text.budget.ts';

describe('attachmentTextBudget (variavel pela janela do modelo)', () => {
  it('janela de 12 mil => resumo pequeno; 16 384 => maior; 128 000 => teto', () => {
    const small = attachmentTextBudget(12_000);
    const mid = attachmentTextBudget(16_384);
    assert.ok(small !== null && small >= MIN_USEFUL_CHARS && small < 4000, String(small));
    assert.ok(mid !== null && mid > (small as number) * 2);
    assert.equal(attachmentTextBudget(128_000), 48_000);
    assert.equal(attachmentTextBudget(1_000_000), 48_000);
  });

  it('historico e imagens descontam do espaco', () => {
    const free = attachmentTextBudget(16_384) as number;
    assert.ok((attachmentTextBudget(16_384, { historyTokens: 3000 }) as number) < free);
    assert.ok((attachmentTextBudget(16_384, { imageCount: 2 }) as number) < free);
  });

  it('abaixo do piso util => null (envio bloqueado com "janela insuficiente")', () => {
    assert.equal(attachmentTextBudget(4096), null);
    assert.equal(attachmentTextBudget(8192), null, 'o minimo da 035 (8 192) ja e consumido pelo prompt do agente: sem espaco para o anexo');
    assert.equal(attachmentTextBudget(16_384, { historyTokens: 7500 }), null);
    assert.equal(attachmentTextBudget(0), null);
  });
});
