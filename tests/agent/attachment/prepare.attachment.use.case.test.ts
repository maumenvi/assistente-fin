import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AttachmentDraftStore } from '../../../src/app/agent/attachment/draft/attachment.draft.store.ts';
import { DiscardDraftUseCase } from '../../../src/app/agent/attachment/draft/discard.draft.use.case.ts';
import { PrepareAttachmentUseCase } from '../../../src/app/agent/attachment/draft/prepare.attachment.use.case.ts';
import { sanitizeAttachmentName } from '../../../src/app/agent/attachment/draft/sanitize.attachment.name.ts';
import { AGENT_ERROR_MESSAGES } from '../../../src/app/agent/errors/agent.error.messages.ts';
import { AttachmentTooLargeError } from '../../../src/domain/agent/attachment/errors/attachment.too.large.error.ts';
import { AttachmentUnreadableError } from '../../../src/domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { UnsupportedAttachmentError } from '../../../src/domain/agent/attachment/errors/unsupported.attachment.error.ts';
import { PdfjsPdfText } from '../../../src/libs/attachments/pdfjs.pdf.text.ts';
import { corruptXlsx, EXPECTED_TOTALS, emptyFile, sampleCsv, sampleJpg, samplePdf, sampleTxt, sampleXlsx, scannedPdf } from '../../support/attachments/build.attachment.fixtures.ts';
import { MutableClock } from '../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

function setup() {
  const clock = new MutableClock(new Date('2026-10-24T10:00:00Z'));
  const drafts = new AttachmentDraftStore(clock);
  const prepare = new PrepareAttachmentUseCase({ drafts, pdf: new PdfjsPdfText(), ids: new SequentialIdGenerator('d'), clock });
  return { drafts, prepare };
}

describe('PrepareAttachmentUseCase', () => {
  it('lê csv, xlsx, txt e pdf e guarda o rascunho em memoria (so metadados na visao)', async () => {
    const { prepare, drafts } = setup();
    const csv = await prepare.execute({ userId: 'u1', name: 'extrato.csv', bytes: sampleCsv() });
    assert.deepEqual({ kind: csv.kind, status: csv.status, rows: csv.summary.rows }, { kind: 'csv', status: 'ready', rows: EXPECTED_TOTALS.rows });
    const xlsx = await prepare.execute({ userId: 'u1', name: 'extrato.xlsx', bytes: sampleXlsx() });
    assert.equal(xlsx.summary.sheets, 2);
    assert.equal((await prepare.execute({ userId: 'u1', name: 'notas.txt', bytes: sampleTxt() })).kind, 'text');
    const pdf = await prepare.execute({ userId: 'u1', name: 'extrato.pdf', bytes: samplePdf() });
    assert.equal(pdf.summary.pages, 1);
    assert.ok(!JSON.stringify([csv, xlsx, pdf]).includes('SUPERMERCADO'), 'a visao nao leva conteudo');
    assert.equal(drafts.listOf('u1').length, 4);
    assert.equal(drafts.get('u1', csv.draftId).extracted?.sheets[0]?.numericTotals[3], EXPECTED_TOTALS.valueCents / 100);
  });

  it('tamanho e checado ANTES de extrair; tipo invalido, vazio, corrompido, escaneado: erro com motivo em portugues', async () => {
    const { prepare } = setup();
    await assert.rejects(prepare.execute({ userId: 'u1', name: 'grande.csv', bytes: new Uint8Array(11 * 1024 * 1024) }), (e: unknown) => e instanceof AttachmentTooLargeError && e.scope === 'file');
    await assert.rejects(prepare.execute({ userId: 'u1', name: 'virus.exe', bytes: sampleTxt() }), UnsupportedAttachmentError);
    await assert.rejects(prepare.execute({ userId: 'u1', name: 'vazio.csv', bytes: emptyFile() }), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'empty');
    await assert.rejects(prepare.execute({ userId: 'u1', name: 'quebrado.xlsx', bytes: corruptXlsx() }), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'corrupt');
    await assert.rejects(prepare.execute({ userId: 'u1', name: 'escaneado.pdf', bytes: scannedPdf() }), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'no_text');
    await assert.rejects(prepare.execute({ userId: 'u1', name: 'nota.jpg', bytes: sampleJpg() }), UnsupportedAttachmentError, 'sem redutor de imagem a imagem nao e aceita');
    for (const code of ['ATTACHMENT_FILE_TOO_LARGE', 'ATTACHMENT_UNSUPPORTED', 'ATTACHMENT_UNREADABLE_EMPTY', 'ATTACHMENT_UNREADABLE_CORRUPT', 'ATTACHMENT_UNREADABLE_NO_TEXT']) assert.ok((AGENT_ERROR_MESSAGES[code] ?? '').length > 10);
  });

  it('limite por mensagem: 5 anexos e 20 MB somados; descartar libera; outro usuario nao conta', async () => {
    const { prepare } = setup();
    const discard = new DiscardDraftUseCase((prepare as unknown as { deps: { drafts: AttachmentDraftStore } }).deps.drafts);
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) ids.push((await prepare.execute({ userId: 'u1', name: `a${i}.txt`, bytes: sampleTxt() })).draftId);
    await assert.rejects(prepare.execute({ userId: 'u1', name: 'a6.txt', bytes: sampleTxt() }), (e: unknown) => e instanceof AttachmentTooLargeError && e.scope === 'message');
    discard.execute({ userId: 'u1', draftId: ids[0] as string });
    await prepare.execute({ userId: 'u1', name: 'a6.txt', bytes: sampleTxt() });
    await prepare.execute({ userId: 'u2', name: 'a1.txt', bytes: sampleTxt() });
  });

  it('nome sem caminho nem controle, ate 200 caracteres', () => {
    assert.equal(sanitizeAttachmentName('C:\\Users\\marco\\extrato.csv'), 'extrato.csv');
    assert.equal(sanitizeAttachmentName('/etc/passwd'), 'passwd');
    assert.equal(sanitizeAttachmentName('a\u0000b\nc.txt'), 'abc.txt');
    assert.equal(sanitizeAttachmentName('x'.repeat(300) + '.csv').length, 200);
    assert.equal(sanitizeAttachmentName('  '), 'anexo');
  });
});
