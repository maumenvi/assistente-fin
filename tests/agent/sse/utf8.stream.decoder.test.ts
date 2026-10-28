import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Utf8StreamDecoder } from '../../../src/libs/sse/utf8.stream.decoder.ts';

const encoder = new TextEncoder();

function decodeSplit(bytes: Uint8Array, cuts: number[]): string {
  const decoder = new Utf8StreamDecoder();
  let out = '';
  let from = 0;
  for (const cut of [...cuts, bytes.length]) {
    out += decoder.decode(bytes.subarray(from, cut));
    from = cut;
  }
  return out + decoder.flush();
}

describe('Utf8StreamDecoder', () => {
  const samples = ['ação é útil', 'R$ 10 → €5', 'emoji 😀 e 𝄞 fim', 'só ascii', ''];

  for (const sample of samples) {
    it(`decodifica "${sample}" partido em qualquer ponto`, () => {
      const bytes = encoder.encode(sample);
      for (let cut = 0; cut <= bytes.length; cut += 1) {
        assert.equal(decodeSplit(bytes, [cut]), sample, `corte em ${cut}`);
      }
    });

    it(`decodifica "${sample}" byte a byte`, () => {
      const bytes = encoder.encode(sample);
      const cuts = Array.from({ length: bytes.length }, (_, i) => i);
      assert.equal(decodeSplit(bytes, cuts), sample);
    });
  }

  it('caractere multibyte partido nao produz saida ate completar', () => {
    const bytes = encoder.encode('€');
    const decoder = new Utf8StreamDecoder();
    assert.equal(decoder.decode(bytes.subarray(0, 1)), '');
    assert.equal(decoder.decode(bytes.subarray(1, 2)), '');
    assert.equal(decoder.decode(bytes.subarray(2)), '€');
    assert.equal(decoder.flush(), '');
  });

  it('bytes invalidos viram U+FFFD e o resto continua', () => {
    const decoder = new Utf8StreamDecoder();
    const out = decoder.decode(new Uint8Array([0x61, 0xff, 0x62, 0x80, 0x63]));
    assert.equal(out, 'a�b�c');
  });

  it('sequencia truncada seguida de byte ascii vira U+FFFD sem engolir o ascii', () => {
    const decoder = new Utf8StreamDecoder();
    assert.equal(decoder.decode(new Uint8Array([0xe2, 0x82, 0x61])), '��a');
  });

  it('flush com sequencia incompleta devolve um U+FFFD e zera o estado', () => {
    const decoder = new Utf8StreamDecoder();
    assert.equal(decoder.decode(new Uint8Array([0xf0, 0x9f])), '');
    assert.equal(decoder.flush(), '�');
    assert.equal(decoder.flush(), '');
    assert.equal(decoder.decode(encoder.encode('ok')), 'ok');
  });

  it('rejeita sobrelongos e substitutos (C0 80, ED A0 80)', () => {
    const decoder = new Utf8StreamDecoder();
    assert.equal(decoder.decode(new Uint8Array([0xc0, 0x80])), '��');
    assert.equal(decoder.decode(new Uint8Array([0xed, 0xa0, 0x80])), '���');
  });
});
