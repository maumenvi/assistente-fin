import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AttachmentDraftStore } from '../../../src/app/agent/attachment/draft/attachment.draft.store.ts';
import { PrepareAttachmentUseCase } from '../../../src/app/agent/attachment/draft/prepare.attachment.use.case.ts';
import { readAttachmentTool } from '../../../src/app/agent/attachment/tools/read.attachment.tool.ts';
import { eraseAgentTool } from '../../../src/app/agent/tools/agent.tool.ts';
import { RegistryToolPort } from '../../../src/app/agent/tools/registry.tool.port.ts';
import { createToolRegistry } from '../../../src/app/agent/tools/tool.registry.ts';
import { SendMessageUseCase } from '../../../src/app/agent/use-cases/send.message.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { DraftNotFoundError } from '../../../src/domain/agent/attachment/errors/draft.not.found.error.ts';
import { ContextTooSmallForAttachmentError } from '../../../src/domain/agent/attachment/errors/context.too.small.for.attachment.error.ts';
import { FakeAgentStore } from '../../../src/database/fake/agent.store.fake.ts';
import { PdfjsPdfText } from '../../../src/libs/attachments/pdfjs.pdf.text.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { LOCAL_MAIN, makeAgentApp } from '../app/support/agent.app.harness.ts';
import { formatBrl } from '../../../src/app/agent/verify/format.brl.ts';
import { EXPECTED_TOTALS, sampleCsv } from '../../support/attachments/build.attachment.fixtures.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const answer = (text: string) => ({ events: [{ type: 'text_delta' as const, text }, { type: 'finish' as const, reason: 'stop' as const }] });
const toolCall = (name: string, args: unknown) => ({ events: [{ type: 'tool_call' as const, id: 'c1', name, args }, { type: 'finish' as const, reason: 'tool_calls' as const }] });

async function setup(llm: ReplayLlm) {
  const store = new FakeAgentStore();
  const tools = new RegistryToolPort(createToolRegistry([eraseAgentTool(readAttachmentTool(store.attachments))]));
  const app = makeAgentApp({ llm, store, tools });
  await app.configure([LOCAL_MAIN]);
  const clock = new MutableClock(new Date('2026-10-24T10:00:00Z'));
  const drafts = new AttachmentDraftStore(clock);
  const prepare = new PrepareAttachmentUseCase({ drafts, pdf: new PdfjsPdfText(), ids: new SequentialIdGenerator('d'), clock });
  const send = new SendMessageUseCase({ ...app.deps, drafts });
  return { app, store, drafts, prepare, send };
}

const totalText = `Valor = ${String(Math.floor(EXPECTED_TOTALS.valueCents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${String(EXPECTED_TOTALS.valueCents % 100).padStart(2, '0')}`;

