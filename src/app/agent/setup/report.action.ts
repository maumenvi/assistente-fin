/** Acao sugerida junto de uma etapa do relatorio: abrir o guia, um link, copiar um comando ou ir as configuracoes. */
export interface ReportAction {
  readonly label: string;
  readonly kind: 'guide' | 'link' | 'command' | 'settings';
  /** `guide`: `<provedor>#<passo>`; `link`: endereco https; `command`: o texto a copiar; `settings`: a secao (`advanced`). */
  readonly target: string;
}
