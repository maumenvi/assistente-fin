import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type DeterministicIdGenerator } from '../shared/deterministic.id.generator.port.ts';

/**
 * `IdGenerator` que devolve, em sequencia, os ids derivados de uma semente (`<semente>:0`,
 * `<semente>:1`, ...). Faz os casos de uso de lancamento gerarem ids estaveis quando chamados
 * pela aprovacao de um pre-registro (spec 022, G1).
 */
export class DerivedIdGenerator implements IdGenerator {
  private readonly seed: string;
  private readonly deterministic: DeterministicIdGenerator;
  private counter = 0;

  public constructor(seed: string, deterministic: DeterministicIdGenerator) {
    this.seed = seed;
    this.deterministic = deterministic;
  }

  public next(): string {
    const id = this.deterministic.derive(`${this.seed}:${this.counter}`);
    this.counter += 1;
    return id;
  }
}
