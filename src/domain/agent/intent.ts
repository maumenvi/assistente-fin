/**
 * Intencoes que o roteador reconhece num pedido (spec 031, FR-033).
 *
 * - `direct`: conversa simples (saudacao, agradecimento), sem consulta;
 * - `query`: precisa consultar os dados do app (entra no laco com ferramentas);
 * - `write_request`: pede para alterar dados (o agente so consulta nesta versao);
 * - `settings_request`: pede para mudar autonomia ou privacidade pelo chat (so a tela de
 *   configuracao muda isso - o agente apenas oferece o botao, FR-030);
 * - `preference`: dizer, esquecer ou listar uma preferencia de uso (spec 032);
 * - `out_of_scope`: fora do dominio financeiro do app.
 */
export const INTENTS = ['direct', 'query', 'write_request', 'settings_request', 'preference', 'out_of_scope'] as const;

/** Intencao classificada de um pedido. */
export type Intent = (typeof INTENTS)[number];
