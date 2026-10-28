import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SseParser } from '../../../src/libs/sse/sse.parser.ts';
import { Utf8StreamDecoder } from '../../../src/libs/sse/utf8.stream.decoder.ts';

/** PRNG deterministico (mulberry32) para a propriedade ser reproduzivel. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = ['a', 'b', 'Z', ' ', 'ç', 'ã', 'é', '€', '→', '😀', '𝄞', '"', '{', '}', ':', '9'];
const TERMINATORS = ['\n', '\r\n', '\r'];

function randomText(rand: () => number, max: number): string {
  let out = '';
  const length = Math.floor(rand() * max);
  for (let i = 0; i < length; i += 1) out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return out;
}

function randomPayload(rand: () => number): string {
  const eol = (): string => TERMINATORS[Math.floor(rand() * TERMINATORS.length)] as string;
  let payload = rand() < 0.1 ? '﻿' : '';
  const events = 1 + Math.floor(rand() * 6);
  for (let i = 0; i < events; i += 1) {
    if (rand() < 0.3) payload += `: ${randomText(rand, 10)}${eol()}`;
    if (rand() < 0.4) payload += `event: ${randomText(rand, 6)}${eol()}`;
    if (rand() < 0.3) payload += `id: ${Math.floor(rand() * 100)}${eol()}`;
    if (rand() < 0.2) payload += `retry: ${Math.floor(rand() * 5000)}${eol()}`;
    const dataLines = 1 + Math.floor(rand() * 3);
    for (let d = 0; d < dataLines; d += 1) payload += `data: ${randomText(rand, 30)}${eol()}`;
    payload += eol();
  }
  return payload;
}

function parse(bytes: Uint8Array, cuts: number[]): unknown[] {
  const decoder = new Utf8StreamDecoder();
  const parser = new SseParser();
  const events: unknown[] = [];
  let from = 0;
  for (const cut of [...cuts, bytes.length]) {
    events.push(...parser.push(decoder.decode(bytes.subarray(from, cut))));
    from = cut;
  }
  events.push(...parser.push(decoder.flush()), ...parser.flush());
  return events;
}

describe('propriedade: o fatiamento dos bytes nao muda os eventos', () => {
  it('200 cargas aleatorias x varios fatiamentos', () => {
    const rand = prng(20261022);
    const encoder = new TextEncoder();
    for (let round = 0; round < 200; round += 1) {
      const bytes = encoder.encode(randomPayload(rand));
      const whole = parse(bytes, []);
      const byteByByte = parse(bytes, Array.from({ length: bytes.length }, (_, i) => i));
      assert.deepEqual(byteByByte, whole, `rodada ${round}: byte a byte`);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const cuts: number[] = [];
        for (let at = 0; at < bytes.length; ) {
          at += 1 + Math.floor(rand() * 9);
          if (at < bytes.length) cuts.push(at);
        }
        assert.deepEqual(parse(bytes, cuts), whole, `rodada ${round}: cortes ${cuts.join(',')}`);
      }
    }
  });
});
