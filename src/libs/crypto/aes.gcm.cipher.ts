import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { type Cipher } from '../../app/shared/cipher.port.ts';

/** AES-256: chave de 32 bytes. */
const KEY_BYTES = 32;
/** Nonce GCM recomendado: 12 bytes. */
const IV_BYTES = 12;
/** Prefixo do envelope autocontido: `v1.<iv_b64>.<tag_b64>.<ct_b64>`. */
const SCHEME = 'v1';

/**
 * `Cipher` com `node:crypto` AES-256-GCM (autenticado, sem dependencia externa) - adaptador
 * padrao de producao (revisao Fase 4). A chave vem de fora (variavel de ambiente
 * `VERIFICATION_CODE_KEY`), aceita em hex (64 chars) ou base64 (44 chars), sempre 32 bytes.
 *
 * Objetivo: o codigo de verificacao nao fica legivel no banco (backup, dump, replica) sem a
 * chave. Nao protege contra quem tem a chave E o banco.
 */
export class AesGcmCipher implements Cipher {
  private readonly key: Buffer;

  public constructor(rawKey: string) {
    this.key = AesGcmCipher.parseKey(rawKey);
  }

  public encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [
      SCHEME,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      ciphertext.toString('base64'),
    ].join('.');
  }

  public decrypt(envelope: string): string {
    const parts = envelope.split('.');
    if (parts.length !== 4 || parts[0] !== SCHEME) {
      throw new Error('envelope de cifra invalido');
    }
    const [, ivRaw, tagRaw, ctRaw] = parts as [string, string, string, string];
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivRaw, 'base64'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ctRaw, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }

  private static parseKey(rawKey: string): Buffer {
    const trimmed = rawKey.trim();
    const asHex = /^[0-9a-fA-F]{64}$/.test(trimmed) ? Buffer.from(trimmed, 'hex') : null;
    const key = asHex ?? Buffer.from(trimmed, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `VERIFICATION_CODE_KEY deve ter 32 bytes (64 hex ou 44 base64); veio com ${key.length}`,
      );
    }
    return key;
  }
}
