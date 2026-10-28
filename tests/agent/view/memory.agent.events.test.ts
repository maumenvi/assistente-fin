import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryAgentEvents } from '../../../src/app/agent/events/memory.agent.events.ts';
import { type AgentEvent } from '../../../src/app/agent/ports/events/agent.event.ts';

const event: AgentEvent = { type: 'text_delta', runId: 'r1', conversationId: 'c1', seq: 1, messageId: 'm1', text: 'oi' };

describe('MemoryAgentEvents', () => {
  it('entrega o evento, de forma sincrona, a todos os ouvintes na ordem da assinatura', () => {
    const bus = new MemoryAgentEvents();
    const order: string[] = [];
    bus.subscribe(() => order.push('a'));
    bus.subscribe(() => order.push('b'));
    bus.publish(event);
    assert.deepEqual(order, ['a', 'b']);
  });

  it('um ouvinte que lanca nao afeta os demais nem o publicador', () => {
    const bus = new MemoryAgentEvents();
    const seen: AgentEvent[] = [];
    bus.subscribe(() => { throw new Error('ouvinte com defeito'); });
    bus.subscribe((e) => seen.push(e));
    assert.doesNotThrow(() => bus.publish(event));
    assert.deepEqual(seen, [event]);
  });

  it('cancelar a assinatura para de receber; cancelar duas vezes e inofensivo', () => {
    const bus = new MemoryAgentEvents();
    const seen: AgentEvent[] = [];
    const cancel = bus.subscribe((e) => seen.push(e));
    bus.publish(event);
    cancel();
    cancel();
    bus.publish(event);
    assert.equal(seen.length, 1);
  });

  it('assinar durante a publicacao nao entra no evento em curso', () => {
    const bus = new MemoryAgentEvents();
    const late: AgentEvent[] = [];
    bus.subscribe(() => { bus.subscribe((e) => late.push(e)); });
    bus.publish(event);
    assert.deepEqual(late, []);
  });
});
