/**
 * Nome da categoria de sistema de transferencia entre contas, criada/promovida
 * automaticamente sob demanda (spec 016, RF-1, RF-10).
 *
 * Ja esta na forma normalizada de `CategoryName`. O usuario pode renomear essa categoria - o
 * que a identifica dali em diante e a flag `isSystemTransfer`, nao o nome. Duas partes do
 * sistema ainda comparam por esta constante, sempre so para decidir se PROMOVEM uma categoria
 * homonima pre-existente em vez de criar uma segunda (o que violaria o `@@unique([userId,
 * name])` do Postgres): `ensureTransferCategory` (caminho automatico, sob demanda, 1
 * candidata) e `MigrateTransferCategoryUseCase` (caminho manual, trata tambem 0 e 2+
 * candidatas). Nenhum outro lugar deve comparar por nome.
 */
export const TRANSFER_CATEGORY_NAME = 'TRANSFERÊNCIAS';
