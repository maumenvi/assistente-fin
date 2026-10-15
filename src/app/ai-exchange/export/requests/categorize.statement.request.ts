import { type AgentRequest } from '../agent.request.ts';

/** "Categorizar este extrato": o usuario cola ou anexa o extrato no chat; o agente devolve um bloco de lancamentos. */
export const categorizeStatementRequest: AgentRequest = {
  id: 'categorize-statement',
  title: 'Categorizar este extrato',
  hint: 'Depois de enviar, cole ou anexe o extrato no mesmo chat.',
  text: 'Vou colar ou anexar um extrato. Para cada linha, escolha a categoria entre as categorias dos dados abaixo e devolva UM bloco com um create de transaction por linha (accountId = a conta do extrato; se nao souber, pergunte). Nao repita lancamentos que ja existem nos dados (mesma conta, valor e dia). Use type expense para saidas e income para entradas.',
};
