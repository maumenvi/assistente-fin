import { type Cipher } from '../../src/app/shared/cipher.port.ts';

/**
 * `Cipher` deterministico e reversivel para testes: `encrypt(p) === "enc:" + p`. Sem cripto
 * de verdade - so o suficiente pra exercitar o repositorio (cifra ao gravar, decifra ao ler)
 * sem o custo/aleatoriedade do AES. `decrypt` de algo que nao foi cifrado assim lanca.
 */
export class FakeCipher implements Cipher {
  private static readonly PREFIX = 'enc:';

  public encrypt(plaintext: string): string {
    return FakeCipher.PREFIX + plaintext;
  }

  public decrypt(ciphertext: string): string {
    if (!ciphertext.startsWith(FakeCipher.PREFIX)) {
      throw new Error('FakeCipher: texto nao cifrado por este cipher');
    }
    return ciphertext.slice(FakeCipher.PREFIX.length);
  }
}
