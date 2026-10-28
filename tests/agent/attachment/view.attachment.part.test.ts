import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AttachmentDraftStore } from '../../../src/app/agent/attachment/draft/attachment.draft.store.ts';
import { PrepareAttachmentUseCase } from '../../../src/app/agent/attachment/draft/prepare.attachment.use.case.ts';
import { GetConversationMessagesUseCase } from '../../../src/app/agent/use-cases/get.conversation.messages.use.case.ts';
import { SendMessageUseCase } from '../../../src/app/agent/use-cases/send.message.use.case.ts';
import { PdfjsPdfText } from '../../../src/libs/attachments/pdfjs.pdf.text.ts';
import { ReplayLlm } from '../../../src/libs/llm/replay/replay.llm.ts';
import { sampleCsv } from '../../support/attachments/build.attachment.fixtures.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';
import { TOOLS_CAPABILITIES } from '../nodes/support/node.harness.ts';
import { LOCAL_MAIN, makeAgentApp } from '../app/support/agent.app.harness.ts';

describe('anexos ao reabrir a conversa (T035)', () => {
  it('as mensagens trazem so a parte do anexo (nome, tipo, tamanho, id); o id e o mesmo do rascunho e abre o anexo; nenhum conteudo na visao', async () => {
    const llm = new ReplayLlm(TOOLS_CAPABILITIES, [{ events: [{ type: 'text_delta', text: 'ok' }, { type: 'finish', reason: 'stop' }] }]);
    const app = makeAgentApp({ llm });
    await app.configure([LOCAL_MAIN]);
    const clock = new MutableClock(new Date('2026-10-24T10:00:00Z'));
    const drafts = new AttachmentDraftStore(clock);
    const prepare = new PrepareAttachmentUseCase({ drafts, pdf: new PdfjsPdfText(), ids: new SequentialIdGenerator('d'), clock });
    const draft = await prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
    const { runId, conversationId } = await new SendMessageUseCase({ ...app.deps, drafts }).execute({ userId: 'u1', text: 'oi', attachmentIds: [draft.draftId] });
    await app.runs.settled(runId);

    const view = await new GetConversationMessagesUseCase(app.store).execute({ userId: 'u1', conversationId });
    const part = view[0]?.parts.find((p) => p.type === 'attachment');
    assert.deepEqual(part, { type: 'attachment', attachmentId: draft.draftId, name: 'extrato.csv', kind: 'csv', sizeBytes: draft.sizeBytes, available: true });
    assert.ok(!JSON.stringify(view).includes('SUPERMERCADO'));
    assert.equal((await app.store.attachments.get('u1', draft.draftId))?.name, 'extrato.csv');
  });
});
