import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { redactAttachmentParts } from '../../../src/app/agent/trace/redact.attachment.parts.ts';
import { type LlmMessage } from '../../../src/app/agent/ports/llm/llm.message.ts';

const SECRET = 'SUPERMERCADO-UNICO-123';

describe('redactAttachmentParts (FR-015)', () => {
  it('troca blocos de anexo, imagens e o resultado de read_attachment por marcadores sem conteudo', () => {
    const messages: LlmMessage[] = [
      { role: 'user', content: [{ type: 'text', text: `Total?\n<dado_externo origem="anexo" id="a1" nome="extrato.csv" tipo="csv">linha ${SECRET}</dado_externo>` }, { type: 'image', mediaType: 'image/jpeg', dataBase64: 'QUJD'.repeat(10) }] },
      { role: 'assistant', content: [], toolCalls: [{ id: 'c1', name: 'read_attachment', args: { attachmentId: 'a1' } }, { id: 'c2', name: 'query_transactions', args: {} }] },
      { role: 'tool', toolCallId: 'c1', content: `linhas: ${SECRET}` },
      { role: 'tool', toolCallId: 'c2', content: 'total R$ 10,00' },
    ];
    const out = redactAttachmentParts(messages);
    const json = JSON.stringify(out);
    assert.ok(!json.includes(SECRET) && !json.includes('QUJD'));
    assert.match(JSON.stringify(out[0]), /\[anexo: extrato\.csv · csv · \d+ caracteres\]/);
    assert.match(JSON.stringify(out[0]), /\[anexo: imagem · image\/jpeg · 40 caracteres\]/);
    assert.deepEqual(out[2], { role: 'tool', toolCallId: 'c1', content: `[anexo: leitura · ${`linhas: ${SECRET}`.length} caracteres]` });
    assert.deepEqual(out[3], messages[3], 'outras ferramentas ficam como estao');
    assert.match(JSON.stringify(out[0]), /Total\?/, 'o texto digitado fica');
  });

  it('mensagens sem anexo passam sem mudanca', () => {
    const messages: LlmMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'oi' }] }, { role: 'assistant', content: [{ type: 'text', text: 'ola' }] }];
    assert.deepEqual(redactAttachmentParts(messages), messages);
  });
});
