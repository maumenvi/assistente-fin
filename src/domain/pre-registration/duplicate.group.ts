import { type PreRegistration } from './pre.registration.entity.ts';

/**
 * Grupo de pre-registros pendentes que parecem a mesma compra (spec 028, FR-017): a tela Resolver
 * mostra um cartao unico perguntando "e a mesma compra?". Membros do mais antigo ao mais recente.
 */
export interface DuplicateGroup {
  readonly members: readonly PreRegistration[];
}
