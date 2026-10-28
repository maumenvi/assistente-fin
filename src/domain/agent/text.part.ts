/** Parte de texto de uma mensagem. */
export interface TextPart {
  readonly type: 'text';
  readonly text: string;
}
