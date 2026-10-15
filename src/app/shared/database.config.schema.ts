import { z } from 'zod';

/**
 * Schema da configuracao de persistencia (spec 001, RF-21).
 *
 * Entrada externa (variaveis de ambiente) validada na fronteira antes de escolher o
 * adaptador: `driver` decide qual `Database` a factory constroi; `url` e a string de
 * conexao, obrigatoria quando `driver` exige rede (hoje so `prisma`; RF-13 mantem a URL
 * fora do repositorio).
 */
export const databaseConfigSchema = z
  .object({
    driver: z.enum(['fake', 'prisma']),
    url: z.string().trim().min(1, 'url de conexao obrigatoria').optional(),
  })
  .superRefine((config, ctx) => {
    if (config.driver === 'prisma' && !config.url) {
      ctx.addIssue({
        code: 'custom',
        message: 'driver "prisma" exige url de conexao (DATABASE_URL)',
        path: ['url'],
      });
    }
  });

/** Config ja validada e normalizada de `createDatabase`. */
export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;
