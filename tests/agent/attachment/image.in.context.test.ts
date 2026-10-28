import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AttachmentDraftStore } from '../../../src/app/agent/attachment/draft/attachment.draft.store.ts';
import { PrepareAttachmentUseCase } from '../../../src/app/agent/attachment/draft/prepare.attachment.use.case.ts';
import { PdfjsPdfText } from '../../../src/libs/attachments/pdfjs.pdf.text.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { SendMessageUseCase } from '../../../src/app/agent/use-cases/send.message.use.case.ts';
import { type LlmContentPart } from '../../../src/app/agent/ports/llm/llm.content.part.ts';
import { type LlmMessage } from '../../../src/app/agent/ports/llm/llm.message.ts';
import { sampleCsv, samplePng } from '../../support/attachments/build.attachment.fixtures.ts';
import { FakeImageReducer } from '../../support/attachments/fake.image.reducer.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { LOCAL_MAIN, makeAgentApp } from '../app/support/agent.app.harness.ts';

const answer = { events: [{ type: 'text_delta' as const, text: 'ok' }, { type: 'finish' as const, reason: 'stop' as const }] };

async function setup(vision: boolean, replies = 6) {
  const llm = new ReplayLlm({ ...TOOLS_CAPABILITIES, vision }, Array.from({ length: replies }, () => answer));
  const app = makeAgentApp({ llm });
  await app.configure([LOCAL_MAIN]);
  const clock = new MutableClock(new Date('2026-10-24T10:00:00Z'));
  const drafts = new AttachmentDraftStore(clock);
  const prepare = new PrepareAttachmentUseCase({ drafts, pdf: new PdfjsPdfText(), images: new FakeImageReducer(), ids: new SequentialIdGenerator('d'), clock });
  const send = new SendMessageUseCase({ ...app.deps, drafts });
  return { llm, app, prepare, send };
}

const partsOf = (m: LlmMessage): readonly LlmContentPart[] => (typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content);
const imagesOf = (messages: readonly LlmMessage[] | undefined): number => (messages ?? []).flatMap(partsOf).filter((p) => p.type === 'image').length;

async function turn(t: Awaited<ReturnType<typeof setup>>, text: string, files: { name: string; bytes: Uint8Array }[], conversationId?: string) {
  const ids: string[] = [];
  for (const f of files) ids.push((await t.prepare.execute({ userId: 'u1', ...f })).draftId);
  const out = await t.send.execute({ userId: 'u1', text, attachmentIds: ids, ...(conversationId === undefined ? {} : { conversationId }) });
  await t.app.runs.settled(out.runId);
  return out.conversationId;
}

/** O pedido ao modelo principal do ultimo turno (o roteador de intencao, quando roda, vem antes e sem anexos). */
const mainRequest = (t: Awaited<ReturnType<typeof setup>>) => t.llm.requests.at(-1)?.messages;

