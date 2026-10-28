/** Chamada de ferramenta recebida do modelo, ainda sem validar os argumentos. */
export interface ToolInvocation {
  readonly id: string;
  readonly name: string;
  readonly args: unknown;
}
