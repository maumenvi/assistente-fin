import { z } from 'zod';
import { CATEGORY_NAME_MAX_LENGTH } from '../../domain/category/category.name.value.object.ts';

/**
 * Como a entrada externa indica a categoria de um lancamento (spec 003, RF-11..RF-13):
 * `categoryId` quando o usuario escolheu uma da lista, `categoryName` quando digitou, nenhum
 * dos dois quando deixou em branco (cai na padrao, CA-7).
 *
 * Os dois sao opcionais de proposito - categoria e opcional (RF-11). `resolveCategoryId` e
 * quem decide a precedencia e cria/reusa; aqui so se valida a forma.
 */
export const categorySelectionSchema = {
  categoryId: z.string().trim().min(1, 'categoryId nao pode ser vazio').optional(),
  categoryName: z
    .string()
    .trim()
    .min(1, 'categoryName nao pode ser vazio')
    .max(CATEGORY_NAME_MAX_LENGTH, 'nome de categoria muito longo')
    .optional(),
};
