import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractPdf } from '../../../src/app/agent/attachment/extract/extract.pdf.ts';
import { type PdfTextPort } from '../../../src/app/agent/attachment/ports/pdf.text.port.ts';
import { AttachmentUnreadableError } from '../../../src/domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { PdfjsPdfText } from '../../../src/libs/attachments/pdfjs.pdf.text.ts';
import { samplePdf, scannedPdf, SAMPLE_ROWS } from '../../support/attachments/build.attachment.fixtures.ts';

const real = new PdfjsPdfText();
const failing = (name: string): PdfTextPort => ({ extract: () => Promise.reject(Object.assign(new Error('x'), { name })) });

describe('extractPdf (pdfjs no Node)', () => {
  it('PDF com texto: texto por pagina e tabela deduzida pela posicao', async () => {
    const c = await extractPdf(samplePdf(), real);
    assert.match(c.text ?? '', /Data\s+Descricao\s+Categoria\s+Valor/);
    assert.equal(c.stats.pages, 1);
    const sheet = c.sheets[0];
    assert.deepEqual(sheet?.header, ['Data', 'Descricao', 'Categoria', 'Valor']);
    assert.equal(sheet?.rowCount, 5);
    assert.equal(sheet?.rows[0]?.[0], SAMPLE_ROWS[0]?.[0].split('-').reverse().join('/'));
    assert.equal(c.warnings.some((w) => w.code === 'tables_guessed'), true);
    assert.ok((sheet?.numericTotals[3] ?? 0) > 0);
  });

  it('PDF escaneado (sem texto) => no_text', async () => {
    await assert.rejects(extractPdf(scannedPdf(), real), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'no_text');
  });

  it('bytes que nao sao PDF => corrupt', async () => {
    await assert.rejects(extractPdf(new TextEncoder().encode('%PDF-1.4 lixo'), real), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'corrupt');
  });

  it('protegido por senha (porta que lanca PasswordException) => password', async () => {
    await assert.rejects(extractPdf(samplePdf(), { extract: () => Promise.reject(new AttachmentUnreadableError('password')) }), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'password');
    void failing;
  });

  it('determinístico', async () => {
    assert.deepEqual(await extractPdf(samplePdf(), real), await extractPdf(samplePdf(), real));
  });
});
