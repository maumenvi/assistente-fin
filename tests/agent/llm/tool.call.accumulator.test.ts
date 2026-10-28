import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { repairToolArgs } from '../../../src/libs/llm/openai-compat/repair.tool.args.ts';
import { ToolCallAccumulator } from '../../../src/libs/llm/openai-compat/tool.call.accumulator.ts';

describe('ToolCallAccumulator', () => {
  it('junta argumentos fragmentados em 7 partes', () => {
    const acc = new ToolCallAccumulator();
    acc.push([{ index: 0, id: 'call_a', function: { name: 'query', arguments: '' } }]);
    for (const part of ['{"mon', 'th":', '"2026', '-09",', '"cat":', '"Mer', 'cado"}']) {
      acc.push([{ index: 0, function: { arguments: part } }]);
    }
    assert.deepEqual(acc.finalize(), [{ id: 'call_a', name: 'query', args: { month: '2026-09', cat: 'Mercado' } }]);
  });

  it('duas ferramentas intercaladas por index', () => {
    const acc = new ToolCallAccumulator();
    acc.push([{ index: 0, id: 'a', function: { name: 'one', arguments: '{"x":' } }]);
    acc.push([{ index: 1, id: 'b', function: { name: 'two', arguments: '{"y":' } }]);
    acc.push([{ index: 0, function: { arguments: '1}' } }]);
    acc.push([{ index: 1, function: { arguments: '2}' } }]);
    assert.deepEqual(acc.finalize().map((c) => [c.id, c.name, c.args]), [['a', 'one', { x: 1 }], ['b', 'two', { y: 2 }]]);
  });

  it('Ollama: tudo num chunk, sem id (gera call_1)', () => {
    const acc = new ToolCallAccumulator();
    acc.push([{ function: { name: 'list_categories', arguments: '{}' } }]);
    assert.deepEqual(acc.finalize(), [{ id: 'call_1', name: 'list_categories', args: {} }]);
  });

  it('sem index: id novo abre outra chamada, mesmo id continua a atual', () => {
    const acc = new ToolCallAccumulator();
    acc.push([{ id: 'a', function: { name: 'one', arguments: '{"x"' } }]);
    acc.push([{ id: 'a', function: { arguments: ':1}' } }]);
    acc.push([{ id: 'b', function: { name: 'two', arguments: '{}' } }]);
    assert.deepEqual(acc.finalize().map((c) => c.id), ['a', 'b']);
  });

  it('nome repetido em todo delta nao duplica', () => {
    const acc = new ToolCallAccumulator();
    acc.push([{ index: 0, id: 'a', function: { name: 'query', arguments: '{"a"' } }]);
    acc.push([{ index: 0, function: { name: 'query', arguments: ':1}' } }]);
    assert.equal(acc.finalize()[0]?.name, 'query');
  });

  it('argumentos irrecuperaveis viram argsError com args null', () => {
    const acc = new ToolCallAccumulator();
    acc.push([{ index: 0, id: 'a', function: { name: 'q', arguments: '{"a": ???' } }]);
    const [call] = acc.finalize();
    assert.equal(call?.args, null);
    assert.match(call?.argsError ?? '', /argumentos invalidos/);
  });

  it('argumentos vazios viram objeto vazio; entrada sem nome e descartada', () => {
    const acc = new ToolCallAccumulator();
    acc.push([{ index: 0, id: 'a', function: { name: 'ping' } }, { index: 1, id: 'b', function: { arguments: '{}' } }]);
    assert.deepEqual(acc.finalize(), [{ id: 'a', name: 'ping', args: {} }]);
  });

  it('isEmpty reflete se houve fragmentos', () => {
    const acc = new ToolCallAccumulator();
    assert.equal(acc.isEmpty, true);
    acc.push([{ index: 0, id: 'a', function: { name: 'q' } }]);
    assert.equal(acc.isEmpty, false);
  });
});

describe('repairToolArgs', () => {
  it('JSON valido passa direto', () => assert.deepEqual(repairToolArgs('{"a":1}'), { a: 1 }));
  it('texto vazio vira objeto vazio', () => assert.deepEqual(repairToolArgs('  '), {}));
  it('remove cercas de codigo', () => assert.deepEqual(repairToolArgs('```json\n{"a":1}\n```'), { a: 1 }));
  it('remove virgula final', () => assert.deepEqual(repairToolArgs('{"a":[1,2,],}'), { a: [1, 2] }));
  it('aspas simples obvias', () => assert.deepEqual(repairToolArgs("{'a': 'b'}"), { a: 'b' }));
  it('irrecuperavel lanca SyntaxError', () => assert.throws(() => repairToolArgs('{"a": ???'), SyntaxError));
});
