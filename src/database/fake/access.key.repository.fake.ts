import { randomUUID } from 'node:crypto';
import { type AccessKeyRecord } from '../../app/shared/access.key.record.ts';
import { type AccessKeyRepositoryPort } from '../../app/shared/access.key.repository.port.ts';

/**
 * Adaptador falso (test double) de `AccessKeyRepositoryPort`, com estado em memoria de
 * processo (spec 004, RF-13). Guarda no maximo 2 linhas: a chave ativa (`revokedAt ===
 * null`) e, durante uma janela de graca, a da rotacao anterior (`revokedAt` = quando ela
 * deixa de valer). Nunca le o relogio — todo instante vem de quem chama.
 */
export class AccessKeyRepositoryFake implements AccessKeyRepositoryPort {
  private rows: AccessKeyRecord[] = [];

  public async getActive(): Promise<AccessKeyRecord | null> {
    return this.rows.find((row) => row.revokedAt === null) ?? null;
  }

  public async listValidNow(now: Date): Promise<AccessKeyRecord[]> {
    return this.rows.filter((row) => row.revokedAt === null || now < row.revokedAt);
  }

  public async replaceActive(
    userId: string,
    keyHash: string,
    opts?: { readonly previousRevokedAt?: Date },
  ): Promise<void> {
    const previousActive = this.rows.find((row) => row.revokedAt === null) ?? null;

    // so a rotacao mais recente pode ficar "revogada, dentro da graca" - qualquer outra
    // linha revogada (de rotacoes anteriores) e descartada aqui.
    const kept: AccessKeyRecord[] =
      previousActive && opts?.previousRevokedAt
        ? [{ ...previousActive, revokedAt: opts.previousRevokedAt }]
        : [];

    this.rows = [
      ...kept,
      { id: randomUUID(), userId, keyHash, createdAt: new Date(), revokedAt: null },
    ];
  }
}
