import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { eraseAgentTool } from '../../../src/app/agent/tools/agent.tool.ts';
import { createToolRegistry } from '../../../src/app/agent/tools/tool.registry.ts';

const ext = eraseAgentTool({ id: 'find_capability', description: 'x', effect: 'external', input: z.object({ query: z.string() }), run: () => Promise.reject(new Error('n/a')) });

describe('efeito external', () => {
  it('so entra em registro que o permite', () => {
    assert.throws(() => createToolRegistry([ext]), /nao e permitido/);
    assert.throws(() => createToolRegistry([ext], ['memory']), /nao e permitido/);
    assert.equal(createToolRegistry([ext], ['read', 'external']).get('find_capability')?.effect, 'external');
  });
});
