import { type IdGenerator } from '../../src/app/shared/id.generator.port.ts';

/** Gerador de ids deterministico para testes: `id-1`, `id-2`, ... */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;
  private readonly prefix: string;

  public constructor(prefix = 'id') {
    this.prefix = prefix;
  }

  public next(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}
