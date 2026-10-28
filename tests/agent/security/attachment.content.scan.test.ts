import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AttachmentDraftStore } from '../../../src/app/agent/attachment/draft/attachment.draft.store.ts';
import { PrepareAttachmentUseCase } from '../../../src/app/agent/attachment/draft/prepare.attachment.use.case.ts';
import { DeleteAttachmentUseCase } from '../../../src/app/agent/attachment/manage/delete.attachment.use.case.ts';
import { SendMessageUseCase } from '../../../src/app/agent/use-cases/send.message.use.case.ts';
import { PdfjsPdfText } from '../../../src/libs/attachments/pdfjs.pdf.text.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { FakeImageReducer } from '../../support/attachments/fake.image.reducer.ts';
import { samplePng } from '../../support/attachments/build.attachment.fixtures.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { LOCAL_MAIN, makeAgentApp } from '../app/support/agent.app.harness.ts';

/** Trecho unico que so existe DENTRO dos arquivos: nunca deve aparecer fora do armazenamento do anexo e do pedido ao modelo. */
const SECRET = 'ZXQ-CONTEUDO-UNICO-9917';
const csv = new TextEncoder().encode(`data;descricao;valor\n01/10/2026;${SECRET};12,50\n02/10/2026;MERCADO;87,50\n`);
const txt = new TextEncoder().encode(`Nota fiscal ${SECRET}-TXT valor 45,90`);
const answer = { events: [{ type: 'text_delta' as const, text: 'Li os anexos.' }, { type: 'finish' as const, reason: 'stop' as const }] };

describe('varredura de conteudo de anexos (SC-008, T045)', () => {
  it('depois de um fluxo completo (csv, txt, imagem, ler, apagar) o conteudo nao aparece em passos, execucoes, eventos, trace nem avisos', async () => {
    const llm = new ReplayLlm({ ...TOOLS_CAPABILITIES, vision: true }, [answer, answer, answer]);
    const app = makeAgentApp({ llm });
    await app.configure([LOCAL_MAIN]);
    const clock = new MutableClock(new Date('2026-10-24T10:00:00Z'));
    const drafts = new AttachmentDraftStore(clock);
    const prepare = new PrepareAttachmentUseCase({ drafts, pdf: new PdfjsPdfText(), images: new FakeImageReducer(), ids: new SequentialIdGenerator('d'), clock });
    const send = new SendMessageUseCase({ ...app.deps, drafts });

    const files = [{ name: 'extrato.csv', bytes: csv }, { name: 'nota.txt', bytes: txt }, { name: 'nota.png', bytes: samplePng() }];
    const ids = [];
    for (const f of files) ids.push((await prepare.execute({ userId: 'u1', ...f })).draftId);
    const { runId, conversationId } = await send.execute({ userId: 'u1', text: 'quanto gastei no total desses anexos?', attachmentIds: ids });
    await app.runs.settled(runId);
    const second = await send.execute({ userId: 'u1', conversationId, text: 'e quanto gastei de mercado?' });
    await app.runs.settled(second.runId);
    await new DeleteAttachmentUseCase(app.store).execute({ userId: 'u1', attachmentId: ids[0] as string });

    // o modelo RECEBEU o conteudo (so no pedido), e isso e o esperado
    assert.ok(JSON.stringify(llm.requests[0]).includes(SECRET) || JSON.stringify(llm.requests.at(-2)).includes(SECRET));

    const outside = {
      trace: JSON.stringify(app.trace.events),
      events: JSON.stringify(app.events),
      logWarns: JSON.stringify(app.log.warns),
      logErrors: JSON.stringify(app.log.errors),
      runs: JSON.stringify([await app.store.runs.get('u1', runId), await app.store.runs.get('u1', second.runId)]),
      steps: JSON.stringify([...(await app.store.steps.list('u1', runId)), ...(await app.store.steps.list('u1', second.runId))]),
      messages: JSON.stringify(await app.store.messages.list('u1', conversationId, { limit: 50 })),
    };
    for (const [where, text] of Object.entries(outside)) assert.ok(!text.includes(SECRET), `conteudo do anexo vazou em ${where}`);
    assert.ok(app.trace.events.length > 0, 'o trace registrou a execucao (a varredura nao e vazia)');
    assert.match(outside.messages, /extrato\.csv/, 'so o nome/tipo/tamanho aparecem');
  });
});
