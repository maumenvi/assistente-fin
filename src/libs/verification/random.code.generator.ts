import { randomInt } from 'node:crypto';
import { type VerificationCodeGenerator } from '../../app/shared/verification.code.generator.port.ts';

/** Implementacao de `VerificationCodeGenerator` com `node:crypto`. Adaptador padrao de producao. */
export class RandomCodeGenerator implements VerificationCodeGenerator {
  public next(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }
}
