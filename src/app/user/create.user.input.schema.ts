import { z } from 'zod';

/**
 * Schema da entrada externa de "criar usuario" (spec 001, RF-15, RF-23, RF-12).
 *
 * `cpf`/`email`/`phone` aceitam com ou sem mascara aqui; normalizacao e validacao de
 * formato ficam a cargo de `Cpf.create`/`Email.create`/`Phone.create` no caso de uso
 * (erros de dominio, nao zod).
 */
export const createUserInputSchema = z.object({
  cpf: z.string().trim().min(1, 'cpf obrigatorio'),
  email: z.string().trim().min(1, 'email obrigatorio'),
  phone: z.string().trim().min(1, 'telefone obrigatorio'),
  name: z.string().trim().min(1, 'nome obrigatorio').max(120, 'nome muito longo'),
});

/** Entrada ja validada de `CreateUserUseCase`. */
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
