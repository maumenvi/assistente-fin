import { z } from 'zod';

/** Itens por pagina das listas do agente: padrao e maximo 50. */
export const PAGE_SIZE = 50;

/** `limit` de uma pagina: inteiro entre 1 e 50 (padrao 50). */
export const pageLimitSchema = z.int().min(1).max(PAGE_SIZE).default(PAGE_SIZE);
