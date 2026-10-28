import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SseParser } from '../../../src/libs/sse/sse.parser.ts';

function parseAll(text: string): ReturnType<SseParser['push']> {
  const parser = new SseParser();
  return [...parser.push(text), ...parser.flush()];
}

describe('SseParser', () => {
  it('despacha um evento simples numa linha em branco', () => {
    assert.deepEqual(parseAll('data: ola\n\n'), [{ event: 'message', data: 'ola', id: null, retry: null }]);
  });

  it('une varias linhas data com \\n', () => {
    assert.equal(parseAll('data: a\ndata: b\ndata:c\n\n')[0]?.data, 'a\nb\nc');
  });

  it('aceita CRLF, LF e CR como terminadores', () => {
    assert.equal(parseAll('data: x\r\n\r\n').length, 1);
    assert.equal(parseAll('data: x\n\n').length, 1);
    assert.equal(parseAll('data: x\r\r').length, 1);
  });

  it('CRLF partido entre chunks conta como um terminador so', () => {
    const parser = new SseParser();
    const events = [...parser.push('data: x\r'), ...parser.push('\n'), ...parser.push('\r'), ...parser.push('\ndata: y\r\n\r\n')];
    assert.deepEqual(events.map((e) => e.data), ['x', 'y']);
  });

  it('remove um unico espaco depois de ":"', () => {
    assert.equal(parseAll('data:  dois\n\n')[0]?.data, ' dois');
    assert.equal(parseAll('data:sem\n\n')[0]?.data, 'sem');
  });

  it('linha sem ":" e campo com valor vazio', () => {
    assert.equal(parseAll('data\n\n')[0]?.data, '');
  });

  it('descarta comentarios (keep-alive) em qualquer posicao', () => {
    const events = parseAll(': OPENROUTER PROCESSING\ndata: a\n: meio\n\n');
    assert.deepEqual(events.map((e) => e.data), ['a']);
  });

  it('evento sem data nao e despachado e zera o tipo', () => {
    const events = parseAll('event: ping\n\ndata: x\n\n');
    assert.deepEqual(events, [{ event: 'message', data: 'x', id: null, retry: null }]);
  });

  it('event define o tipo do proximo evento apenas', () => {
    const events = parseAll('event: delta\ndata: 1\n\ndata: 2\n\n');
    assert.deepEqual(events.map((e) => e.event), ['delta', 'message']);
  });

  it('id persiste entre eventos; com NUL e ignorado', () => {
    const events = parseAll('id: 7\ndata: a\n\ndata: b\n\nid: x\u0000y\ndata: c\n\n');
    assert.deepEqual(events.map((e) => e.id), ['7', '7', '7']);
  });

  it('retry valido vem no evento; invalido e ignorado; nao persiste', () => {
    const events = parseAll('retry: 1500\ndata: a\n\nretry: abc\ndata: b\n\ndata: c\n\n');
    assert.deepEqual(events.map((e) => e.retry), [1500, null, null]);
  });

  it('ignora campo desconhecido', () => {
    assert.equal(parseAll('foo: bar\ndata: a\n\n')[0]?.data, 'a');
  });

  it('descarta o BOM inicial', () => {
    assert.equal(parseAll('﻿data: a\n\n')[0]?.data, 'a');
  });

  it('flush nao despacha evento sem linha em branco final', () => {
    const parser = new SseParser();
    assert.deepEqual(parser.push('data: incompleto\n'), []);
    assert.deepEqual(parser.flush(), []);
  });

  it('evento fragmentado em varios chunks', () => {
    const parser = new SseParser();
    const events = [...parser.push('da'), ...parser.push('ta: ab'), ...parser.push('c\n'), ...parser.push('\n')];
    assert.deepEqual(events.map((e) => e.data), ['abc']);
  });

  it('expoe o tamanho parcial para os limites', () => {
    const parser = new SseParser();
    parser.push('data: xxxxx');
    assert.equal(parser.partialLineLength, 11);
    parser.push('\ndata: yy\n');
    assert.ok(parser.eventDataLength >= 9);
  });

  it('nunca lanca com entrada estranha', () => {
    const parser = new SseParser();
    assert.doesNotThrow(() => parser.push('\u0000\r\r\n\n:::\ndata'));
  });
});
