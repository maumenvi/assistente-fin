/**
 * Nome da categoria padrao criada automaticamente para cada usuario (spec 003, RF-8).
 *
 * Ja esta na forma normalizada de `CategoryName`. O usuario pode renomear essa categoria - o
 * que a identifica como padrao e a flag `isDefault`, nao o nome; por isso nada no sistema deve
 * comparar por esta constante para decidir se uma categoria e a padrao.
 */
export const DEFAULT_CATEGORY_NAME = 'SEM CATEGORIA';
