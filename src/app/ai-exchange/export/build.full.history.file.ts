import { type AgentPayload } from '../format/agent.payload.ts';
import { type ShareFile } from './share.file.ts';

/** Remove o campo `part`: o arquivo e sempre um conteudo unico, nunca "parte N de M". */
function withoutPart(payload: AgentPayload): AgentPayload {
  const { part: _part, ...rest } = payload;
  return rest;
}

/** Nome do arquivo de dados pelo recorte: historico inteiro ou o mesmo recorte da parte 1 do texto. */
const BASE_NAME = { complete: 'financeiro-completo', recent: 'financeiro-recentes' } as const;

/**
 * Arquivos de dados do compartilhamento (spec 029, FR-011): o JSON com as instrucoes embutidas
 * (o compartilhamento do sistema leva um arquivo so) e uma versao `.txt` com as instrucoes antes dos
 * dados, para os apps de IA que recusam JSON. JSON compacto: o limite aqui e o do app de IA
 * escolhido, nao o da area de transferencia.
 */
export function buildPayloadFiles(payload: AgentPayload, kind: 'complete' | 'recent', instructionsText: string): ShareFile[] {
  const clean = withoutPart(payload);
  const { instructions: _instructions, ...data } = clean;
  return [
    { name: `${BASE_NAME[kind]}.json`, mimeType: 'application/json', content: JSON.stringify({ ...data, instructions: instructionsText }) },
    { name: `${BASE_NAME[kind]}.txt`, mimeType: 'text/plain', content: `${instructionsText}\n[Dados]\n${JSON.stringify(data)}` },
  ];
}
