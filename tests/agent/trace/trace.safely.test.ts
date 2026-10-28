import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CompositeTrace } from '../../../src/app/agent/trace/composite.trace.ts';
import { emitSafely } from '../../../src/app/agent/trace/emit.safely.ts';
import { NullTrace } from '../../../src/app/agent/trace/null.trace.ts';
import { type AgentTracePort } from '../../../src/app/agent/ports/observe/agent.trace.port.ts';
import { type TraceEvent } from '../../../src/app/agent/ports/observe/trace.event.ts';
import { stepEvent } from './support.ts';

class Recording implements AgentTracePort {
  public readonly seen: TraceEvent[] = [];
  public flushed = 0;
  public emit(event: TraceEvent): void {
    this.seen.push(event);
  }
  public flush(): Promise<void> {
    this.flushed += 1;
    return Promise.resolve();
  }
}

const throwing: AgentTracePort = {
  emit: () => {
    throw new Error('destino quebrou');
  },
  flush: () => Promise.reject(new Error('flush quebrou')),
};

describe('emitSafely', () => {
  it('um trace que lanca de forma sincrona NAO propaga o erro', () => {
    assert.doesNotThrow(() => emitSafely(throwing, stepEvent('r1', 1)));
  });

  it('entrega o evento normalmente quando tudo vai bem', () => {
    const trace = new Recording();
    emitSafely(trace, stepEvent('r1', 1));
    assert.equal(trace.seen.length, 1);
  });
});

describe('CompositeTrace', () => {
  it('entrega a todos os destinos mesmo se um deles falhar', () => {
    const a = new Recording();
    const b = new Recording();
    const composite = new CompositeTrace([a, throwing, b]);
    assert.doesNotThrow(() => composite.emit(stepEvent('r1', 1)));
    assert.equal(a.seen.length, 1);
    assert.equal(b.seen.length, 1);
  });

  it('flush chama todos e nao rejeita se um falhar', async () => {
    const a = new Recording();
    const b = new Recording();
    await new CompositeTrace([a, throwing, b]).flush(100);
    assert.equal(a.flushed, 1);
    assert.equal(b.flushed, 1);
  });
});

describe('NullTrace', () => {
  it('descarta tudo e o flush resolve', async () => {
    const trace = new NullTrace();
    trace.emit();
    await trace.flush();
  });
});
