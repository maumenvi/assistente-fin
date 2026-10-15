/**
 * Porta de controle da geracao do lancamento automatico de saldo do mes anterior (spec 011,
 * RF-16, decisao 4.9).
 *
 * So registra "esse mes ja teve a geracao oferecida" - a ausencia da transacao em si nao
 * distingue "nunca gerado" de "gerado e depois excluido pelo usuario" (RF-17), entao esse
 * marcador e a unica fonte de verdade para decidir se `EnsurePreviousMonthBalanceTransaction`
 * deve criar um novo lancamento.
 */
export interface BalanceGenerationRepository {
  /** `true` se o usuario ja teve o saldo daquele mes gerado (ou oferecido) antes. */
  existsFor(userId: string, year: number, month: number): Promise<boolean>;

  /** Marca que a geracao do saldo daquele mes ja ocorreu. Idempotente. */
  markGenerated(userId: string, year: number, month: number): Promise<void>;
}
