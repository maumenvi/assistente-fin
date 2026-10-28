import { blockMarker } from '../format/block.marker.ts';
import { type AgentBlock } from '../format/agent.block.ts';
import { EXAMPLE_BATCH_ID } from '../format/example.batch.id.ts';

/** Bloco de exemplo das instrucoes: validado nos testes contra `agentBlockSchema` (spec 029, FR-020). */
export const EXAMPLE_BLOCK: AgentBlock = {
  batchId: EXAMPLE_BATCH_ID,
  snapshotId: 'COPIE-O-snapshot.id-DOS-DADOS',
  ops: [
    {
      ref: 'g1',
      kind: 'create',
      entity: 'transaction',
      data: { date: '2026-10-13', amountCents: 2350, type: 'expense', accountId: 'ID-DA-CONTA', categoryId: 'ID-DA-CATEGORIA', notes: 'Padaria' },
    },
    { kind: 'update', entity: 'transaction', id: 'ID-DO-LANCAMENTO', data: { categoryId: 'ID-DA-CATEGORIA' }, expectV: '2026-10-10T12:00:00.000Z' },
  ],
};

/** Orientacao completa de como me devolver dados (spec 029, FR-020 (a)-(h)). */
const FULL_INSTRUCTIONS = `[Como me devolver dados]
Quando eu pedir para registrar ou alterar algo, responda com UM bloco de codigo, sem texto dentro dele. A primeira linha do bloco e a marca do exemplo abaixo e depois vem um objeto JSON:
{ "batchId": "...", "snapshotId": "...", "ops": [ ... ] }
- batchId: um id NOVO para este lote (8 a 64 letras, numeros, _ ou -); nao reutilize o do exemplo.
- snapshotId: o snapshot.id destes dados (assim o app avisa se algo mudou depois).
- ops: ate 500 operacoes. Cada uma tem "kind" (create, update, pay, delete, cancelRemaining) e "entity".
- Use os ids de contas, categorias e cartoes que estao nos dados; nunca invente id nem use so o nome.
- Valores em centavos inteiros e positivos (R$ 23,50 = 2350); o sentido vem de "type" (expense = gasto, income = entrada). Datas AAAA-MM-DD. Textos com ate 200 caracteres.
- create: precisa de "ref" unico no lote e "data". update: "id" e so os campos que mudam; informe "expectV" com o "v" que voce viu. pay: "id" de um gasto fixo e data {"paid": true}.
- entity transaction (data: date, amountCents, type, accountId, categoryId, notes), income (date, amountCents, source, recurrence {"frequency":"nao-repete"}, categoryId, accountId), fixedExpense (dueDay, expectedAmountCents, description, categoryId, accountId), spendingLimit (categoryId, period {"year","month"}, maxAmountCents), category (name).
- Compra parcelada: entity installmentPurchase, create com accountId, amountCents = valor TOTAL da compra, installments e date; o app cria uma parcela por mes. Para apagar o grupo todo use delete com o id de qualquer parcela; cancelRemaining cancela as parcelas restantes.
- delete e cancelRemaining exigem "confirm": true, e so use quando eu pedir para apagar. Alterar valor, data ou descricao de algo que ja existe tambem exige "confirm": true.
- Em duvida, pergunte a mim; nao invente dados.
- Depois do bloco, diga para eu copia-lo e abrir o app Assistente Fin.
Exemplo:
\`\`\`json
${blockMarker()}
${JSON.stringify(EXAMPLE_BLOCK, null, 2)}
\`\`\``;

/** Lembrete curto das partes seguintes de uma copia (a regra completa esta na parte 1). */
const SHORT_INSTRUCTIONS = `[Como me devolver dados]
Igual a parte 1: um unico bloco de codigo com a marca e o JSON do exemplo da parte 1, com os ids destes dados e valores em centavos.`;

export type InstructionsVariant = 'full' | 'short';

/** Texto de instrucoes para o agente (spec 029, FR-020): `full` na parte 1 e nos arquivos, `short` nas demais partes. */
export function buildAgentInstructions(variant: InstructionsVariant): string {
  return variant === 'full' ? FULL_INSTRUCTIONS : SHORT_INSTRUCTIONS;
}
