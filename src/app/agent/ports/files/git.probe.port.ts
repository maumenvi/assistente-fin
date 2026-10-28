/** Pergunta se um caminho esta dentro de um repositorio git (spec 040, FR-012); avaliada a cada operacao. */
export interface GitProbePort {
  isInsideRepo(path: string): Promise<boolean>;
}
