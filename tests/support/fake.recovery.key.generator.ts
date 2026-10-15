import { type RecoveryKeyGenerator } from '../../src/app/shared/recovery.key.generator.port.ts';

/**
 * `RecoveryKeyGenerator` deterministico para testes: `RECOVERY-KEY-0001`, `-0002`, ...
 * Sequencial (nao fixo) pra exercitar rotacao da chave sem colisao.
 */
export class FakeRecoveryKeyGenerator implements RecoveryKeyGenerator {
  private counter = 0;

  public next(): string {
    this.counter += 1;
    return `RECOVERY-KEY-${this.counter.toString().padStart(4, '0')}`;
  }
}
