import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectAttachmentKind } from '../../../src/app/agent/attachment/extract/detect.attachment.kind.ts';
import { AttachmentUnreadableError } from '../../../src/domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { UnsupportedAttachmentError } from '../../../src/domain/agent/attachment/errors/unsupported.attachment.error.ts';
import { sampleCsv, sampleJpg, samplePdf, samplePng, sampleTxt, sampleXlsx } from '../../support/attachments/build.attachment.fixtures.ts';

describe('detectAttachmentKind', () => {
  it('reconhece os 5 tipos por extensao e assinatura', () => {
    assert.deepEqual(detectAttachmentKind('extrato.csv', sampleCsv()), { kind: 'csv', mediaType: 'text/csv' });
    assert.deepEqual(detectAttachmentKind('notas.TXT', sampleTxt()), { kind: 'text', mediaType: 'text/plain' });
    assert.equal(detectAttachmentKind('extrato.xlsx', sampleXlsx()).kind, 'xlsx');
    assert.equal(detectAttachmentKind('extrato.pdf', samplePdf()).kind, 'pdf');
    assert.deepEqual(detectAttachmentKind('nota.jpeg', sampleJpg()), { kind: 'image', mediaType: 'image/jpeg' });
    assert.deepEqual(detectAttachmentKind('nota.png', samplePng()), { kind: 'image', mediaType: 'image/png' });
  });

  it('extensao desconhecida ou que nao bate com o conteudo => nao suportado', () => {
    for (const [name, bytes] of [['virus.exe', sampleTxt()], ['sem-extensao', sampleTxt()], ['falso.pdf', sampleTxt()], ['falso.xlsx', sampleCsv()], ['falso.png', sampleJpg()], ['falso.jpg', samplePng()], ['binario.txt', Uint8Array.from([65, 0, 66])], ['x.docx', sampleXlsx()]] as const) {
      assert.throws(() => detectAttachmentKind(name, bytes), UnsupportedAttachmentError, name);
    }
  });

  it('arquivo vazio => ilegivel (empty)', () => {
    assert.throws(() => detectAttachmentKind('x.csv', new Uint8Array(0)), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'empty');
  });
});
