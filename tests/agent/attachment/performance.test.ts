import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AttachmentDraftStore } from '../../../src/app/agent/attachment/draft/attachment.draft.store.ts';
import { PrepareAttachmentUseCase } from '../../../src/app/agent/attachment/draft/prepare.attachment.use.case.ts';
import { buildAttachmentContent } from '../../../src/app/agent/attachment/model/build.attachment.content.ts';
import { attachmentTextBudget } from '../../../src/app/agent/attachment/model/attachment.text.budget.ts';
import { PdfjsPdfText } from '../../../src/libs/attachments/pdfjs.pdf.text.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const rows = (n: number): Uint8Array =>
  new TextEncoder().encode(['data;descricao;categoria;valor', ...Array.from({ length: n }, (_, i) => `${String((i % 28) + 1).padStart(2, '0')}/09/2026;COMPRA ${i} LOJA ${i % 37};CAT ${i % 9};${((i * 37) % 50000) / 100}`.replace('.', ','))].join('\n'));

describe('desempenho do preparo (SC-007, T046)', () => {
  it('extrato de 500 linhas: extracao em menos de 2 s e o conteudo cabe na janela de um modelo de 32 mil tokens', async () => {
    const clock = new MutableClock(new Date('2026-10-24T10:00:00Z'));
    const drafts = new AttachmentDraftStore(clock);
    const prepare = new PrepareAttachmentUseCase({ drafts, pdf: new PdfjsPdfText(), ids: new SequentialIdGenerator('d'), clock });
    const started = performance.now();
    const view = await prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: rows(500) });
    const elapsed = performance.now() - started;
    assert.equal(view.summary.rows, 500);
    assert.ok(elapsed < 2000, `extracao levou ${Math.round(elapsed)} ms`);

    const budget = attachmentTextBudget(32_000, { historyTokens: 2000 });
    assert.ok(budget !== null && budget > 0);
    const draft = drafts.get('u1', view.draftId);
    const content = buildAttachmentContent([{ id: 'a1', name: draft.name, kind: draft.kind, mediaType: draft.mediaType, extracted: draft.extracted, bytes: draft.bytes }], budget, false);
    assert.ok(content.text.length <= budget, 'o bloco respeita o orcamento da janela');
    const complete = content.text.includes('COMPRA 499 ');
    assert.ok(complete || /read_attachment/.test(content.text), 'ou cabe tudo, ou o que nao coube e lido por paginas');
  });
});