describe('imagens no contexto do modelo (spec 036, US2)', () => {
  it('com visao: a imagem vai como parte image/jpeg; os bytes enviados sao os reduzidos', async () => {
    const t = await setup(true);
    await turn(t, 'o que diz a nota?', [{ name: 'nota.png', bytes: samplePng() }]);
    const last = mainRequest(t)?.at(-1);
    const image = (last === undefined ? [] : partsOf(last)).find((p) => p.type === 'image');
    assert.equal(image?.type === 'image' ? image.mediaType : '', 'image/jpeg');
    assert.equal(imagesOf(mainRequest(t)), 1);
  });

  it('a imagem segue nas 2 mensagens COM anexo seguintes e sai na 3a; mensagem sem anexo nao a reenvia; maximo 3', async () => {
    const t = await setup(true);
    const seen: number[] = [];
    const c = await turn(t, 'um', [{ name: 'a.png', bytes: samplePng() }]);
    seen.push(imagesOf(mainRequest(t)));
    for (const [text, name] of [['dois', 'b.csv'], ['tres', 'c.csv'], ['quatro', 'd.csv']] as const) {
      await turn(t, text, [{ name, bytes: sampleCsv() }], c);
      seen.push(imagesOf(mainRequest(t)));
    }
    assert.deepEqual(seen, [1, 1, 1, 0]);
  });

  it('mensagem sem anexo nao reenvia imagem; varias imagens: no maximo 3 no contexto, com aviso do excedente', async () => {
    const t = await setup(true);
    const c = await turn(t, 'um', [{ name: 'a.png', bytes: samplePng() }]);
    const second = await t.send.execute({ userId: 'u1', text: 'so texto', conversationId: c });
    await t.app.runs.settled(second.runId);
    assert.equal(imagesOf(mainRequest(t)), 0);
    await turn(t, 'cinco', Array.from({ length: 5 }, (_, i) => ({ name: `f${i}.png`, bytes: samplePng() })), c);
    const request = mainRequest(t);
    assert.equal(imagesOf(request), 3);
    const text = (request === undefined ? [] : partsOf(request.at(-1) as LlmMessage)).map((p) => (p.type === 'text' ? p.text : '')).join('') ?? '';
    assert.match(text, /2 imagem\(ns\) além do limite de 3/);
  });

  it('sem visao nenhuma imagem vai ao modelo (o portao do envio ja recusa antes)', async () => {
    const t = await setup(false);
    const draft = await t.prepare.execute({ userId: 'u1', name: 'nota.png', bytes: samplePng() });
    await assert.rejects(t.send.execute({ userId: 'u1', text: 'x', attachmentIds: [draft.draftId] }), (e: { code?: string }) => e.code === 'VISION_NOT_SUPPORTED');
    assert.equal(t.llm.requests.length, 0);
  });

  it('o preparo devolve a miniatura (data URL) e os bytes guardados no rascunho sao os reduzidos', async () => {
    const t = await setup(true);
    const view = await t.prepare.execute({ userId: 'u1', name: 'nota.png', bytes: samplePng() });
    assert.match(view.previewDataUrl ?? '', /^data:image\/jpeg;base64,/);
    assert.equal(view.kind, 'image');
  });

  it('valor lido de IMAGEM nao e ocultado: a resposta vem com o aviso "li da imagem"; sem imagem o mesmo valor segue ocultado', async () => {
    const invented = { events: [{ type: 'text_delta' as const, text: 'O total da nota é R$ 87,50.' }, { type: 'finish' as const, reason: 'stop' as const }] };
    const withImage = new ReplayLlm({ ...TOOLS_CAPABILITIES, vision: true }, [invented, invented]);
    const a = makeAgentApp({ llm: withImage });
    await a.configure([LOCAL_MAIN]);
    const clock = new MutableClock(new Date('2026-10-24T10:00:00Z'));
    const drafts = new AttachmentDraftStore(clock);
    const prepare = new PrepareAttachmentUseCase({ drafts, pdf: new PdfjsPdfText(), images: new FakeImageReducer(), ids: new SequentialIdGenerator('d'), clock });
    const send = new SendMessageUseCase({ ...a.deps, drafts });
    const draft = await prepare.execute({ userId: 'u1', name: 'nota.png', bytes: samplePng() });
    const out = await send.execute({ userId: 'u1', text: 'qual o total?', attachmentIds: [draft.draftId] });
    await a.runs.settled(out.runId);
    const last = (await a.store.messages.list('u1', out.conversationId, { limit: 5 })).at(-1);
    const text = last?.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('') ?? '';
    assert.ok(text.includes('87,50'), text);
    assert.ok(last?.parts.some((p) => p.type === 'notice' && p.kind === 'image_figures'));
    assert.ok(!last?.parts.some((p) => p.type === 'notice' && p.kind === 'figures_unverified'));

    const plain = new ReplayLlm(TOOLS_CAPABILITIES, [invented, invented]);
    const b = makeAgentApp({ llm: plain });
    await b.configure([LOCAL_MAIN]);
    const out2 = await new SendMessageUseCase({ ...b.deps, drafts }).execute({ userId: 'u1', text: 'qual o total?' });
    await b.runs.settled(out2.runId);
    const text2 = (await b.store.messages.list('u1', out2.conversationId, { limit: 5 })).at(-1)?.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('') ?? '';
    assert.ok(!text2.includes('87,50'), 'sem imagem o valor inventado segue oculto');
  });
});
