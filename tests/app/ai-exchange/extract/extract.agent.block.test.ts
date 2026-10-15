import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAgentBlock } from '../../../../src/app/ai-exchange/extract/extract.agent.block.ts';
import { quickMarkerCheck } from '../../../../src/app/ai-exchange/extract/quick.marker.check.ts';
import { AiBlockNotFoundError } from '../../../../src/app/ai-exchange/errors/ai.block.not.found.error.ts';
import { AiBlockVersionError } from '../../../../src/app/ai-exchange/errors/ai.block.version.error.ts';
import { AiBlockInvalidError } from '../../../../src/app/ai-exchange/errors/ai.block.invalid.error.ts';

const BODY = '{ "batchId": "lote-0001", "ops": [ { "ref": "a", "kind": "create", "entity": "transaction", "data": { "notes": "tem } e { no texto" } } ] }';

test('le o bloco dentro de uma cerca com linguagem', () => {
  const text = '```json\nFINCTRL-IMPORT v1\n' + BODY + '\n```';
  assert.deepEqual((extractAgentBlock(text) as { batchId: string }).batchId, 'lote-0001');
});

test('ignora texto antes e depois da cerca e usa so o objeto balanceado', () => {
  const text = 'Claro! Aqui esta:\n\n```\nFINCTRL-IMPORT v1\n' + BODY + '\n```\n\nCopie e abra o app. {nao e json}';
  const parsed = extractAgentBlock(text) as { ops: { data: { notes: string } }[] };
  assert.equal(parsed.ops[0]?.data.notes, 'tem } e { no texto');
});

test('aceita aspas tipograficas ao redor das chaves e BOM no inicio', () => {
  const smart = '﻿FINCTRL-IMPORT v1\n{ “batchId”: “lote-0001”, “ops”: [] }';
  assert.equal((extractAgentBlock(smart) as { batchId: string }).batchId, 'lote-0001');
});

test('sem marca: nenhum bloco', () => {
  assert.throws(() => extractAgentBlock('so uma conversa { "a": 1 }'), AiBlockNotFoundError);
});

test('versao diferente ou ausente: erro de versao', () => {
  assert.throws(() => extractAgentBlock('FINCTRL-IMPORT v2\n' + BODY), AiBlockVersionError);
  assert.throws(() => extractAgentBlock('FINCTRL-IMPORT\n' + BODY), AiBlockVersionError);
});

test('virgula final, aspas simples e comentario sao recusados com mensagem', () => {
  for (const bad of ['{ "a": 1, }', "{ 'a': 1 }", '{ "a": 1 // c\n }']) {
    assert.throws(() => extractAgentBlock('FINCTRL-IMPORT v1\n' + bad), AiBlockInvalidError);
  }
});

test('copia cortada (objeto sem fechar) e recusada', () => {
  assert.throws(() => extractAgentBlock('FINCTRL-IMPORT v1\n{ "batchId": "x", "ops": ['), (error) => {
    return error instanceof AiBlockInvalidError && error.issues[0]!.message.includes('incompleto');
  });
});

test('marca sem objeto e recusada', () => {
  assert.throws(() => extractAgentBlock('FINCTRL-IMPORT v1\nnada'), AiBlockInvalidError);
});

test('a marca so vale no comeco de uma linha; mencao no meio do texto nao e bloco', () => {
  assert.throws(() => extractAgentBlock('a primeira linha e FINCTRL-IMPORT v1 e depois o JSON { "a": 1 }'), AiBlockNotFoundError);
  assert.equal((extractAgentBlock('   FINCTRL-IMPORT v1\n' + BODY) as { batchId: string }).batchId, 'lote-0001');
});

test('o bloco de exemplo das instrucoes, copiado de volta, e ignorado como se nao houvesse bloco', () => {
  const example = 'FINCTRL-IMPORT v1\n{ "batchId": "EXEMPLO-NAO-USE-ESTE-ID", "ops": [] }';
  assert.throws(() => extractAgentBlock(example), AiBlockNotFoundError);
});

test('dois blocos no mesmo texto sao recusados', () => {
  const two = 'FINCTRL-IMPORT v1\n' + BODY + '\n\nFINCTRL-IMPORT v1\n' + BODY;
  assert.throws(() => extractAgentBlock(two), (error) => error instanceof AiBlockInvalidError && error.issues[0]!.message.includes('mais de um'));
});

test('quickMarkerCheck: so reconhece a presenca da marca', () => {
  assert.equal(quickMarkerCheck(null), false);
  assert.equal(quickMarkerCheck('compre pao'), false);
  assert.equal(quickMarkerCheck('x FINCTRL-IMPORT v1 {}'), false);
  assert.equal(quickMarkerCheck('\nFINCTRL-IMPORT v1 {}'), true);
});
