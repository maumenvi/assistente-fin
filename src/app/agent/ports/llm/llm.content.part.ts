/** Parte de conteudo de uma mensagem enviada ao modelo. `image` e reservado (`capabilities.vision`). */
export type LlmContentPart =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image'; readonly mediaType: string; readonly dataBase64: string };
