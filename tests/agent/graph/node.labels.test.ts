import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NODE_LABELS } from '../../../src/app/agent/graph/node.labels.ts';

describe('NODE_LABELS', () => {
  it('cobre os nos da spec 031, em pt-BR e sem repeticao', () => {
    for (const id of ['route', 'answer', 'react', 'tools', 'respond']) {
      assert.ok(NODE_LABELS[id], `sem rotulo para ${id}`);
    }
    const labels = Object.values(NODE_LABELS);
    assert.equal(new Set(labels).size, labels.length);
  });

  it('nao pode ser alterado', () => {
    assert.throws(() => {
      (NODE_LABELS as Record<string, string>)['route'] = 'x';
    }, TypeError);
  });
});
