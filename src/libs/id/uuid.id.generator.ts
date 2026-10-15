import { randomUUID } from 'node:crypto';
import { type IdGenerator } from '../../app/shared/id.generator.port.ts';

/**
 * Implementacao de `IdGenerator` baseada em UUID v4 (`node:crypto`).
 * Adaptador padrao para producao e desenvolvimento.
 */
export class UuidIdGenerator implements IdGenerator {
  public next(): string {
    return randomUUID();
  }
}
