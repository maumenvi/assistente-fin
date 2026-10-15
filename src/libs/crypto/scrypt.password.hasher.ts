import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { type PasswordHasher } from '../../app/shared/password.hasher.port.ts';

/** `crypto.scrypt` (callback) embrulhado em Promise - `promisify` nao aceita o arg de opcoes. */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/** Custo do scrypt (RFC 7914). `N` potencia de 2; memoria ~= 128 * N * r bytes. */
const N = 32_768;
const R = 8;
const P = 1;
/** Folga de memoria pro `N`/`r` acima (~34 MB) - o default do Node (32 MB) nao basta. */
const MAXMEM = 64 * 1024 * 1024;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/** Prefixo do formato autocontido: `scrypt$N$r$p$salt_b64$dk_b64`. */
const SCHEME = 'scrypt';

/**
 * Implementacao de `PasswordHasher` com `node:crypto` `scrypt` - sem dependencia externa.
 * Adaptador padrao de producao. O hash carrega os parametros e o sal, entao trocar `N`/`r`/`p`
 * no futuro nao invalida os hashes ja gravados (`verify` usa os do proprio hash).
 */
export class ScryptPasswordHasher implements PasswordHasher {
  public async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const derived = await this.derive(plain, salt);
    return [SCHEME, N, R, P, salt.toString('base64'), derived.toString('base64')].join('$');
  }

  public async verify(plain: string, hash: string): Promise<boolean> {
    const parts = hash.split('$');
    if (parts.length !== 6 || parts[0] !== SCHEME) {
      return false;
    }
    const [, nRaw, rRaw, pRaw, saltRaw, expectedRaw] = parts as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const cost = { n: Number(nRaw), r: Number(rRaw), p: Number(pRaw) };
    if (!Number.isInteger(cost.n) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) {
      return false;
    }

    let expected: Buffer;
    let salt: Buffer;
    try {
      expected = Buffer.from(expectedRaw, 'base64');
      salt = Buffer.from(saltRaw, 'base64');
    } catch {
      return false;
    }
    if (expected.length === 0 || salt.length === 0) {
      return false;
    }

    const actual = await this.derive(plain, salt, cost, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private derive(
    plain: string,
    salt: Buffer,
    cost: { n: number; r: number; p: number } = { n: N, r: R, p: P },
    keyBytes: number = KEY_BYTES,
  ): Promise<Buffer> {
    return scryptAsync(plain, salt, keyBytes, {
      N: cost.n,
      r: cost.r,
      p: cost.p,
      maxmem: MAXMEM,
    });
  }
}
