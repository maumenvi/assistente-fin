import { randomBytes } from 'node:crypto';
import { type RecoveryKeyGenerator } from '../../app/shared/recovery.key.generator.port.ts';

/** Base32 de Crockford: sem `I`, `L`, `O`, `U` - menos erro ao transcrever a mao. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUPS = 5;
const GROUP_LEN = 5;
const TOTAL_CHARS = GROUPS * GROUP_LEN;

/**
 * Implementacao de `RecoveryKeyGenerator` com `node:crypto` - sem dependencia externa.
 * Formato: 25 caracteres base32 (125 bits) em 5 grupos de 5 separados por `-`, ex.
 * `4H7K2-9QW3M-XYZ08-...`. Adaptador padrao de producao.
 */
export class RandomRecoveryKeyGenerator implements RecoveryKeyGenerator {
  public next(): string {
    const bytes = randomBytes(Math.ceil((TOTAL_CHARS * 5) / 8));
    const chars: string[] = [];

    let buffer = 0;
    let bits = 0;
    for (const byte of bytes) {
      buffer = (buffer << 8) | byte;
      bits += 8;
      while (bits >= 5 && chars.length < TOTAL_CHARS) {
        bits -= 5;
        chars.push(ALPHABET[(buffer >>> bits) & 31] as string);
      }
    }

    const groups: string[] = [];
    for (let i = 0; i < TOTAL_CHARS; i += GROUP_LEN) {
      groups.push(chars.slice(i, i + GROUP_LEN).join(''));
    }
    return groups.join('-');
  }
}
