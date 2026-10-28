import { type CannedReplies } from './canned.replies.type.ts';

/** Textos fixos do agente, sem LLM (spec 031, FR-009/FR-030). */
export const CANNED_REPLIES: CannedReplies = {
  writeRequest: () =>
    'Por enquanto eu só consulto seus dados — não consigo lançar, editar nem apagar nada. Para isso, use a tela Extrato (ou Registrar) do app. Posso te ajudar a consultar saldos, gastos, cartões, limites e previsões.',
  outOfScope: () =>
    'Eu só posso ajudar com as suas finanças no app: saldos, lançamentos, cartões, limites, ganhos, gastos fixos e previsões. Tente me perguntar algo nesse assunto.',
  settingsRequest: () =>
    'Autonomia e privacidade só podem ser alteradas na tela de configurações do assistente — eu não mudo isso por aqui. Use o botão abaixo para abrir a tela.',
  settingsButtonLabel: () => 'Abrir configurações',
};
