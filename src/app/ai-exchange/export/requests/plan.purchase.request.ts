import { type AgentRequest } from '../agent.request.ts';

/** "Planejar uma compra": o agente avalia se cabe; so registra (installmentPurchase) se o usuario pedir. */
export const planPurchaseRequest: AgentRequest = {
  id: 'plan-purchase',
  title: 'Planejar uma compra',
  hint: 'Depois de enviar, diga o valor e em quantas vezes quer parcelar.',
  text: 'Quero planejar uma compra. Vou dizer o valor e as parcelas; avalie com os dados abaixo se cabe no orcamento (saldo previsto, gastos fixos pendentes, limites e parcelas ja assumidas) e sugira a melhor forma de pagar. So devolva um bloco de importacao (installmentPurchase) se eu pedir para registrar a compra.',
};
