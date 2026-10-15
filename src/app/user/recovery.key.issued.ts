import { type User } from '../../domain/user/user.entity.ts';

/**
 * Resultado dos casos de uso que emitem uma chave de recuperacao de conta (spec 002,
 * RF-9c): `SetUserPassword`, `ResetPasswordWithRecoveryKey`, `RegenerateRecoveryKey`.
 * `recoveryKey` e o texto claro, entregue uma unica vez - so o hash e persistido.
 */
export interface RecoveryKeyIssued {
  readonly user: User;
  readonly recoveryKey: string;
}
