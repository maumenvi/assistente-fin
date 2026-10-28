/**
 * Versao de uma preferencia editada neste aparelho que o "ultima escrita vence" substituiu
 * (edicao simultanea nos dois aparelhos, spec 032 FR-010). Local; alimenta o aviso discreto com
 * "Restaurar". `seenAt` e preenchido ao exibir o aviso.
 */
export interface PreferenceOverwrite {
  readonly id: string;
  readonly userId: string;
  readonly preferenceId: string;
  readonly lostText: string;
  readonly lostAt: string;
  readonly seenAt: string | null;
}
