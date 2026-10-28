import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractCsv } from '../../../src/app/agent/attachment/extract/extract.csv.ts';
import { extractTxt } from '../../../src/app/agent/attachment/extract/extract.txt.ts';
import { extractXlsx } from '../../../src/app/agent/attachment/extract/extract.xlsx.ts';
import { readAttachmentTool } from '../../../src/app/agent/attachment/tools/read.attachment.tool.ts';
import { type ToolContext } from '../../../src/app/agent/ports/tool/tool.context.ts';
import { type Attachment } from '../../../src/domain/agent/attachment/attachment.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';
import { EXPECTED_TOTALS, sampleCsv, sampleTxt, sampleXlsx } from '../../support/attachments/build.attachment.fixtures.ts';

const ctx = (userId = 'u1', conversationId = 'c1'): ToolContext => ({ userId, now: new Date(), locale: 'pt-BR', limits: { maxItems: 10, maxChars: 6000, timeoutMs: 5000 }, source: { conversationId, messageId: 'm1' } });
const att = (id: string, over: Partial<Attachment>): Attachment => ({ id, userId: 'u1', conversationId: 'c1', messageId: 'm1', name: `${id}`, kind: 'csv', mediaType: 'text/csv', sizeBytes: 1, status: 'ready', extracted: null, bytes: new Uint8Array(0), createdAt: '2026-10-24T10:00:00.000Z', ...over });

async function setup() {
  const store = new FakeAgentStore();
  await store.attachments.save(att('csv1', { name: 'extrato.csv', extracted: extractCsv(sampleCsv()) }));
  await store.attachments.save(att('xl1', { name: 'extrato.xlsx', kind: 'xlsx', extracted: extractXlsx(sampleXlsx()) }));
  await store.attachments.save(att('tx1', { name: 'notas.txt', kind: 'text', extracted: extractTxt(sampleTxt()) }));
  await store.attachments.save(att('img1', { name: 'nota.jpg', kind: 'image', extracted: null }));
  await store.attachments.save(att('other', { userId: 'u2', extracted: extractCsv(sampleCsv()) }));
  await store.attachments.save(att('c2', { conversationId: 'c2', extracted: extractCsv(sampleCsv()) }));
  return readAttachmentTool(store.attachments);
}

describe('read_attachment', () => {
  it('paginacao: 50 linhas por padrao, offset/limit, nextOffset e fim', async () => {
    const tool = await setup();
    const first = await tool.run({ attachmentId: 'csv1' }, ctx());
    assert.equal(first.ok, true);
    assert.match(first.contentForModel, /linhas 0-49 de 214/);
    assert.match(first.contentForModel, /Há mais: use offset=50/);
    const last = await tool.run({ attachmentId: 'csv1', offset: 200, limit: 200 }, ctx());
    assert.match(last.contentForModel, /linhas 200-213 de 214/);
    assert.match(last.contentForModel, /Fim do anexo/);
    assert.equal(first.summary.itemCount, 50);
    assert.equal(first.summary.truncated, true);
  });

  it('fatos locais: contagem de linhas e soma da coluna Valor em centavos (nao externos)', async () => {
    const tool = await setup();
    const r = await tool.run({ attachmentId: 'csv1', limit: 5 }, ctx());
    const money = r.facts.find((f) => f.kind === 'money');
    assert.equal(money?.value, EXPECTED_TOTALS.valueCents);
    assert.equal(money?.external, undefined);
    assert.equal(r.facts.find((f) => f.kind === 'count')?.value, EXPECTED_TOTALS.rows);
  });

  it('xlsx por aba (nome sem diferenciar maiusculas); aba inexistente lista as abas; txt por linhas', async () => {
    const tool = await setup();
    assert.match((await tool.run({ attachmentId: 'xl1', sheet: 'resumo' }, ctx())).contentForModel, /Aba "Resumo"/);
    const bad = await tool.run({ attachmentId: 'xl1', sheet: 'Outra' }, ctx());
    assert.equal(bad.ok, false);
    assert.match(bad.contentForModel, /Extrato, Resumo/);
    assert.match((await tool.run({ attachmentId: 'tx1' }, ctx())).contentForModel, /Total: R\$ 42,40/);
  });

  it('so anexos do usuario e da conversa; imagem e recusada com explicacao', async () => {
    const tool = await setup();
    assert.equal((await tool.run({ attachmentId: 'other' }, ctx())).ok, false);
    assert.equal((await tool.run({ attachmentId: 'c2' }, ctx())).ok, false, 'outra conversa');
    assert.equal((await tool.run({ attachmentId: 'nao-existe' }, ctx())).error?.code, 'not_found');
    const img = await tool.run({ attachmentId: 'img1' }, ctx());
    assert.equal(img.ok, false);
    assert.match(img.contentForModel, /imagem/);
  });

  it('o resultado e dado dentro do envelope e o schema nao tem userId', async () => {
    const tool = await setup();
    const r = await tool.run({ attachmentId: 'csv1', limit: 3 }, ctx());
    assert.ok(r.contentForModel.startsWith('<dados origem="read_attachment">'));
    assert.equal(tool.effect, 'read');
    assert.ok(!JSON.stringify(Object.keys((tool.input as unknown as { shape: object }).shape)).includes('userId'));
  });
});
