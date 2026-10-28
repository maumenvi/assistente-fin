import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AttachmentDraftStore } from '../../../src/app/agent/attachment/draft/attachment.draft.store.ts';
import { DiscardDraftUseCase } from '../../../src/app/agent/attachment/draft/discard.draft.use.case.ts';
import { PrepareAttachmentUseCase } from '../../../src/app/agent/attachment/draft/prepare.attachment.use.case.ts';
import { PdfjsPdfText } from '../../../src/libs/attachments/pdfjs.pdf.text.ts';
import { AttachmentTooLargeError } from '../../../src/domain/agent/attachment/errors/attachment.too.large.error.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const MB = 1024 * 1024;
const bigTxt = (mb: number): Uint8Array => new Uint8Array(mb * MB).fill(0x61);

function setup() {
  const clock = new MutableClock(new Date('2026-10-24T10:00:00Z'));
  const drafts = new AttachmentDraftStore(clock);
  const prepare = new PrepareAttachmentUseCase({ drafts, pdf: new PdfjsPdfText(), ids: new SequentialIdGenerator('d'), clock });
  return { clock, drafts, prepare, discard: new DiscardDraftUseCase(drafts) };
}

describe('limites dos anexos da caixa de mensagem (T033)', () => {
  it('20 MB somados: o anexo que passa disso e recusado com o motivo "mensagem"; descartar libera o espaco', async () => {
    const t = setup();
    const a = await t.prepare.execute({ userId: 'u1', name: 'a.txt', bytes: bigTxt(9) });
    await t.prepare.execute({ userId: 'u1', name: 'b.txt', bytes: bigTxt(9) });
    await assert.rejects(t.prepare.execute({ userId: 'u1', name: 'c.txt', bytes: bigTxt(3) }), (e: unknown) => e instanceof AttachmentTooLargeError && e.scope === 'message');
    t.discard.execute({ userId: 'u1', draftId: a.draftId });
    await t.prepare.execute({ userId: 'u1', name: 'c.txt', bytes: bigTxt(3) });
  });

  it('o limite de cada usuario e independente', async () => {
    const t = setup();
    await t.prepare.execute({ userId: 'u1', name: 'a.txt', bytes: bigTxt(9) });
    await t.prepare.execute({ userId: 'u1', name: 'b.txt', bytes: bigTxt(9) });
    await t.prepare.execute({ userId: 'u2', name: 'a.txt', bytes: bigTxt(9) });
  });
});

describe('envio sem conexao (T050)', () => {
  it('rascunho preso sobrevive ao TTL de 1 h; o solto expira', async () => {
    const t = setup();
    const kept = await t.prepare.execute({ userId: 'u1', name: 'a.txt', bytes: bigTxt(1) });
    const lost = await t.prepare.execute({ userId: 'u1', name: 'b.txt', bytes: bigTxt(1) });
    t.drafts.pin('u1', kept.draftId);
    t.clock.set(new Date('2026-10-24T12:30:00Z'));
    assert.equal(t.drafts.get('u1', kept.draftId).name, 'a.txt');
    assert.throws(() => t.drafts.get('u1', lost.draftId));
  });
});
