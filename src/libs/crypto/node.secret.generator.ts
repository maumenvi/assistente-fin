import { createHash, randomBytes } from 'node:crypto';
import { type SecretGenerator } from '../../app/shared/secret.generator.port.ts';

/** `SecretGenerator` do desktop (`node:crypto`). */
export class NodeSecretGenerator implements SecretGenerator {
  public randomHex(bytes: number): string {
    return randomBytes(bytes).toString('hex');
  }

  public sha256Hex(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }
}
