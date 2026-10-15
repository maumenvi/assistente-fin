import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { type AeadCipher } from '../../app/shared/aead.cipher.port.ts';

const IV_BYTES = 12;

function parseKey(rawKey: string): Buffer {
  const trimmed = rawKey.trim();
  const key = /^[0-9a-fA-F]{64}$/.test(trimmed) ? Buffer.from(trimmed, 'hex') : Buffer.from(trimmed, 'base64url');
  if (key.length !== 32) throw new Error(`a chave deve ter 32 bytes; veio com ${key.length}`);
  return key;
}

/** `AeadCipher` AES-256-GCM do desktop (`node:crypto`). Formato: `iv.tag.ciphertext` em base64url. */
export class AesGcmAeadCipher implements AeadCipher {
  private readonly key: Buffer;

  public constructor(rawKey: string) {
    this.key = parseKey(rawKey);
  }

  public seal(plaintext: string, aad: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), ct].map((part) => part.toString('base64url')).join('.');
  }

  public open(sealed: string, aad: string): string {
    const parts = sealed.split('.');
    if (parts.length !== 3) throw new Error('envelope invalido');
    const [iv, tag, ct] = parts.map((part) => Buffer.from(part, 'base64url')) as [Buffer, Buffer, Buffer];
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }
}
