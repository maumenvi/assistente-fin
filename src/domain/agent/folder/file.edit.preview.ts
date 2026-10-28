/** Previa de uma edicao que precisa de confirmacao (spec 040, FR-012): so um trecho antes/depois, nunca o arquivo inteiro. */
export interface FileEditPreview {
  readonly before: string;
  readonly after: string;
  /** Verdadeiro quando os trechos foram cortados para caber na tela. */
  readonly truncated: boolean;
}