describe('enviar mensagem com anexo (US1)', () => {
  it('o modelo recebe o bloco de dado externo com o total do CSV; o anexo e a parte da mensagem sao gravados; o rascunho e consumido', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [answer('O total é R$ 2.644,95.')]);
    const t = await setup(llm);
    const draft = await t.prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
    const { runId, conversationId } = await t.send.execute({ userId: 'u1', text: 'Qual o total desse extrato?', attachmentIds: [draft.draftId] });
    await t.app.runs.settled(runId);
    const user = llm.requests[0]?.messages.at(-1);
    const text = user?.role === 'user' ? user.content.map((p) => (p.type === 'text' ? p.text : '')).join('') : '';
    assert.match(text, /Qual o total desse extrato\?/);
    assert.match(text, /<dado_externo origem="anexo"/);
    assert.ok(text.includes(totalText), text.slice(0, 600));
    const messages = await t.store.messages.list('u1', conversationId, { limit: 5 });
    const userMessage = messages.find((m) => m.role === 'user');
    const part = userMessage?.parts.find((p) => p.type === 'attachment');
    assert.deepEqual(part && part.type === 'attachment' ? { name: part.name, kind: part.kind, available: part.available } : null, { name: 'extrato.csv', kind: 'csv', available: true });
    assert.equal((await t.store.attachments.listByMessage('u1', userMessage?.id ?? '')).length, 1);
    assert.throws(() => t.drafts.get('u1', draft.draftId), DraftNotFoundError);
    assert.equal(messages.at(-1)?.status, 'complete');
  });

  it('a resposta que cita o total calculado do arquivo passa na verificacao de valores (fato local, nao ocultado)', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [answer(`O total do extrato é ${formatBrl(EXPECTED_TOTALS.valueCents)}.`)]);
    const t = await setup(llm);
    const draft = await t.prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
    const { runId, conversationId } = await t.send.execute({ userId: 'u1', text: 'Qual o total?', attachmentIds: [draft.draftId] });
    await t.app.runs.settled(runId);
    const last = (await t.store.messages.list('u1', conversationId, { limit: 5 })).at(-1);
    const text = last?.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('') ?? '';
    assert.ok(text.includes(formatBrl(EXPECTED_TOTALS.valueCents)), text);
    assert.ok(!last?.parts.some((p) => p.type === 'notice' && p.kind === 'figures_unverified'));
    const invented = new ReplayLlm(TOOLS_CAPABILITIES, [answer('O total é R$ 99.999,99.'), answer('O total é R$ 99.999,99.')]);
    const t2 = await setup(invented);
    const d2 = await t2.prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
    const r2 = await t2.send.execute({ userId: 'u1', text: 'Qual o total?', attachmentIds: [d2.draftId] });
    await t2.app.runs.settled(r2.runId);
    const text2 = (await t2.store.messages.list('u1', r2.conversationId, { limit: 5 })).at(-1)?.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('') ?? '';
    assert.ok(!text2.includes('99.999,99'), 'valor inventado nao aparece');
  });

  it('o assistente le o resto pela ferramenta read_attachment (rodada com ferramenta)', async () => {
    const t = await setup(new ReplayLlm(TOOLS_CAPABILITIES, [toolCall('read_attachment', { attachmentId: 'PLACEHOLDER', limit: 3 }), answer('Li as 3 primeiras linhas.')]));
    // o id do anexo so existe depois do envio: descobre-o pelo bloco do primeiro pedido
    const draft = await t.prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
    const { runId, conversationId } = await t.send.execute({ userId: 'u1', text: 'Mostre linhas', attachmentIds: [draft.draftId] });
    await t.app.runs.settled(runId);
    const attId = (await t.store.attachments.listByConversation('u1', conversationId))[0]?.id;
    assert.ok(attId);
    const tool = new RegistryToolPort(createToolRegistry([eraseAgentTool(readAttachmentTool(t.store.attachments))]));
    const result = await tool.execute({ id: 'x', name: 'read_attachment', args: { attachmentId: attId, limit: 3 } }, { userId: 'u1', now: new Date(), locale: 'pt-BR', limits: { maxItems: 10, maxChars: 6000, timeoutMs: 5000 }, source: { conversationId, messageId: 'm' } });
    assert.match(result.contentForModel, /linhas 0-2 de 214/);
  });

  it('trace: o conteudo do arquivo nao aparece nos passos gravados', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [answer('ok')]);
    const t = await setup(llm);
    const draft = await t.prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
    const { runId } = await t.send.execute({ userId: 'u1', text: 'oi', attachmentIds: [draft.draftId] });
    await t.app.runs.settled(runId);
    const trace = JSON.stringify(t.app.trace.events);
    assert.ok(!trace.includes('SUPERMERCADO ALVORADA'));
    assert.match(trace, /\[anexo: extrato\.csv · csv · \d+ caracteres\]/);
  });

  it('mais tarde na conversa o historico leva so a referencia do anexo (com o id)', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [answer('um'), answer('dois')]);
    const t = await setup(llm);
    const draft = await t.prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
    const first = await t.send.execute({ userId: 'u1', text: 'primeira', attachmentIds: [draft.draftId] });
    await t.app.runs.settled(first.runId);
    const second = await t.send.execute({ userId: 'u1', conversationId: first.conversationId, text: 'segunda' });
    await t.app.runs.settled(second.runId);
    const history = JSON.stringify(llm.requests.at(-1)?.messages);
    assert.match(history, /\[anexo extrato\.csv \(id [^)]+\) — use read_attachment\]/);
    assert.ok(!history.includes('SUPERMERCADO ALVORADA'));
  });

  it('rascunho inexistente/de outro usuario, anexo sem o armazenamento e janela pequena demais: erro e NADA e consumido ou gravado', async () => {
    const t = await setup(new ReplayLlm(TOOLS_CAPABILITIES, [answer('x')]));
    const draft = await t.prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
    await assert.rejects(t.send.execute({ userId: 'u1', text: 'oi', attachmentIds: ['nao-existe'] }), DraftNotFoundError);
    await assert.rejects(t.send.execute({ userId: 'u1', text: 'oi', attachmentIds: ['a', 'b', 'c', 'd', 'e', 'f'] }), InvalidInputError);
    assert.equal(t.drafts.listOf('u1').length, 1, 'o rascunho continua la');
    const noDrafts = makeAgentApp({ llm: new ReplayLlm(TOOLS_CAPABILITIES, [answer('x')]) });
    await noDrafts.configure([LOCAL_MAIN]);
    await assert.rejects(noDrafts.send.execute({ userId: 'u1', text: 'oi', attachmentIds: ['x'] }), InvalidInputError);
    const small = await setup(new ReplayLlm({ ...CONSERVATIVE_CAPABILITIES, contextWindow: 8192 }, [answer('x')]));
    const d2 = await small.prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
    await assert.rejects(small.send.execute({ userId: 'u1', text: 'oi', attachmentIds: [d2.draftId] }), ContextTooSmallForAttachmentError);
    assert.equal(small.drafts.listOf('u1').length, 1);
    assert.deepEqual(await small.store.conversations.list('u1', { limit: 5 }), []);
  });

  it('falha ao gravar o anexo (sem espaco): StorageFullError e a conversa nova e desfeita', async () => {
    const t = await setup(new ReplayLlm(TOOLS_CAPABILITIES, [answer('x')]));
    const draft = await t.prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
    (t.store.attachments as { save: unknown }).save = () => Promise.reject(new Error('disco cheio'));
    await assert.rejects(t.send.execute({ userId: 'u1', text: 'oi', attachmentIds: [draft.draftId] }), (e: unknown) => (e as { code?: string }).code === 'ATTACHMENT_STORAGE_FULL');
    assert.deepEqual(await t.store.conversations.list('u1', { limit: 5 }), []);
  });
});
