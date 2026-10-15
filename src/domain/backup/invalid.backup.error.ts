import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando um backup (RF-17, RF-18) e rejeitado na importacao: um registro com forma
 * invalida, `schemaVersion` incompativel, header ausente/duplicado, ou dado de outro usuario
 * (CA-16, CA-17). Diferente de `InvalidInputError`: aqui a "forma" (zod) de cada record pode
 * ate estar certa - o problema e o conteudo/sequencia do backup como um todo.
 */
export class InvalidBackupError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_BACKUP', `backup invalido: ${reason}`);
  }
}
