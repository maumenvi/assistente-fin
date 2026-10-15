import { type AgentRequest } from '../agent.request.ts';

/** "Lancar estes gastos": fotos, prints ou texto de gastos viram um bloco de lancamentos. */
export const logExpensesRequest: AgentRequest = {
  id: 'log-expenses',
  title: 'Lançar estes gastos',
  hint: 'Depois de enviar, anexe a foto do comprovante ou digite os gastos.',
  text: 'Vou enviar fotos, prints ou texto de gastos. Lance cada um como um create de transaction (type expense), usando a conta e a categoria mais adequadas dos dados abaixo, e devolva UM bloco. Se faltar valor, data ou conta, pergunte antes de montar o bloco.',
};
