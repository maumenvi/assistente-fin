import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { extractXlsx } from '../../../src/app/agent/attachment/extract/extract.xlsx.ts';
import { excelSerialToIso, isDateFormat } from '../../../src/app/agent/attachment/extract/xlsx.date.ts';
import { AttachmentUnreadableError } from '../../../src/domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { corruptXlsx, EXPECTED_TOTALS, sampleXlsx } from '../../support/attachments/build.attachment.fixtures.ts';

describe('xlsx.date', () => {
  it('serial do Excel => ISO e deteccao de formato de data', () => {
    assert.equal(excelSerialToIso(46_023), '2026-01-01');
    assert.equal(excelSerialToIso(46_023.5), '2026-01-01T12:00');
    assert.equal(isDateFormat(14, new Map()), true);
    assert.equal(isDateFormat(0, new Map()), false);
    assert.equal(isDateFormat(164, new Map([[164, 'dd/mm/yyyy']])), true);
    assert.equal(isDateFormat(165, new Map([[165, '#,##0.00 "reais"']])), false);
  });
});

describe('extractXlsx', () => {
  it('lê as 2 abas: cabecalho, 214 linhas, datas em ISO e soma igual ao gabarito', () => {
    const c = extractXlsx(sampleXlsx());
    assert.deepEqual(c.sheets.map((s) => s.name), ['Extrato', 'Resumo']);
    const extrato = c.sheets[0];
    assert.deepEqual(extrato?.header, ['Data', 'Descrição', 'Categoria', 'Valor']);
    assert.equal(extrato?.rowCount, EXPECTED_TOTALS.rows);
    assert.match(extrato?.rows[0]?.[0] ?? '', /^2026-09-01$/);
    assert.equal(extrato?.rows[4]?.[2], 'Sem categoria');
    assert.equal(extrato?.numericTotals[3], EXPECTED_TOTALS.valueCents / 100);
    assert.equal(c.sheets[1]?.rows[0]?.[0], undefined);
    assert.equal(c.sheets[1]?.header[1], String(EXPECTED_TOTALS.valueCents / 100));
    assert.deepEqual(c.warnings, []);
  });

  it('corrompido => corrupt; ZIP sem workbook => corrupt', () => {
    assert.throws(() => extractXlsx(corruptXlsx()), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'corrupt');
    assert.throws(() => extractXlsx(zipSync({ 'qualquer.txt': strToU8('x') })), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'corrupt');
  });

  it('planilha sem nenhuma linha => empty; erro em celula => aviso unreadable_cells; deterministico', () => {
    const wb = '<workbook xmlns:r="x"><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>';
    const rels = '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>';
    const build = (sheet: string): Uint8Array => zipSync({ 'xl/workbook.xml': strToU8(wb), 'xl/_rels/workbook.xml.rels': strToU8(rels), 'xl/worksheets/sheet1.xml': strToU8(sheet) });
    assert.throws(() => extractXlsx(build('<worksheet><sheetData></sheetData></worksheet>')), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'empty');
    const withError = extractXlsx(build('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c><c r="B1" t="inlineStr"><is><t>y</t></is></c></row><row r="2"><c r="A2" t="e"><v>#DIV/0!</v></c><c r="B2"><v>5</v></c></row></sheetData></worksheet>'));
    assert.equal(withError.warnings[0]?.code, 'unreadable_cells');
    assert.deepEqual(withError.sheets[0]?.rows, [['', '5']]);
    assert.deepEqual(extractXlsx(sampleXlsx()), extractXlsx(sampleXlsx()));
  });
});
