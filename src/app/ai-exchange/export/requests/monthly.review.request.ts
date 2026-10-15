import { type AgentRequest } from '../agent.request.ts';

/** "Revisao do mes": so leitura, responde em texto (mesma intencao do prompt `monthly-review` do MCP). */
export const monthlyReviewRequest: AgentRequest = {
  id: 'monthly-review',
  title: 'Revisão do mês',
  hint: 'Envie e leia a resposta; nada é salvo no app.',
  text: 'Faca uma revisao financeira do mes corrente com os dados abaixo: saldo, principais ganhos e gastos, gastos fixos ainda nao pagos, categorias perto ou acima do limite e a tendencia ate o fim do mes. Responda em texto, sem bloco de importacao.',
};
