import { z } from 'zod';
import { type User } from '../../domain/user/user.entity.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { ConfirmationMismatchError } from '../../domain/user/confirmation.mismatch.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type UserRepository } from './user.repository.port.ts';
import { clearUserCredentialsInputSchema } from './clear.user.credentials.input.schema.ts';

/**
 * Caso de uso "redefinir acesso localmente" (spec 002, RF-9e).
 *
 * Escape hatch de ultimo recurso: quem esqueceu a senha, perdeu a chave de recuperacao e
 * nao recebe codigo em nenhum canal. Limpa a senha E a chave (o usuario volta a entrar sem
 * senha e ai define uma nova). NAO exige senha nem canal - o bloqueio real (avisos em
 * etapas) fica na borda; aqui so o guard minimo: o CPF digitado (so digitos) tem que bater
 * com o do usuario-alvo, senao `ConfirmationMismatchError`. Idempotente se o usuario ja nao
 * tem senha.
 */
export class ClearUserCredentialsUseCase {
  private readonly users: UserRepository;

  public constructor(users: UserRepository) {
    this.users = users;
  }

  public async execute(rawInput: unknown): Promise<User> {
    const parsed = clearUserCredentialsInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('redefinir acesso localmente', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (input.confirmationCpf.replace(/\D/g, '') !== user.cpf.digits) {
      throw new ConfirmationMismatchError();
    }

    if (!user.hasPassword()) {
      return user;
    }

    const updated = user.removePassword();
    await this.users.save(updated);
    return updated;
  }
}
