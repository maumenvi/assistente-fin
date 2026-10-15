import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentInstructions, EXAMPLE_BLOCK } from '../../../../src/app/ai-exchange/export/agent.instructions.ts';
import { composeFirstPartHeader, composeNextPartHeader, composeInstructionsFileText, DEFAULT_REQUEST_TEXT } from '../../../../src/app/ai-exchange/export/compose.share.text.ts';
import { extractAgentBlock } from '../../../../src/app/ai-exchange/extract/extract.agent.block.ts';
import { AiBlockNotFoundError } from '../../../../src/app/ai-exchange/errors/ai.block.not.found.error.ts';
import { parseAgentBlock } from '../../../../src/app/ai-exchange/format/parse.agent.block.ts';

test('o exemplo das instrucoes e um bloco valido: o agente que o copiar acerta o formato', () => {
  const parsed = parseAgentBlock(JSON.parse(JSON.stringify(EXAMPLE_BLOCK)));
  assert.equal(parsed.ops.length, EXAMPLE_BLOCK.ops.length);
});

test('o texto das instrucoes copiado de volta ao app nao e tomado por um bloco do agente', () => {
  assert.throws(() => extractAgentBlock(buildAgentInstructions('full')), AiBlockNotFoundError);
  assert.throws(() => extractAgentBlock(composeFirstPartHeader(null) + '\n{"format":"finctrl-payload"}'), AiBlockNotFoundError);
});

test('as instrucoes cobrem os itens (a) a (h) da spec 029 (FR-020)', () => {
  const text = buildAgentInstructions('full');
  const required: [string, RegExp][] = [
    ['(a) um unico bloco de codigo, sem texto dentro', /UM bloco de codigo, sem texto dentro/],
    ['(b) marca e versao na primeira linha', /FINCTRL-IMPORT v1/],
    ['(c) estrutura das operacoes e campos', /create, update, pay, delete, cancelRemaining/],
    ['(d) usar os ids enviados', /ids de contas, categorias e cartoes/],
    ['(e) batchId e ref unicos', /batchId[\s\S]*ref" unico/],
    ['(f) confirm so quando eu pedir', /"confirm": true[\s\S]*so use quando eu pedir/],
    ['(g) perguntar em caso de duvida', /pergunte a mim/],
    ['(h) avisar para copiar e abrir o app', /copia-lo e abrir o app Finance Controller/],
    ['valor TOTAL da compra parcelada', /valor TOTAL da compra/],
    ['snapshotId devolvido', /snapshotId/],
  ];
  for (const [name, pattern] of required) {
    assert.match(text, pattern, name);
  }
});

test('as partes seguintes repetem a regra de forma curta e apontam a copia', () => {
  const short = buildAgentInstructions('short');
  assert.ok(short.length < buildAgentInstructions('full').length / 3);
  assert.match(short, /igual a parte 1/i);
  const header = composeNextPartHeader(2, 3, 's-9');
  assert.match(header, /Parte 2 de 3/);
  assert.match(header, /s-9/);
});

test('o pedido padrao entra quando nenhum pedido pronto foi escolhido; o escolhido substitui', () => {
  assert.match(composeFirstPartHeader(null), new RegExp(DEFAULT_REQUEST_TEXT.slice(0, 20)));
  assert.match(composeFirstPartHeader('Faca a revisao do mes'), /Faca a revisao do mes/);
  assert.doesNotMatch(composeFirstPartHeader('Faca a revisao do mes'), new RegExp(DEFAULT_REQUEST_TEXT.slice(0, 20)));
  assert.match(composeInstructionsFileText('X'), /\[Pedido\]\nX/);
});
