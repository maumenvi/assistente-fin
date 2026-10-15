import { createHash } from 'node:crypto';
import { type DeterministicIdGenerator } from '../../app/shared/deterministic.id.generator.port.ts';
import { FINANCE_CONTROLLER_UUID_NAMESPACE, formatUuidV5, uuidToBytes } from '../../app/shared/format.uuid.v5.ts';

/** `DeterministicIdGenerator` do desktop/testes: UUID v5 com o SHA-1 do `node:crypto`. */
export class Sha1DeterministicIdGenerator implements DeterministicIdGenerator {
  private readonly namespace = uuidToBytes(FINANCE_CONTROLLER_UUID_NAMESPACE);

  public derive(name: string): string {
    const hash = createHash('sha1').update(this.namespace).update(name, 'utf8').digest();
    return formatUuidV5(new Uint8Array(hash));
  }
}
