import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeTextBytes } from '../../../src/app/agent/attachment/extract/decode.text.bytes.ts';
import { extractCsv } from '../../../src/app/agent/attachment/extract/extract.csv.ts';
import { extractTxt } from '../../../src/app/agent/attachment/extract/extract.txt.ts';
import { parseDecimal } from '../../../src/app/agent/attachment/extract/parse.decimal.ts';
import { AttachmentUnreadableError } from '../../../src/domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { EXPECTED_TOTALS, emptyFile, latin1, sampleCsv, sampleTxt } from '../../support/attachments/build.attachment.fixtures.ts';

describe('decodeTextBytes / parseDecimal', () => {
  it('UTF-8 (com BOM) e Latin-1', () => {
    assert.equal(decodeTextBytes(Uint8Array.from([0xef, 0xbb, 0xbf, 0x63, 0xc3, 0xa9])), 'cé');
    assert.equal(decodeTextBytes(latin1('Descrição FARMÁCIA')), 'Descrição FARMÁCIA');
    assert.equal(decodeTextBytes(new TextEncoder().encode('açaí 😀')), 'açaí 😀');
  });

  it('numeros brasileiros e internacionais; nao numeros viram null', () => {
    const cases: [string, number | null][] = [['1.234,56', 1234.56], ['1234,56', 1234.56], ['1234.56', 1234.56], ['R$ 10,00', 10], ['-5,5', -5.5], ['1.234', 1234], ['3.5', 3.5], ['1,234.56', 1234.56], ['02/09/2026', null], ['2026-09-02', null], ['abc', null], ['', null], ['1,2,3', null]];
    for (const [raw, expected] of cases) assert.equal(parseDecimal(raw), expected, raw);
  });
});

describe('extractCsv', () => {
  it('lê o extrato: cabecalho, 214 linhas, soma da coluna Valor igual ao gabarito', () => {
    const content = extractCsv(sampleCsv());
    const sheet = content.sheets[0];
    assert.deepEqual(sheet?.header, ['Data', 'Descrição', 'Categoria', 'Valor']);
    assert.equal(sheet?.rowCount, EXPECTED_TOTALS.rows);
    assert.equal(sheet?.totalRows, EXPECTED_TOTALS.rows);
    assert.equal(sheet?.numericTotals[3], EXPECTED_TOTALS.valueCents / 100);
    assert.deepEqual(content.warnings, []);
  });

  it('aspas, separador de virgula e quebra de linha dentro de aspas', () => {
    const c = extractCsv(new TextEncoder().encode('nome,valor\n"Silva, João",10.50\n"linha\ncom quebra","2,00"'));
    assert.deepEqual(c.sheets[0]?.rows, [['Silva, João', '10.50'], ['linha\ncom quebra', '2,00']]);
  });

  it('mais de 5 000 linhas => corta e avisa, mas conta o total', () => {
    const lines = ['a;b', ...Array.from({ length: 5200 }, (_, i) => `${i};1,00`)];
    const c = extractCsv(new TextEncoder().encode(lines.join('\n')));
    assert.equal(c.sheets[0]?.rowCount, 5000);
    assert.equal(c.sheets[0]?.totalRows, 5200);
    assert.equal(c.warnings[0]?.code, 'truncated');
  });

  it('vazio => empty; deterministico', () => {
    assert.throws(() => extractCsv(emptyFile()), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'empty');
    assert.throws(() => extractCsv(new TextEncoder().encode('\n  \n')), AttachmentUnreadableError);
    assert.deepEqual(extractCsv(sampleCsv()), extractCsv(sampleCsv()));
  });
});

describe('extractTxt', () => {
  it('texto com as linhas preservadas', () => {
    const c = extractTxt(sampleTxt());
    assert.match(c.text ?? '', /Total: R\$ 42,40/);
    assert.equal(c.stats.rows >= 4, true);
  });

  it('vazio/so espacos => empty; acima do limite => corta e avisa', () => {
    assert.throws(() => extractTxt(new TextEncoder().encode('  \n ')), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'empty');
    const big = extractTxt(new TextEncoder().encode('x'.repeat(250_000)));
    assert.equal(big.text?.length, 200_000);
    assert.equal(big.warnings[0]?.code, 'truncated');
  });
});
