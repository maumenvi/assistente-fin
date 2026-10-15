import { buildAgentInstructions } from './agent.instructions.ts';

/** Pedido padrao quando o usuario nao escolheu um pedido pronto (spec 029, FR-017). */
export const DEFAULT_REQUEST_TEXT = 'Analise os meus dados financeiros abaixo e me ajude com o que eu pedir a seguir.';

/** Cabecalho da parte 1: pedido + instrucoes completas. */
export function composeFirstPartHeader(requestText: string | null): string {
  return `[Pedido]\n${requestText ?? DEFAULT_REQUEST_TEXT}\n\n${buildAgentInstructions('full')}\n\n[Dados]`;
}

/** Cabecalho das partes seguintes: identifica a copia e lembra a regra de devolucao. */
export function composeNextPartHeader(index: number, count: number, snapshotId: string): string {
  return `[Parte ${index} de ${count}] Mais transacoes, mais antigas, dos mesmos dados (copia ${snapshotId}). Junte com as partes anteriores.\n\n${buildAgentInstructions('short')}\n\n[Dados]`;
}

/** Texto dos arquivos de instrucoes (.md e .txt): pedido + orientacao completa. */
export function composeInstructionsFileText(requestText: string | null): string {
  return `[Pedido]\n${requestText ?? DEFAULT_REQUEST_TEXT}\n\n${buildAgentInstructions('full')}\n`;
}
