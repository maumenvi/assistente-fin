import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { unzipSync } from 'fflate';
import { corruptXlsx, EXPECTED_TOTALS, emptyFile, sampleCsv, sampleJpg, samplePdf, samplePng, sampleTxt, sampleXlsx, scannedPdf } from '../../support/attachments/build.attachment.fixtures.ts';

const text = (bytes: Uint8Array): string => new TextDecoder('latin1').decode(bytes);

describe('arquivos de exemplo dos anexos', () => {
  it('CSV: 214 linhas + cabecalho, separador ";", virgula decimal e Latin-1', () => {
    const lines = text(sampleCsv()).split('\r\n');
    assert.equal(lines.length, EXPECTED_TOTALS.rows + 1);
    assert.equal(lines[0], 'Data;Descrição;Categoria;Valor');
    const sum = lines.slice(1).reduce((acc, l) => acc + Math.round(Number((l.split(';')[3] ?? '0').replace(',', '.')) * 100), 0);
    assert.equal(sum, EXPECTED_TOTALS.valueCents);
  });

  it('XLSX: e um ZIP com 2 abas, strings compartilhadas e estilo de data', () => {
    const files = unzipSync(sampleXlsx());
    assert.ok(files['xl/workbook.xml'] && files['xl/sharedStrings.xml'] && files['xl/worksheets/sheet1.xml'] && files['xl/worksheets/sheet2.xml']);
    const book = text(files['xl/workbook.xml'] as Uint8Array);
    assert.ok(book.includes('name="Extrato"') && book.includes('name="Resumo"'));
    assert.equal(((text(files['xl/worksheets/sheet1.xml'] as Uint8Array).match(/<row /g)) ?? []).length, EXPECTED_TOTALS.rows + 1);
  });

  it('PDF com texto tem o texto; o escaneado nao tem; imagens tem assinatura; vazio e corrompido', () => {
    assert.ok(text(samplePdf()).startsWith('%PDF-') && text(samplePdf()).includes('Tj'));
    assert.ok(text(scannedPdf()).startsWith('%PDF-') && !text(scannedPdf()).includes('Tj'));
    assert.deepEqual([...samplePng().slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.deepEqual([...sampleJpg().slice(0, 3)], [0xff, 0xd8, 0xff]);
    assert.equal(emptyFile().length, 0);
    assert.equal(corruptXlsx()[0], 0x50);
    assert.ok(text(sampleTxt()).includes('Total'));
  });
});
